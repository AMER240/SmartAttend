"""
SQLAlchemy ORM models for SmartAttend.

Schema follows the project specification:
    - Students      (student_id PK String, full_name, face_encoding LargeBinary)
    - Courses       (course_id PK Integer, course_name, course_code)
    - Sessions      (session_id PK Integer, course_id FK, session_date, is_active)
    - AttendanceLog (log_id PK Integer, session_id FK, student_id FK String,
                     status, check_in_time)
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import relationship

from backend.database import Base


class Student(Base):
    __tablename__ = "students"

    student_id = Column(String(50), primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    # Pickled numpy.ndarray (128-d) produced by face_recognition.face_encodings()
    face_encoding = Column(LargeBinary, nullable=True)

    attendance_logs = relationship(
        "AttendanceLog", back_populates="student", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Student {self.student_id} {self.full_name}>"


class Course(Base):
    __tablename__ = "courses"

    course_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    course_name = Column(String(255), nullable=False)
    course_code = Column(String(50), unique=True, nullable=False, index=True)

    sessions = relationship(
        "Session", back_populates="course", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Course {self.course_code} {self.course_name}>"


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    course_id = Column(
        Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False
    )
    session_date = Column(Date, nullable=False, default=date.today)
    is_active = Column(Boolean, nullable=False, default=True)

    course = relationship("Course", back_populates="sessions")
    attendance_logs = relationship(
        "AttendanceLog", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Session #{self.session_id} course={self.course_id} active={self.is_active}>"


class AttendanceLog(Base):
    __tablename__ = "attendance_log"

    log_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    session_id = Column(
        Integer, ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False
    )
    student_id = Column(
        String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False
    )
    status = Column(String(20), nullable=False, default="Absent")  # 'Present' | 'Absent'
    check_in_time = Column(DateTime, nullable=True, default=datetime.utcnow)

    session = relationship("Session", back_populates="attendance_logs")
    student = relationship("Student", back_populates="attendance_logs")

    def __repr__(self) -> str:
        return (
            f"<AttendanceLog session={self.session_id} student={self.student_id} "
            f"status={self.status}>"
        )
