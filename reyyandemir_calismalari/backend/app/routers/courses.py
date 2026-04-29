from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_teacher
from app.models import ClassSession, Course, CourseBranch, Student, Teacher
from app.schemas.branch import CourseBranchCreate, CourseBranchOut, CourseBranchUpdate, CourseBranchWithStats
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate, CourseWithStats


router = APIRouter(prefix="/courses", tags=["courses"])


def _get_owned_course(course_id: int, teacher: Teacher, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == course_id, Course.teacher_id == teacher.id).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ders bulunamadı.")
    return course


def _get_owned_branch(course_id: int, branch_id: int, teacher: Teacher, db: Session) -> CourseBranch:
    branch = (
        db.query(CourseBranch)
        .join(Course)
        .filter(CourseBranch.id == branch_id, CourseBranch.course_id == course_id, Course.teacher_id == teacher.id)
        .first()
    )
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şube bulunamadı.")
    return branch


@router.get("", response_model=list[CourseWithStats])
def list_courses(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    student_counts = dict(
        db.execute(
            select(Student.course_id, func.count(Student.id)).group_by(Student.course_id)
        ).all()
    )
    session_counts = dict(
        db.execute(
            select(ClassSession.course_id, func.count(ClassSession.id)).group_by(ClassSession.course_id)
        ).all()
    )
    branch_student_counts = dict(
        db.execute(
            select(Student.branch_id, func.count(Student.id)).group_by(Student.branch_id)
        ).all()
    )
    courses = db.query(Course).filter(Course.teacher_id == current.id).order_by(Course.created_at.desc()).all()
    return [
        CourseWithStats(
            id=c.id,
            name=c.name,
            code=c.code,
            schedule=c.schedule,
            location=c.location,
            teacher_id=c.teacher_id,
            created_at=c.created_at,
            student_count=student_counts.get(c.id, 0),
            session_count=session_counts.get(c.id, 0),
            branches=[
                CourseBranchWithStats(
                    id=b.id,
                    name=b.name,
                    code=b.code,
                    course_id=b.course_id,
                    created_at=b.created_at,
                    student_count=branch_student_counts.get(b.id, 0),
                )
                for b in c.branches
            ],
        )
        for c in courses
    ]


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = Course(
        name=payload.name,
        code=payload.code,
        schedule=payload.schedule,
        location=payload.location,
        teacher_id=current.id,
    )
    db.add(course)
    db.flush()

    default_branch = CourseBranch(name="A Şubesi", code="A", course_id=course.id)
    db.add(default_branch)

    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseWithStats)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _get_owned_course(course_id, current, db)
    student_count = db.query(func.count(Student.id)).filter(Student.course_id == course.id).scalar() or 0
    session_count = (
        db.query(func.count(ClassSession.id)).filter(ClassSession.course_id == course.id).scalar() or 0
    )
    branch_student_counts = dict(
        db.execute(
            select(Student.branch_id, func.count(Student.id)).group_by(Student.branch_id)
        ).all()
    )
    return CourseWithStats(
        id=course.id,
        name=course.name,
        code=course.code,
        schedule=course.schedule,
        location=course.location,
        teacher_id=course.teacher_id,
        created_at=course.created_at,
        student_count=student_count,
        session_count=session_count,
        branches=[
            CourseBranchWithStats(
                id=b.id,
                name=b.name,
                code=b.code,
                course_id=b.course_id,
                created_at=b.created_at,
                student_count=branch_student_counts.get(b.id, 0),
            )
            for b in course.branches
        ],
    )


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _get_owned_course(course_id, current, db)
    if payload.name is not None:
        course.name = payload.name
    if payload.code is not None:
        course.code = payload.code
    if payload.schedule is not None:
        course.schedule = payload.schedule
    if payload.location is not None:
        course.location = payload.location
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _get_owned_course(course_id, current, db)
    db.delete(course)
    db.commit()


@router.post("/{course_id}/branches", response_model=CourseBranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    course_id: int,
    payload: CourseBranchCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _get_owned_course(course_id, current, db)
    branch = CourseBranch(name=payload.name, code=payload.code, course_id=course.id)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.get("/{course_id}/branches", response_model=list[CourseBranchWithStats])
def list_branches(
    course_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    course = _get_owned_course(course_id, current, db)
    branch_student_counts = dict(
        db.execute(
            select(Student.branch_id, func.count(Student.id)).group_by(Student.branch_id)
        ).all()
    )
    branches = db.query(CourseBranch).filter(CourseBranch.course_id == course.id).order_by(CourseBranch.created_at).all()
    return [
        CourseBranchWithStats(
            id=b.id,
            name=b.name,
            code=b.code,
            course_id=b.course_id,
            created_at=b.created_at,
            student_count=branch_student_counts.get(b.id, 0),
        )
        for b in branches
    ]


@router.get("/{course_id}/branches/{branch_id}", response_model=CourseBranchWithStats)
def get_branch(
    course_id: int,
    branch_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    branch = _get_owned_branch(course_id, branch_id, current, db)
    student_count = db.query(func.count(Student.id)).filter(Student.branch_id == branch.id).scalar() or 0
    return CourseBranchWithStats(
        id=branch.id,
        name=branch.name,
        code=branch.code,
        course_id=branch.course_id,
        created_at=branch.created_at,
        student_count=student_count,
    )


@router.patch("/{course_id}/branches/{branch_id}", response_model=CourseBranchOut)
def update_branch(
    course_id: int,
    branch_id: int,
    payload: CourseBranchUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    branch = _get_owned_branch(course_id, branch_id, current, db)
    if payload.name is not None:
        branch.name = payload.name
    if payload.code is not None:
        branch.code = payload.code
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/{course_id}/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    course_id: int,
    branch_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    branch = _get_owned_branch(course_id, branch_id, current, db)
    branch_count = db.query(func.count(CourseBranch.id)).filter(CourseBranch.course_id == branch.course_id).scalar() or 0
    if branch_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bir derste en az bir şube olmalıdır.",
        )
    db.delete(branch)
    db.commit()
