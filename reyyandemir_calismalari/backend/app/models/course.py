from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(64))
    schedule: Mapped[str] = mapped_column(String(255), default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    teacher: Mapped["Teacher"] = relationship(back_populates="courses")  # noqa: F821
    branches: Mapped[list["CourseBranch"]] = relationship(  # noqa: F821
        back_populates="course", cascade="all, delete-orphan"
    )
    students: Mapped[list["Student"]] = relationship(  # noqa: F821
        back_populates="course", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["ClassSession"]] = relationship(  # noqa: F821
        back_populates="course", cascade="all, delete-orphan"
    )
