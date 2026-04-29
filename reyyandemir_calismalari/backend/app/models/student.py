from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("course_id", "student_number", name="uq_course_student_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255))
    student_number: Mapped[str] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("course_branches.id", ondelete="CASCADE"))
    photo_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    face_encoding: Mapped[str | None] = mapped_column(Text, nullable=True)
    face_descriptor_faceapi: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course: Mapped["Course"] = relationship(back_populates="students")  # noqa: F821
    branch: Mapped["CourseBranch"] = relationship(back_populates="students")  # noqa: F821
    attendances: Mapped[list["Attendance"]] = relationship(  # noqa: F821
        back_populates="student", cascade="all, delete-orphan"
    )
