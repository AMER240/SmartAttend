"""
Seed script — örnek veritabanı oluşturur.
Çalıştırmak: python -m app.seed
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.database import Base
from app.models import (
    Attendance,
    AttendanceStatus,
    CourseBranch,
    ClassSession,
    Course,
    SessionStatus,
    Student,
    Teacher,
)
from app.security import hash_password


def create_seed_data():
    settings = get_settings()
    engine = create_engine(settings.database_url, echo=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # Teacher oluştur
        teacher = Teacher(
            email="ogretmen@test.com",
            name="Test Öğretmen",
            password_hash=hash_password("test123"),
        )
        db.add(teacher)
        db.flush()

        # Kurslar oluştur
        courses = [
            Course(
                name="Bilgisayar Mühendisliğine Giriş",
                code="BM101",
                schedule=" Pazartesi 09:00-12:00",
                location="D1-101",
                teacher_id=teacher.id,
            ),
            Course(
                name="Veri Yapıları ve Algoritmalar",
                code="BM201",
                schedule=" Salı 13:00-16:00",
                location="D2-205",
                teacher_id=teacher.id,
            ),
            Course(
                name="Web Geliştirme",
                code="BM301",
                schedule=" Çarşamba 10:00-13:00",
                location="D3-301",
                teacher_id=teacher.id,
            ),
            Course(
                name="Yapay Zeka Temelleri",
                code="BM401",
                schedule=" Perşembe 14:00-17:00",
                location="D4-402",
                teacher_id=teacher.id,
            ),
        ]
        db.add_all(courses)
        db.flush()

        # Şubeler oluştur (her kurs için A ve B şubesi)
        branches = []
        for course in courses:
            for idx, branch_name in enumerate(["A", "B"]):
                branch = CourseBranch(
                    name=f"{course.code}-{branch_name}",
                    code=f"{course.code}{idx+1}",
                    course_id=course.id,
                )
                db.add(branch)
                branches.append(branch)
        db.flush()

        # Öğrenciler oluştur (her şube için 5 öğrenci)
        students = []
        student_names = [
            "Ahmet Yılmaz",
            "Ayşe Demir",
            "Mehmet Kaya",
            "Fatma Şahin",
            "Ali Çelik",
            "Zeynep Öztürk",
            "Mustafa Aydın",
            "Elif Yavuz",
            "Hakan Polat",
            "Sedanur Güneş",
        ]

        for idx, branch in enumerate(branches):
            for i, name in enumerate(student_names[:5]):
                student = Student(
                    full_name=f"{name} {idx+1}",
                    student_number=f"2024{idx:02d}{i:03d}",
                    email=f"{name.lower().replace(' ', '.')}{idx}{i}@ogr.edu.tr",
                    course_id=branch.course_id,
                    branch_id=branch.id,
                    # Boş placeholder - yüz tanıma için sonra doldurulacak
                    face_descriptor_faceapi=None,
                )
                db.add(student)
                students.append(student)
        db.flush()

        # Class Sessions oluştur (geçmiş ve bugün)
        base_date = datetime.now(timezone.utc)
        sessions = []
        for course in courses:
            # Bugün için aktif oturum
            today_session = ClassSession(
                course_id=course.id,
                branch_id=course.branches[0].id,
                started_at=base_date,
                status=SessionStatus.ACTIVE,
            )
            db.add(today_session)
            sessions.append(today_session)
            db.flush()

            # Geçmiş oturumlar (son 7 gün)
            for day_offset in range(1, 8):
                past_date = base_date - timedelta(days=day_offset)
                past_session = ClassSession(
                    course_id=course.id,
                    branch_id=course.branches[0].id,
                    started_at=past_date,
                    ended_at=past_date + timedelta(hours=2),
                    status=SessionStatus.ENDED,
                )
                db.add(past_session)
                sessions.append(past_session)
        db.flush()

        # Geçmiş yoklamalar oluştur
        attendance_records = []
        for session in sessions[:-len(courses)]:  # Bugününkiler hariç
            for student in students[:10]:  # İlk 10 öğrenci
                # Rastgele yoklama durumu
                import random
                statuses = [
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.PRESENT,
                    AttendanceStatus.ABSENT,
                    AttendanceStatus.LATE,
                    AttendanceStatus.PRESENT,
                ]
                status = random.choice(statuses)

                att = Attendance(
                    session_id=session.id,
                    student_id=student.id,
                    status=status,
                    marked_at=session.started_at + timedelta(minutes=random.randint(5, 30)),
                    auto_detected=status == AttendanceStatus.PRESENT,
                )
                db.add(att)
                attendance_records.append(att)

            db.commit()

        print("\n[OK] Veritabani basariyla olusturuldu!")
        print(f"   - {len(courses)} kurs")
        print(f"   - {len(branches)} sube")
        print(f"   - {len(students)} ogrenci")
        print(f"   - {len(sessions)} oturum")
        print(f"   - {len(attendance_records)} yoklama kaydi")
        print(f"\n   Giris bilgileri:")
        print(f"   Email: ogretmen@test.com")
        print(f"   Sifre: test123")

    except Exception as e:
        db.rollback()
        print(f"\n[HATA]: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_seed_data()