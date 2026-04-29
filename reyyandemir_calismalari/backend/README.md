# SmartAttend Backend

SmartAttend yoklama sisteminin FastAPI tabanlı backend'i.

## Stack
- FastAPI + Uvicorn
- SQLAlchemy 2.0 (varsayılan: SQLite. Postgres için `DATABASE_URL` env)
- `face_recognition` (dlib) + Pillow + OpenCV
- JWT (python-jose) + bcrypt

## Hızlı Başlangıç (Windows, Python 3.11+)

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

Sunucu `0.0.0.0:8000` üzerinde çalışır. Dokümanlar: `http://<lan-ip>:8000/docs`.

> **dlib/face_recognition kurulum notu:** Windows'ta `dlib` derlenmesi için
> Visual C++ build tools gerekir. `pip install face-recognition` başarısız
> olursa `cmake`'i kur ya da prebuilt wheel kullan
> (`pip install dlib-bin`).

## Ortam Değişkenleri (`.env`)

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./smartattend.db` | DB bağlantı URL'i |
| `JWT_SECRET` | `change-me-in-production` | JWT imza anahtarı |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRES_MINUTES` | `10080` (7 gün) | |
| `FACE_MATCH_TOLERANCE` | `0.5` | Düşürünce daha sıkı eşleşme |
| `CORS_ORIGINS` | localhost:3000 / 127.0.0.1:3000 | Frontend kaynakları |

## API

Tüm `/auth/*` ve `/ping` dışındaki uçlar `Authorization: Bearer <token>` ister.

### Auth
| Method | Path | İşlev |
| --- | --- | --- |
| POST | `/auth/register` | Hoca oluştur + JWT döndür |
| POST | `/auth/login` | OAuth2 password → JWT |
| GET | `/auth/me` | Mevcut hoca |
| PATCH | `/auth/me` | Profil güncelle (name/email/password) |

### Dersler & Şubeler
| Method | Path | İşlev |
| --- | --- | --- |
| GET | `/courses` | Hocaya ait dersler |
| POST | `/courses` | Ders oluştur (otomatik A şubesi eklenir) |
| GET | `/courses/{id}` | Ders + şubeler + sayaçlar |
| PATCH | `/courses/{id}` | Ders güncelle (name/code/schedule/location) |
| DELETE | `/courses/{id}` | Dersi cascade silme |
| GET | `/courses/{id}/branches` | Şubeler + öğrenci sayaçları |
| POST | `/courses/{id}/branches` | Şube ekle |
| GET | `/courses/{id}/branches/{bid}` | Şube detayı |
| PATCH | `/courses/{id}/branches/{bid}` | Şubeyi güncelle |
| DELETE | `/courses/{id}/branches/{bid}` | Şubeyi sil (en az 1 şube kalmalı) |

### Öğrenciler
| Method | Path | İşlev |
| --- | --- | --- |
| GET | `/students` | Hocanın tüm öğrencileri |
| GET | `/courses/{id}/students` | Bir derste tüm şubelerin öğrencileri |
| GET | `/branches/{id}/students` | Bir şubedeki öğrenciler |
| POST | `/courses/{id}/students` | Öğrenci kaydı (multipart: full_name, student_number, branch_id, photo, email?) |
| PATCH | `/students/{id}` | Öğrenciyi güncelle |
| DELETE | `/students/{id}` | Öğrenciyi sil |

### Oturumlar / Yoklama
| Method | Path | İşlev |
| --- | --- | --- |
| POST | `/branches/{id}/sessions` | Şube için yeni oturum başlat |
| GET | `/branches/{id}/sessions` | Şubenin tüm oturumları |
| GET | `/courses/{id}/sessions` | Dersin tüm oturumları |
| GET | `/sessions` | Tüm oturumlar |
| GET | `/sessions/active` | Aktif oturumlar |
| GET | `/sessions/{id}` | Oturum + sayaçlar |
| POST | `/sessions/{id}/end` | Oturumu kapat |
| DELETE | `/sessions/{id}` | Oturumu sil |
| GET | `/sessions/{id}/attendance` | Yoklama listesi |
| PATCH | `/attendance/{id}` | Manuel durum güncelle |
| POST | `/sessions/{id}/recognize` | Kareyi yükle → otomatik eşleşenleri PRESENT yap |

## Veri Modeli

```
Teacher (1)──*── Course
                   ├──*── CourseBranch ──*── Student ──*── Attendance ──1── ClassSession
                   └──*── ClassSession (her şube için ayrı)
```

`Attendance` tablosunda `(session_id, student_id)` unique. Bir oturum
başlatıldığında o şubenin tüm öğrencileri için `absent` satırları oluşturulur;
recognize endpoint'i karelerde tanınanları `present` + `auto_detected=true`
olarak günceller.

## DB Sıfırlama

SQLite kullanıyorsanız, şema değiştiğinde:

```bash
del smartattend.db    # Windows
# rm smartattend.db   # macOS/Linux
python -m app.main    # tablolar yeniden oluşur
```
