from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseBranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    course_id: int
    created_at: datetime


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)
    schedule: str = Field(default="", max_length=255)
    location: str = Field(default="", max_length=255)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    schedule: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    schedule: str
    location: str
    teacher_id: int
    created_at: datetime


class CourseWithStats(CourseOut):
    student_count: int = 0
    session_count: int = 0
    branches: list[CourseBranchOut] = []
