from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.class_session import SessionStatus


class ClassSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    branch_id: int
    status: SessionStatus
    started_at: datetime
    ended_at: datetime | None = None


class ClassSessionWithStats(ClassSessionOut):
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    total_count: int = 0
    course_name: str | None = None
    course_code: str | None = None
    branch_name: str | None = None
    branch_code: str | None = None


class RecognizeResult(BaseModel):
    detected_faces: int
    matched_student_ids: list[int]
    newly_marked: list[int]


class DescriptorRequest(BaseModel):
    descriptor: list[float]  # 128-element float array from face-api.js


class KioskRecognizeResult(BaseModel):
    matched: bool
    name: str | None = None
    student_id: int | None = None


class EnrollDescriptorRequest(BaseModel):
    descriptor: list[float]  # 128-element float array from face-api.js
