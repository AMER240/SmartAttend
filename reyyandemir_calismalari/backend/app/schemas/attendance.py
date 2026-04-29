from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.attendance import AttendanceStatus


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    student_id: int
    status: AttendanceStatus
    auto_detected: bool
    marked_at: datetime


class AttendanceWithStudent(AttendanceOut):
    student_name: str
    student_number: str


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
