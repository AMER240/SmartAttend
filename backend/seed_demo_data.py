"""
Populate the SmartAttend database with a couple of demo courses and students.

Useful for first-time setup so the Streamlit dashboard has something to show
before any real students are registered.

Run from the project root:
    python -m backend.seed_demo_data
"""

from __future__ import annotations

import logging
import random

from backend.ai_engine import face_matcher
from backend.database import init_db, session_scope
from backend.models import Course, Student

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


DEMO_COURSES = [
    {"course_name": "İleri Programlama Teknikleri", "course_code": "BIL301"},
    {"course_name": "Yapay Zekaya Giriş", "course_code": "YZ101"},
]

DEMO_STUDENTS = [
    {"student_id": "2021001", "full_name": "Ahmet Yılmaz"},
    {"student_id": "2021002", "full_name": "Ayşe Demir"},
    {"student_id": "2021003", "full_name": "Mehmet Kaya"},
]


def _fake_encoding_blob() -> bytes:
    """Random 128-d vector – good enough for UI smoke-testing."""
    try:
        import numpy as np

        vec = np.array([random.random() for _ in range(128)], dtype="float64")
    except ImportError:
        # Should not happen because numpy is a hard dependency, but be defensive.
        vec = [random.random() for _ in range(128)]
    return face_matcher.serialize_encoding(vec)


def seed() -> None:
    init_db()

    with session_scope() as db:
        for c in DEMO_COURSES:
            if not db.query(Course).filter(Course.course_code == c["course_code"]).first():
                db.add(Course(**c))
                logger.info("Inserted course %s", c["course_code"])

        for s in DEMO_STUDENTS:
            if not db.query(Student).filter(Student.student_id == s["student_id"]).first():
                db.add(
                    Student(
                        student_id=s["student_id"],
                        full_name=s["full_name"],
                        face_encoding=_fake_encoding_blob(),
                    )
                )
                logger.info("Inserted student %s", s["student_id"])

    logger.info("Demo data ready.")


if __name__ == "__main__":
    seed()
