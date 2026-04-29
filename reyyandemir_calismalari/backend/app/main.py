from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, courses, kiosk, sessions, students

settings = get_settings()


def _run_migrations() -> None:
    """Add columns that were introduced after the initial schema creation."""
    with engine.connect() as conn:
        for col_def in ("face_descriptor_faceapi TEXT",):
            col_name = col_def.split()[0]
            try:
                conn.execute(text(f"ALTER TABLE students ADD COLUMN {col_def}"))
                conn.commit()
            except Exception:
                # Column already exists — SQLite raises OperationalError
                conn.rollback()
                _ = col_name  # silence linter


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app import models  # noqa: F401  # ensure models are registered
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(students.router)
app.include_router(sessions.router)
app.include_router(kiosk.router)


@app.get("/ping", tags=["health"])
def ping():
    return {"status": "ok", "app": settings.app_name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
