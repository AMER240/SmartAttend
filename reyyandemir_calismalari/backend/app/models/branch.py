from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CourseBranch(Base):
    __tablename__ = "course_branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(64))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course: Mapped["Course"] = relationship(back_populates="branches")  # noqa: F821
    students: Mapped[list["Student"]] = relationship(  # noqa: F821
        back_populates="branch", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["ClassSession"]] = relationship(  # noqa: F821
        back_populates="branch", cascade="all, delete-orphan"
    )
