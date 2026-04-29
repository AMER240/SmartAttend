"""
Kiosk endpoints — public (no teacher auth).

Students open /kiosk/<session_id> in a browser, face-api.js runs client-side,
extracts a 128-D descriptor, and POSTs it here for server-side matching.

Descriptor model: face-api.js FaceNet128 — NOT interchangeable with the
server-side dlib encodings stored in `students.face_encoding`.
A separate column (`students.face_descriptor_faceapi`) holds the faceapi descriptors.

Enrollment flow (teacher-authenticated):
  PATCH /kiosk/students/{student_id}/enroll
  Body: { "descriptor": [float x 128] }
  The teacher opens a one-off enroll page, face-api.js extracts the descriptor,
  and the app saves it here.
"""

import json
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_teacher
from app.models import (
    Attendance,
    AttendanceStatus,
    ClassSession,
    SessionStatus,
    Student,
    Teacher,
)
from app.schemas.class_session import (
    EnrollDescriptorRequest,
    DescriptorRequest,
    KioskRecognizeResult,
)

router = APIRouter(prefix="/kiosk", tags=["kiosk"])

_THRESHOLD = 0.6  # Euclidean distance — face-api.js recommends ≤ 0.6


def _euclidean(a: list[float], b: list[float]) -> float:
    return float(np.linalg.norm(np.array(a, dtype=np.float32) - np.array(b, dtype=np.float32)))


# ---------------------------------------------------------------------------
# POST /kiosk/sessions/{session_id}/recognize
# Public — called by the student kiosk page every ~2 s
# ---------------------------------------------------------------------------
@router.post("/sessions/{session_id}/recognize", response_model=KioskRecognizeResult)
def kiosk_recognize(
    session_id: int,
    payload: DescriptorRequest,
    db: Session = Depends(get_db),
):
    cs = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not cs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oturum bulunamadı.")
    if cs.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Oturum aktif değil.")

    if len(payload.descriptor) != 128:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Descriptor 128 boyutlu olmalı.")

    students = (
        db.query(Student)
        .filter(Student.branch_id == cs.branch_id, Student.face_descriptor_faceapi.isnot(None))
        .all()
    )

    best_id: int | None = None
    best_dist = float("inf")

    for s in students:
        stored: list[float] = json.loads(s.face_descriptor_faceapi)  # type: ignore[arg-type]
        dist = _euclidean(payload.descriptor, stored)
        if dist < best_dist:
            best_dist = dist
            best_id = s.id

    if best_id is None or best_dist > _THRESHOLD:
        return KioskRecognizeResult(matched=False)

    # Mark attendance as PRESENT (idempotent)
    att = (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id, Attendance.student_id == best_id)
        .first()
    )
    if att and att.status != AttendanceStatus.PRESENT:
        att.status = AttendanceStatus.PRESENT
        att.auto_detected = True
        att.marked_at = datetime.now(timezone.utc)
        db.commit()

    student = db.query(Student).filter(Student.id == best_id).first()
    return KioskRecognizeResult(
        matched=True,
        name=student.full_name if student else None,
        student_id=best_id,
    )


# ---------------------------------------------------------------------------
# PATCH /kiosk/students/{student_id}/enroll
# Teacher-authenticated — saves a face-api.js descriptor for a student
# ---------------------------------------------------------------------------
@router.patch("/students/{student_id}/enroll", response_model=dict)
def kiosk_enroll(
    student_id: int,
    payload: EnrollDescriptorRequest,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if len(payload.descriptor) != 128:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Descriptor 128 boyutlu olmalı.")

    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Öğrenci bulunamadı.")

    student.face_descriptor_faceapi = json.dumps(payload.descriptor)
    db.commit()
    return {"ok": True, "student_id": student_id}
