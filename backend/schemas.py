"""
Pydantic data-validation schemas (API contract) for SmartAttend.

These are the request / response shapes consumed by the FastAPI routes
declared in `backend/main.py`. The frontend (Streamlit) MUST send & expect
JSON that matches these schemas exactly.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Students ----------------------------------------------------------


class StudentBase(BaseModel):
    student_id: str = Field(..., examples=["2021001"])
    full_name: str = Field(..., examples=["Ahmet Yılmaz"])


class StudentCreate(StudentBase):
    """Used by POST /students/ (multipart form actually – see main.py).

    Kept here for documentation & potential JSON-only clients.
    """


class StudentOut(StudentBase):
    has_face_encoding: bool = False
    model_config = ConfigDict(from_attributes=True)


# ---------- Courses -----------------------------------------------------------


class CourseBase(BaseModel):
    course_name: str
    course_code: str


class CourseCreate(CourseBase):
    pass


class CourseOut(CourseBase):
    course_id: int
    model_config = ConfigDict(from_attributes=True)


# ---------- Sessions ----------------------------------------------------------


class SessionCreate(BaseModel):
    course_id: int


class SessionOut(BaseModel):
    session_id: int
    course_id: int
    session_date: date
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


# ---------- Attendance --------------------------------------------------------


class AttendanceStatus(BaseModel):
    """Status payload accepted by PATCH /attendance/{log_id}.

    Both Title-case ("Present" / "Absent") and lowercase ("present" /
    "absent" / "late") are accepted; the route normalises to Title-case
    before persisting. "late" is mapped to "Present" because the
    underlying schema only stores two states.
    """

    status: Literal["Present", "Absent", "present", "absent", "late"]


class AttendanceOverride(BaseModel):
    """Body of PUT /attendance/override – manual professor override."""

    session_id: int
    student_id: str
    status: Literal["Present", "Absent"] = "Present"


class LiveMatchEncoding(BaseModel):
    """Optional JSON body for /attendance/live_match when sending a pre-computed
    128-d face encoding instead of an image frame."""

    session_id: int
    encoding: List[float] = Field(..., min_length=128, max_length=128)


class LiveMatchResult(BaseModel):
    matched: bool
    student_id: Optional[str] = None
    full_name: Optional[str] = None
    distance: Optional[float] = None
    message: str = ""


class AttendanceLogOut(BaseModel):
    log_id: int
    session_id: int
    student_id: str
    full_name: Optional[str] = None
    status: str
    check_in_time: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
