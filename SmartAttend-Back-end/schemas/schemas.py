from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class StudentBase(BaseModel):
    student_number: str
    name: str

class StudentCreate(StudentBase):
    pass

class Student(StudentBase):
    id: int
    class Config:
        orm_mode = True

class CourseBase(BaseModel):
    name: str
    code: str

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    class Config:
        orm_mode = True

class SessionBase(BaseModel):
    course_id: int

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    is_active: bool
    class Config:
        orm_mode = True

class AttendanceBase(BaseModel):
    session_id: int
    student_id: int
    status: str

class AttendanceUpdate(BaseModel):
    session_id: int
    student_id: int
    status: str

class Attendance(AttendanceBase):
    id: int
    timestamp: datetime
    class Config:
        orm_mode = True

class AttendanceReport(BaseModel):
    student_name: str
    student_number: str
    status: str
    timestamp: Optional[datetime]
