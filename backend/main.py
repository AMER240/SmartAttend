"""
SmartAttend – FastAPI application entry point.

Implements the API contract specified in the project brief:

    POST /students/                      – create a student (multipart: photo + ids)
    GET  /students/                      – list all students (helper for UI)
    GET  /courses/                       – list all courses
    POST /courses/                       – create a course (helper for UI)
    POST /sessions/start                 – open a new attendance session
    POST /sessions/end/{session_id}      – close session, fill in 'Absent' rows
    GET  /sessions/                      – list sessions (helper for UI)
    GET  /sessions/{session_id}/log      – get the attendance log for a session
    POST /attendance/live_match          – match a frame/encoding against the DB
    PUT  /attendance/override            – professor manual override (Absent/Present)

Run with:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import List

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as SASession

from backend import schemas
from backend.ai_engine import face_matcher
from backend.database import get_db, init_db
from backend.models import (
    AttendanceLog,
    Course,
    Session as ClassSession,
    Student,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smartattend")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SmartAttend API",
    version="1.0.0",
    description=(
        "Automated, web-based attendance management API powered by FastAPI, "
        "SQLAlchemy/PostgreSQL and OpenCV face recognition."
    ),
)

# Streamlit runs on :8501 by default; allow it (and any localhost dev tool).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup_event() -> None:
    """Initialise tables once at startup. Failure is logged but non-fatal."""
    ok = init_db()
    if not ok:
        logger.warning(
            "Database is unreachable – API will start but DB-backed routes "
            "will return 503 until the connection is restored."
        )


@app.get("/", tags=["health"])
def root() -> dict:
    return {
        "service": "SmartAttend API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
def health(db: SASession = Depends(get_db)) -> dict:
    try:
        db.query(Course).limit(1).all()
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError as exc:
        logger.error("Health check DB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database unreachable")


# ===========================================================================
# Students
# ===========================================================================


@app.post(
    "/students/",
    response_model=schemas.StudentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["students"],
)
async def create_student(
    student_id: str = Form(..., description="Unique student number, e.g. 2021001"),
    full_name: str = Form(...),
    photo: UploadFile = File(
        ..., description="A clear face photo (JPG/PNG) – encoded server-side."
    ),
    db: SASession = Depends(get_db),
):
    """
    Register a new student. The uploaded photo is converted into a 128-d face
    encoding and persisted as binary so it can be matched at attendance time.
    """
    if db.query(Student).filter(Student.student_id == student_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Student {student_id} already exists.",
        )

    try:
        image_bytes = await photo.read()
    except Exception as exc:
        logger.exception("Could not read uploaded photo: %s", exc)
        raise HTTPException(status_code=400, detail="Could not read uploaded photo.")

    try:
        encoding = face_matcher.encode_face_from_bytes(image_bytes)
    except RuntimeError as exc:
        # face_recognition / cv2 not installed
        raise HTTPException(status_code=503, detail=str(exc))

    if encoding is None:
        raise HTTPException(
            status_code=400,
            detail="No face detected in the provided photo. Please upload a clearer image.",
        )

    student = Student(
        student_id=student_id,
        full_name=full_name,
        face_encoding=face_matcher.serialize_encoding(encoding),
    )
    try:
        db.add(student)
        db.commit()
        db.refresh(student)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while creating student: %s", exc)
        raise HTTPException(status_code=500, detail="Could not persist student.")

    return schemas.StudentOut(
        student_id=student.student_id,
        full_name=student.full_name,
        has_face_encoding=student.face_encoding is not None,
    )


@app.get("/students/", response_model=List[schemas.StudentOut], tags=["students"])
def list_students(db: SASession = Depends(get_db)):
    students = db.query(Student).order_by(Student.student_id).all()
    return [
        schemas.StudentOut(
            student_id=s.student_id,
            full_name=s.full_name,
            has_face_encoding=s.face_encoding is not None,
        )
        for s in students
    ]


# ===========================================================================
# Courses
# ===========================================================================


@app.get("/courses/", response_model=List[schemas.CourseOut], tags=["courses"])
def list_courses(db: SASession = Depends(get_db)):
    return db.query(Course).order_by(Course.course_code).all()


@app.get(
    "/courses/{course_id}",
    response_model=schemas.CourseOut,
    tags=["courses"],
)
def get_course(course_id: int, db: SASession = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    return course


@app.post(
    "/courses/",
    response_model=schemas.CourseOut,
    status_code=status.HTTP_201_CREATED,
    tags=["courses"],
)
def create_course(payload: schemas.CourseCreate, db: SASession = Depends(get_db)):
    if db.query(Course).filter(Course.course_code == payload.course_code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course code '{payload.course_code}' already exists.",
        )
    course = Course(course_name=payload.course_name, course_code=payload.course_code)
    try:
        db.add(course)
        db.commit()
        db.refresh(course)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while creating course: %s", exc)
        raise HTTPException(status_code=500, detail="Could not persist course.")
    return course


@app.delete(
    "/courses/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["courses"],
)
def delete_course(course_id: int, db: SASession = Depends(get_db)):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    try:
        db.delete(course)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while deleting course: %s", exc)
        raise HTTPException(status_code=500, detail="Could not delete course.")
    return None


@app.delete(
    "/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["students"],
)
def delete_student(student_id: str, db: SASession = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    try:
        db.delete(student)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while deleting student: %s", exc)
        raise HTTPException(status_code=500, detail="Could not delete student.")
    return None


# ===========================================================================
# Sessions
# ===========================================================================


@app.get("/sessions/", response_model=List[schemas.SessionOut], tags=["sessions"])
def list_sessions(db: SASession = Depends(get_db)):
    return (
        db.query(ClassSession)
        .order_by(ClassSession.session_date.desc(), ClassSession.session_id.desc())
        .all()
    )


@app.get(
    "/sessions/active",
    response_model=List[schemas.SessionOut],
    tags=["sessions"],
)
def list_active_sessions(db: SASession = Depends(get_db)):
    """List only currently-running sessions (used by the React dashboard)."""
    return (
        db.query(ClassSession)
        .filter(ClassSession.is_active.is_(True))
        .order_by(ClassSession.session_id.desc())
        .all()
    )


@app.get(
    "/sessions/{session_id}",
    response_model=schemas.SessionOut,
    tags=["sessions"],
)
def get_session(session_id: int, db: SASession = Depends(get_db)):
    session = (
        db.query(ClassSession).filter(ClassSession.session_id == session_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["sessions"],
)
def delete_session(session_id: int, db: SASession = Depends(get_db)):
    session = (
        db.query(ClassSession).filter(ClassSession.session_id == session_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    try:
        db.delete(session)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while deleting session: %s", exc)
        raise HTTPException(status_code=500, detail="Could not delete session.")
    return None


@app.post(
    "/sessions/start",
    response_model=schemas.SessionOut,
    status_code=status.HTTP_201_CREATED,
    tags=["sessions"],
)
def start_session(payload: schemas.SessionCreate, db: SASession = Depends(get_db)):
    """
    Open a new attendance session for a course. If an active session already
    exists for the same course on the same day, return that one instead of
    creating a duplicate.
    """
    course = db.query(Course).filter(Course.course_id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    existing = (
        db.query(ClassSession)
        .filter(
            ClassSession.course_id == payload.course_id,
            ClassSession.is_active.is_(True),
        )
        .first()
    )
    if existing:
        return existing

    session = ClassSession(
        course_id=payload.course_id,
        session_date=date.today(),
        is_active=True,
    )
    try:
        db.add(session)
        db.commit()
        db.refresh(session)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while starting session: %s", exc)
        raise HTTPException(status_code=500, detail="Could not start session.")
    return session


@app.post(
    "/sessions/end/{session_id}",
    response_model=schemas.SessionOut,
    tags=["sessions"],
)
def end_session(session_id: int, db: SASession = Depends(get_db)):
    """
    Close a session. Any registered student who does NOT yet have a 'Present'
    log row will automatically receive an 'Absent' row.
    """
    session = (
        db.query(ClassSession).filter(ClassSession.session_id == session_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if not session.is_active:
        return session

    try:
        # Build the set of students already marked Present for this session.
        present_ids = {
            row[0]
            for row in db.query(AttendanceLog.student_id)
            .filter(
                AttendanceLog.session_id == session_id,
                AttendanceLog.status == "Present",
            )
            .all()
        }

        # Fill in 'Absent' for every other student in the system.
        all_students = db.query(Student.student_id).all()
        for (sid,) in all_students:
            if sid in present_ids:
                continue
            existing_log = (
                db.query(AttendanceLog)
                .filter(
                    AttendanceLog.session_id == session_id,
                    AttendanceLog.student_id == sid,
                )
                .first()
            )
            if existing_log is None:
                db.add(
                    AttendanceLog(
                        session_id=session_id,
                        student_id=sid,
                        status="Absent",
                        check_in_time=datetime.utcnow(),
                    )
                )

        session.is_active = False
        db.commit()
        db.refresh(session)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while ending session: %s", exc)
        raise HTTPException(status_code=500, detail="Could not end session.")
    return session


@app.get(
    "/sessions/{session_id}/log",
    response_model=List[schemas.AttendanceLogOut],
    tags=["sessions"],
)
def get_session_log(session_id: int, db: SASession = Depends(get_db)):
    """Return every attendance row (Present + Absent) for a given session."""
    session = (
        db.query(ClassSession).filter(ClassSession.session_id == session_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    rows = (
        db.query(AttendanceLog, Student.full_name)
        .join(Student, Student.student_id == AttendanceLog.student_id)
        .filter(AttendanceLog.session_id == session_id)
        .order_by(AttendanceLog.check_in_time.asc().nullslast())
        .all()
    )
    return [
        schemas.AttendanceLogOut(
            log_id=log.log_id,
            session_id=log.session_id,
            student_id=log.student_id,
            full_name=full_name,
            status=log.status,
            check_in_time=log.check_in_time,
        )
        for log, full_name in rows
    ]


# ===========================================================================
# Attendance – live match + manual override
# ===========================================================================


def _load_known_encodings(db: SASession):
    """Helper: return ([encodings], [student_ids]) of every student that has
    a face encoding registered in the DB."""
    students = db.query(Student).filter(Student.face_encoding.isnot(None)).all()
    encodings, ids = [], []
    for s in students:
        try:
            encodings.append(face_matcher.deserialize_encoding(s.face_encoding))
            ids.append(s.student_id)
        except Exception:  # corrupt encoding row – skip but log
            logger.warning("Skipping unreadable encoding for %s", s.student_id)
    return encodings, ids


def _mark_present(db: SASession, session_id: int, student_id: str) -> AttendanceLog:
    """Insert or update the student's row for this session as 'Present'."""
    log = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.session_id == session_id,
            AttendanceLog.student_id == student_id,
        )
        .first()
    )
    now = datetime.utcnow()
    if log is None:
        log = AttendanceLog(
            session_id=session_id,
            student_id=student_id,
            status="Present",
            check_in_time=now,
        )
        db.add(log)
    else:
        log.status = "Present"
        log.check_in_time = now
    db.commit()
    db.refresh(log)
    return log


@app.post(
    "/attendance/live_match",
    response_model=schemas.LiveMatchResult,
    tags=["attendance"],
)
async def live_match(
    session_id: int = Form(...),
    frame: UploadFile = File(
        ..., description="A frame (JPG/PNG) captured from the classroom camera."
    ),
    db: SASession = Depends(get_db),
):
    """
    Match a single camera frame against every registered student. If a match
    is found within the tolerance, the student is recorded as 'Present' for
    the active session.
    """
    session = (
        db.query(ClassSession).filter(ClassSession.session_id == session_id).first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session is no longer active.")

    try:
        image_bytes = await frame.read()
    except Exception as exc:
        logger.exception("Could not read uploaded frame: %s", exc)
        raise HTTPException(status_code=400, detail="Could not read uploaded frame.")

    known_encodings, known_ids = _load_known_encodings(db)
    if not known_encodings:
        return schemas.LiveMatchResult(
            matched=False,
            message="No registered faces in the database yet.",
        )

    try:
        student_id, distance, message = face_matcher.match_image_bytes(
            image_bytes, known_encodings, known_ids
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if student_id is None:
        return schemas.LiveMatchResult(
            matched=False, distance=distance, message=message
        )

    student = db.query(Student).filter(Student.student_id == student_id).first()
    try:
        _mark_present(db, session.session_id, student_id)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while marking present: %s", exc)
        raise HTTPException(status_code=500, detail="Could not persist attendance.")

    return schemas.LiveMatchResult(
        matched=True,
        student_id=student_id,
        full_name=student.full_name if student else None,
        distance=distance,
        message="Student marked as Present.",
    )


@app.patch(
    "/attendance/{log_id}",
    response_model=schemas.AttendanceLogOut,
    tags=["attendance"],
)
def patch_attendance_status(
    log_id: int,
    payload: schemas.AttendanceStatus,
    db: SASession = Depends(get_db),
):
    """
    Update a single attendance row's status (used by React's manual marking
    UI on the Scanner page). Accepts both 'Present'/'Absent' and lowercase
    'present'/'absent'/'late' (lowercase is normalised to Title-case;
    'late' is treated as 'Present' since our schema only has two states).
    """
    log = db.query(AttendanceLog).filter(AttendanceLog.log_id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Attendance row not found.")

    raw_status = payload.status.strip().lower()
    if raw_status in ("present", "late"):
        new_status = "Present"
    elif raw_status == "absent":
        new_status = "Absent"
    else:
        raise HTTPException(
            status_code=400,
            detail="status must be one of: present, absent, late.",
        )

    try:
        log.status = new_status
        log.check_in_time = datetime.utcnow() if new_status == "Present" else None
        db.commit()
        db.refresh(log)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while patching attendance: %s", exc)
        raise HTTPException(status_code=500, detail="Could not update attendance.")

    student = db.query(Student).filter(Student.student_id == log.student_id).first()
    return schemas.AttendanceLogOut(
        log_id=log.log_id,
        session_id=log.session_id,
        student_id=log.student_id,
        full_name=student.full_name if student else None,
        status=log.status,
        check_in_time=log.check_in_time,
    )


@app.put(
    "/attendance/override",
    response_model=schemas.AttendanceLogOut,
    tags=["attendance"],
)
def override_attendance(
    payload: schemas.AttendanceOverride, db: SASession = Depends(get_db)
):
    """Professor-side manual override of an attendance record."""
    session = (
        db.query(ClassSession)
        .filter(ClassSession.session_id == payload.session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    student = (
        db.query(Student).filter(Student.student_id == payload.student_id).first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    log = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.session_id == payload.session_id,
            AttendanceLog.student_id == payload.student_id,
        )
        .first()
    )
    now = datetime.utcnow() if payload.status == "Present" else None
    try:
        if log is None:
            log = AttendanceLog(
                session_id=payload.session_id,
                student_id=payload.student_id,
                status=payload.status,
                check_in_time=now,
            )
            db.add(log)
        else:
            log.status = payload.status
            log.check_in_time = now
        db.commit()
        db.refresh(log)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("DB error while overriding attendance: %s", exc)
        raise HTTPException(status_code=500, detail="Could not update attendance.")

    return schemas.AttendanceLogOut(
        log_id=log.log_id,
        session_id=log.session_id,
        student_id=log.student_id,
        full_name=student.full_name,
        status=log.status,
        check_in_time=log.check_in_time,
    )


# ---------------------------------------------------------------------------
# Direct invocation: `python backend/main.py`
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
