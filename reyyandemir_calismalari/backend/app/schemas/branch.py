from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseBranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)


class CourseBranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=64)


class CourseBranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    course_id: int
    created_at: datetime


class CourseBranchWithStats(CourseBranchOut):
    student_count: int = 0
