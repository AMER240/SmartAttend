from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    student_number: str
    email: str | None = None
    course_id: int
    branch_id: int
    photo_path: str | None = None
    has_face_encoding: bool = False
    created_at: datetime


class StudentWithStats(StudentOut):
    branch_name: str | None = None
    branch_code: str | None = None
    course_name: str | None = None
    course_code: str | None = None
    total_absences: int = 0
    attendance_rate: float = 0.0


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    student_number: str | None = Field(default=None, min_length=1, max_length=64)
    email: EmailStr | None = None
    branch_id: int | None = None
