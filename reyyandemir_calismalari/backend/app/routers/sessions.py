from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
    SessionStatus,
    Student,
    Teacher,
)
from app.schemas.attendance import AttendanceUpdate, AttendanceWithStudent
from app.schemas.class_session import (
    ClassSessionOut,
    ClassSessionWithStats,
    RecognizeResult,
)
from app.services import face_service


router = APIRouter(tags=["sessions"])
settings = get_settings()


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


def _owned_course(course_id: int, teacher: Teacher, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == course_id, Course.teacher_id == teacher.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ders bulunamadı.")
    return course


def _owned_session(session_id: int, teacher: Teacher, db: Session) -> ClassSession:
    cs = (
        db.query(ClassSession)
        .join(Course, ClassSession.course_id == Course.id)
        .filter(ClassSession.id == session_id, Course.teacher_id == teacher.id)
        .first()
    )
    if not cs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oturum bulunamadı.")
    return cs


def _owned_attendance(attendance_id: int, teacher: Teacher, db: Session) -> Attendance:
    att = (
        db.query(Attendance)
        .join(ClassSession, Attendance.session_id == ClassSession.id)
        .join(Course, ClassSession.course_id == Course.id)
        .filter(Attendance.id == attendance_id, Course.teacher_id == teacher.id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yoklama kaydı bulunamadı.")
    return att


def _session_with_stats(session: ClassSession, db: Session) -> ClassSessionWithStats:
    counts = dict(
        db.execute(
            select(Attendance.status, func.count(Attendance.id))
            .where(Attendance.session_id == session.id)
            .group_by(Attendance.status)
        ).all()
    )
    present = counts.get(AttendanceStatus.PRESENT, 0)
    absent = counts.get(AttendanceStatus.ABSENT, 0)
    late = counts.get(AttendanceStatus.LATE, 0)
    return ClassSessionWithStats(
        id=session.id,
        course_id=session.course_id,
        branch_id=session.branch_id,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        present_count=present,
        absent_count=absent,
        late_count=late,
        total_count=present + absent + late,
        course_name=session.course.name if session.course else None,
        course_code=session.course.code if session.course else None,
        branch_name=session.branch.name if session.branch else None,
        branch_code=session.branch.code if session.branch else None,
    )


@router.post(
    "/branches/{branch_id}/sessions",
    response_model=ClassSessionOut,
    status_code=status.HTTP_201_CREATED,
)
def start_branch_session(
    branch_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    branch = _owned_branch(branch_id, current, db)

    active = (
        db.query(ClassSession)
        .filter(
            ClassSession.branch_id == branch.id,
            ClassSession.status == SessionStatus.ACTIVE,
        )
        .first()
    )
    if active:
        return _session_with_stats(active, db)

    cs = ClassSession(course_id=branch.course_id, branch_id=branch.id, status=SessionStatus.ACTIVE)
    db.add(cs)
    db.flush()

    students = db.query(Student).filter(Student.branch_id == branch.id).all()
    for s in students:
        db.add(
            Attendance(
                session_id=cs.id,
                student_id=s.id,
                status=AttendanceStatus.ABSENT,
                auto_detected=False,
            )
        )
    db.commit()
    db.refresh(cs)
    return cs


@router.get("/branches/{branch_id}/sessions", response_model=list[ClassSessionWithStats])
def list_branch_sessions(
    branch_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _owned_branch(branch_id, current, db)
    sessions = (
        db.query(ClassSession)
        .filter(ClassSession.branch_id == branch_id)
        .order_by(ClassSession.started_at.desc())
        .all()
    )
    return [_session_with_stats(s, db) for s in sessions]


@router.get("/courses/{course_id}/sessions", response_model=list[ClassSessionWithStats])
def list_course_sessions(
    course_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _owned_course(course_id, current, db)
    sessions = (
        db.query(ClassSession)
        .filter(ClassSession.course_id == course_id)
        .order_by(ClassSession.started_at.desc())
        .all()
    )
    return [_session_with_stats(s, db) for s in sessions]


@router.get("/sessions", response_model=list[ClassSessionWithStats])
def list_all_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    sessions = (
        db.query(ClassSession)
        .join(Course, ClassSession.course_id == Course.id)
        .filter(Course.teacher_id == current.id)
        .order_by(ClassSession.started_at.desc())
        .all()
    )
    return [_session_with_stats(s, db) for s in sessions]


@router.get("/sessions/active", response_model=list[ClassSessionWithStats])
def list_active_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    sessions = (
        db.query(ClassSession)
        .join(Course, ClassSession.course_id == Course.id)
        .filter(Course.teacher_id == current.id, ClassSession.status == SessionStatus.ACTIVE)
        .order_by(ClassSession.started_at.desc())
        .all()
    )
    return [_session_with_stats(s, db) for s in sessions]


@router.get("/sessions/{session_id}", response_model=ClassSessionWithStats)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    cs = _owned_session(session_id, current, db)
    return _session_with_stats(cs, db)


@router.post("/sessions/{session_id}/end", response_model=ClassSessionWithStats)
def end_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    cs = _owned_session(session_id, current, db)
    if cs.status == SessionStatus.ENDED:
        return _session_with_stats(cs, db)
    cs.status = SessionStatus.ENDED
    cs.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cs)
    return _session_with_stats(cs, db)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    cs = _owned_session(session_id, current, db)
    db.delete(cs)
    db.commit()


@router.get("/sessions/{session_id}/attendance", response_model=list[AttendanceWithStudent])
def list_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _owned_session(session_id, current, db)
    rows = (
        db.query(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .filter(Attendance.session_id == session_id)
        .order_by(Student.full_name.asc())
        .all()
    )
    return [
        AttendanceWithStudent(
            id=att.id,
            session_id=att.session_id,
            student_id=att.student_id,
            status=att.status,
            auto_detected=att.auto_detected,
            marked_at=att.marked_at,
            student_name=st.full_name,
            student_number=st.student_number,
        )
        for att, st in rows
    ]


@router.patch("/attendance/{attendance_id}", response_model=AttendanceWithStudent)
def update_attendance(
    attendance_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    att = _owned_attendance(attendance_id, current, db)
    att.status = payload.status
    att.auto_detected = False
    att.marked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(att)
    student = db.query(Student).filter(Student.id == att.student_id).first()
    return AttendanceWithStudent(
        id=att.id,
        session_id=att.session_id,
        student_id=att.student_id,
        status=att.status,
        auto_detected=att.auto_detected,
        marked_at=att.marked_at,
        student_name=student.full_name if student else "",
        student_number=student.student_number if student else "",
    )


@router.post("/sessions/{session_id}/recognize", response_model=RecognizeResult)
async def recognize_frame(
    session_id: int,
    frame: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    cs = _owned_session(session_id, current, db)
    if cs.status != SessionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Oturum aktif değil.",
        )

    data = await frame.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kare boş.")

    students = (
        db.query(Student)
        .filter(Student.branch_id == cs.branch_id, Student.face_encoding.isnot(None))
        .all()
    )
    known = []
    for s in students:
        enc = face_service.encoding_from_json(s.face_encoding)
        if enc is not None:
            known.append((s.id, enc))

    matches = face_service.match_faces(data, known, settings.face_match_tolerance)

    matched_ids = {m.student_id for m in matches if m.student_id is not None}
    newly_marked: list[int] = []

    if matched_ids:
        existing = (
            db.query(Attendance)
            .filter(
                Attendance.session_id == session_id,
                Attendance.student_id.in_(matched_ids),
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for att in existing:
            if att.status != AttendanceStatus.PRESENT:
                att.status = AttendanceStatus.PRESENT
                att.auto_detected = True
                att.marked_at = now
                newly_marked.append(att.student_id)
        db.commit()

    return RecognizeResult(
        detected_faces=len(matches),
        matched_student_ids=sorted(matched_ids),
        newly_marked=sorted(newly_marked),
    )
