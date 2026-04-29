import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    ENDED = "ended"


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("course_branches.id", ondelete="CASCADE"))
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.ACTIVE, nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship(back_populates="sessions")  # noqa: F821
    branch: Mapped["CourseBranch"] = relationship(back_populates="sessions")  # noqa: F821
    attendances: Mapped[list["Attendance"]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
