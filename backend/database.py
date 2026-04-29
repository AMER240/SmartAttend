"""
SQLAlchemy engine, session and Base configuration for SmartAttend.

Reads DATABASE_URL from environment variables (or .env via python-dotenv).
Falls back to a local PostgreSQL connection string if nothing is configured.

Example:
    postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/smartattend
"""

from __future__ import annotations

import os
import logging
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, declarative_base

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

DEFAULT_DB_URL = "postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/smartattend"
DATABASE_URL: str = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# pool_pre_ping ensures dropped connections are re-established gracefully.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a transactional DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    """Context manager for non-FastAPI use (scripts, AI engine workers)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> bool:
    """
    Create all tables defined on the Base metadata.
    Returns True on success, False if the database is unreachable so the
    application can still start in a degraded mode.
    """
    # Import models here so SQLAlchemy registers them with Base.metadata.
    from backend import models  # noqa: F401

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
        return True
    except SQLAlchemyError as exc:
        logger.error("Could not initialize database tables: %s", exc)
        return False
