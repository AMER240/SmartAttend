from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_teacher
from app.models.teacher import Teacher
from app.schemas.auth import TeacherOut, TeacherRegister, TeacherUpdate, TokenResponse
from app.security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: TeacherRegister, db: Session = Depends(get_db)):
    existing = db.query(Teacher).filter(Teacher.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu e-posta zaten kayıtlı.")

    teacher = Teacher(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    token = create_access_token(str(teacher.id))
    return TokenResponse(access_token=token, teacher=TeacherOut.model_validate(teacher))


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.email == form.username).first()
    if not teacher or not verify_password(form.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı.",
        )
    token = create_access_token(str(teacher.id))
    return TokenResponse(access_token=token, teacher=TeacherOut.model_validate(teacher))


@router.get("/me", response_model=TeacherOut)
def me(current: Teacher = Depends(get_current_teacher)):
    return current


@router.patch("/me", response_model=TeacherOut)
def update_me(
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if payload.email and payload.email != current.email:
        clash = db.query(Teacher).filter(Teacher.email == payload.email, Teacher.id != current.id).first()
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu e-posta başka bir hesapta kayıtlı.")
        current.email = payload.email
    if payload.name is not None:
        current.name = payload.name
    if payload.password:
        current.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(current)
    return current
