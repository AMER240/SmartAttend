import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_teacher
from app.models import (
    Attendance,
    AttendanceStatus,
    ClassSession,
    Course,
    CourseBranch,
    Student,
    Teacher,
)
from app.schemas.student import StudentOut, StudentUpdate, StudentWithStats
from app.services import face_service


router = APIRouter(tags=["students"])
settings = get_settings()


def _owned_course(course_id: int, teacher: Teacher, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == course_id, Course.teacher_id == teacher.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ders bulunamadı.")
    return course


def _owned_branch(branch_id: int, teacher: Teacher, db: Session) -> CourseBranch:
    branch = (
        db.query(CourseBranch)
        .join(Course, CourseBranch.course_id == Course.id)
        .filter(CourseBranch.id == branch_id, Course.teacher_id == teacher.id)
        .first()
    )
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şube bulunamadı.")
    return branch


def _owned_student(student_id: int, teacher: Teacher, db: Session) -> Student:
    student = (
        db.query(Student)
        .join(Course, Student.course_id == Course.id)
        .filter(Student.id == student_id, Course.teacher_id == teacher.id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Öğrenci bulunamadı.")
    return student


def _build_stats(students: list[Student], db: Session) -> list[StudentWithStats]:
    if not students:
        return []
    student_ids = [s.id for s in students]

    absences = dict(
        db.execute(
            select(Attendance.student_id, func.count(Attendance.id))
            .where(
                Attendance.student_id.in_(student_ids),
                Attendance.status == AttendanceStatus.ABSENT,
            )
            .group_by(Attendance.student_id)
        ).all()
    )
    totals = dict(
        db.execute(
            select(Attendance.student_id, func.count(Attendance.id))
            .where(Attendance.student_id.in_(student_ids))
            .group_by(Attendance.student_id)
        ).all()
    )

    out: list[StudentWithStats] = []
    for s in students:
        total = totals.get(s.id, 0)
        absent = absences.get(s.id, 0)
        rate = ((total - absent) / total * 100.0) if total > 0 else 100.0
        out.append(
            StudentWithStats(
                id=s.id,
                full_name=s.full_name,
                student_number=s.student_number,
                email=s.email,
                course_id=s.course_id,
                branch_id=s.branch_id,
                photo_path=f"/uploads/students/{Path(s.photo_path).name}" if s.photo_path else None,
                has_face_encoding=bool(s.face_encoding),
                created_at=s.created_at,
                branch_name=s.branch.name if s.branch else None,
                branch_code=s.branch.code if s.branch else None,
                course_name=s.course.name if s.course else None,
                course_code=s.course.code if s.course else None,
                total_absences=absent,
                attendance_rate=round(rate, 1),
            )
        )
    return out


@router.get("/students", response_model=list[StudentWithStats])
def list_all_students(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    students = (
        db.query(Student)
        .join(Course, Student.course_id == Course.id)
        .filter(Course.teacher_id == current.id)
        .order_by(Student.full_name.asc())
        .all()
    )
    return _build_stats(students, db)


@router.get("/courses/{course_id}/students", response_model=list[StudentWithStats])
def list_course_students(
    course_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _owned_course(course_id, current, db)
    students = (
        db.query(Student)
        .filter(Student.course_id == course_id)
        .order_by(Student.full_name.asc())
        .all()
    )
    return _build_stats(students, db)


@router.get("/branches/{branch_id}/students", response_model=list[StudentWithStats])
def list_branch_students(
    branch_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _owned_branch(branch_id, current, db)
    students = (
        db.query(Student)
        .filter(Student.branch_id == branch_id)
        .order_by(Student.full_name.asc())
        .all()
    )
    return _build_stats(students, db)


@router.post(
    "/courses/{course_id}/students",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
)
async def enroll_student(
    course_id: int,
    full_name: str = Form(...),
    student_number: str = Form(...),
    branch_id: int = Form(...),
    photo: UploadFile = File(...),
    email: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _owned_course(course_id, current, db)

    branch = _owned_branch(branch_id, current, db)
    if branch.course_id != course.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şube bu derse ait değil.",
        )

    duplicate = (
        db.query(Student)
        .filter(Student.course_id == course_id, Student.student_number == student_number)
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu öğrenci numarası bu derste zaten kayıtlı.",
        )

    data = await photo.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fotoğraf boş.")

    encoding = face_service.encode_single_face(data)
    if encoding is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fotoğrafta tek bir yüz bulunamadı. Tekrar çekin.",
        )

    ext = Path(photo.filename or "photo.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    target = settings.uploads_dir / "students" / filename
    target.write_bytes(data)

    student = Student(
        full_name=full_name,
        student_number=student_number,
        email=email or None,
        course_id=course_id,
        branch_id=branch_id,
        photo_path=str(target),
        face_encoding=face_service.encoding_to_json(encoding),
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return StudentOut(
        id=student.id,
        full_name=student.full_name,
        student_number=student.student_number,
        email=student.email,
        course_id=student.course_id,
        branch_id=student.branch_id,
        photo_path=f"/uploads/students/{filename}",
        has_face_encoding=True,
        created_at=student.created_at,
    )


@router.patch("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    student = _owned_student(student_id, current, db)

    if payload.full_name is not None:
        student.full_name = payload.full_name
    if payload.student_number is not None:
        clash = (
            db.query(Student)
            .filter(
                Student.course_id == student.course_id,
                Student.student_number == payload.student_number,
                Student.id != student.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu öğrenci numarası bu derste zaten kayıtlı.",
            )
        student.student_number = payload.student_number
    if payload.email is not None:
        student.email = str(payload.email)
    if payload.branch_id is not None:
        branch = _owned_branch(payload.branch_id, current, db)
        if branch.course_id != student.course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Şube bu derse ait değil.",
            )
        student.branch_id = payload.branch_id

    db.commit()
    db.refresh(student)

    return StudentOut(
        id=student.id,
        full_name=student.full_name,
        student_number=student.student_number,
        email=student.email,
        course_id=student.course_id,
        branch_id=student.branch_id,
        photo_path=f"/uploads/students/{Path(student.photo_path).name}" if student.photo_path else None,
        has_face_encoding=bool(student.face_encoding),
        created_at=student.created_at,
    )


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    student = _owned_student(student_id, current, db)
    if student.photo_path:
        try:
            Path(student.photo_path).unlink(missing_ok=True)
        except OSError:
            pass
    db.delete(student)
    db.commit()
