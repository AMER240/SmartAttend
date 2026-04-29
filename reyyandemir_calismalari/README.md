# SmartAttend — Proje ve Mimari Dökümanı

> Yüz tanımalı (facial recognition) sınıf yoklama sistemi.
> FastAPI tabanlı bir REST API ve React 19 + Vite tabanlı bir SPA web istemcisinden oluşur.
> Hocalar tarayıcıdan oturum başlatır, kamerayı sınıfa doğrultur; backend `face_recognition`
> (dlib) ile her kareyi karşılaştırarak öğrencileri otomatik olarak `present` (mevcut) işaretler.

---

## 1. Proje Özeti ve Amacı

**SmartAttend**, sınıf ortamında manuel yoklama almanın yerini almayı hedefleyen bir
**yüz tanıma destekli yoklama otomasyon sistemidir.**

Kod tabanı incelendiğinde sistemin işleyişi şöyle özetlenebilir:

1. **Hoca (Teacher)** sisteme kayıt olup giriş yapar (JWT tabanlı kimlik doğrulama).
2. Hoca kendi **derslerini (Course)** ve her derse ait **şubeleri (CourseBranch)** oluşturur.
   Her ders oluşturulduğunda otomatik olarak "A Şubesi" eklenir
   ([backend/app/routers/courses.py:98](backend/app/routers/courses.py#L98)).
3. Her şubeye, fotoğraf ile birlikte **öğrenciler (Student)** kaydedilir. Backend, fotoğraftaki
   tek yüzü tespit edip 128 boyutlu bir **face encoding** üretir
   ([backend/app/services/face_service.py:23](backend/app/services/face_service.py#L23)) ve
   bu vektörü JSON olarak veritabanında saklar.
4. Hoca bir şube için **yoklama oturumu (ClassSession)** başlatır. Oturum açılırken
   o şubedeki tüm öğrenciler için otomatik olarak `ABSENT` (yok) durumunda `Attendance`
   kayıtları oluşturulur ([backend/app/routers/sessions.py:111](backend/app/routers/sessions.py#L111)).
5. **Tarayıcıdaki Scanner sayfası** kameradan periyodik olarak (≈ 2.5 sn) kareler çekip
   `POST /sessions/{id}/recognize` ucuna multipart olarak gönderir. Backend her karede
   yüzleri tespit edip kayıtlı öğrencilerle eşleştirir ve eşleşenleri `PRESENT` +
   `auto_detected=true` olarak günceller.
6. **İkinci bir tanıma yolu (Kiosk)**: Öğrenciler `/kiosk/<session_id>` sayfasına telefonlarından
   girip yüzlerini tarayarak kendi kendilerine yoklamaya katılabilir. Bu akışta yüz çıkarımı
   client-side `face-api.js` (FaceNet128) ile yapılır; descriptor sunucuya JSON olarak
   gönderilir ([backend/app/routers/kiosk.py](backend/app/routers/kiosk.py)).
7. Hoca oturum sırasında veya sonrasında her bir öğrencinin yoklama durumunu manuel olarak
   `present`/`absent`/`late` arasında değiştirebilir.

---

## 2. Teknoloji Yığını (Tech Stack)

### 2.1 Backend (`backend/requirements.txt`)

| Katman | Teknoloji | Sürüm |
| --- | --- | --- |
| Web Framework | **FastAPI** | 0.115.6 |
| ASGI Server | **Uvicorn** (`[standard]`) | 0.32.1 |
| ORM | **SQLAlchemy 2.0** (Declarative + `Mapped`) | 2.0.36 |
| Validasyon | **Pydantic v2** + `pydantic-settings` + `pydantic[email]` | 2.10.3 |
| Multipart upload | `python-multipart` | 0.0.19 |
| JWT | `python-jose[cryptography]` | 3.3.0 |
| Şifre hash | **bcrypt** | 4.2.1 |
| Görüntü I/O | **Pillow**, **OpenCV** (`opencv-python`) | 11.0.0 / 4.10.0.84 |
| Sayısal işlem | **NumPy** | 2.2.0 |
| **Yüz Tanıma** | **`face_recognition`** (dlib + HOG) | 1.3.0 |

### 2.2 Frontend (`web/package.json`)

| Katman | Teknoloji | Sürüm |
| --- | --- | --- |
| UI Library | **React 19** | ^19.0.0 |
| Dil | **TypeScript** | ~5.8.2 |
| Bundler / Dev Server | **Vite 6** + `@vitejs/plugin-react` | ^6.2.0 |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | ^4.1.14 |
| Routing | **React Router 7** | ^7.14.2 |
| Server State | **TanStack React Query 5** | ^5.62.7 |
| İkonlar | `lucide-react` | ^0.546.0 |
| Client-side Yüz Tanıma | **`@vladmandic/face-api`** (FaceNet128) | ^1.7.15 |
| Kamera | Tarayıcı `getUserMedia` + Canvas2D |  |

### 2.3 Veritabanı

| Ortam | Teknoloji |
| --- | --- |
| Geliştirme (varsayılan) | **SQLite** — `backend/smartattend.db` |
| Üretim (önerilen) | **PostgreSQL** — `DATABASE_URL=postgresql+psycopg2://...` |

---

## 3. Klasör Yapısı (Directory Structure)

```text
SmartAttend/
│
├── README.md                    Bu dosya — proje genel dökümanı
├── start_project.bat            Backend + frontend'i tek tıkla başlatan Windows script
├── .venv/                       Kök virtualenv (opsiyonel; backend/venv da var)
│
├── backend/                     ▶ FastAPI tabanlı REST API
│   ├── README.md                Backend'e özel kurulum / API dökümanı
│   ├── requirements.txt         Python bağımlılıkları
│   ├── .env.example             Örnek ortam değişkenleri
│   ├── smartattend.db           SQLite veritabanı dosyası (dev)
│   ├── uploads/                 Öğrenci fotoğraflarının diske yazıldığı klasör
│   │   └── students/            (StaticFiles ile /uploads üzerinden serve edilir)
│   ├── venv/                    Backend için izole virtualenv
│   └── app/
│       ├── main.py              FastAPI app + lifespan + CORS + router include
│       ├── config.py            Pydantic Settings (env yönetimi)
│       ├── database.py          SQLAlchemy engine + SessionLocal + Base
│       ├── deps.py              `get_current_teacher` JWT bağımlılığı
│       ├── security.py          bcrypt hash + JWT üretim/doğrulama
│       ├── seed.py              Demo veri ekleyen yardımcı script
│       ├── models/              SQLAlchemy ORM modelleri (DB tabloları)
│       │   ├── teacher.py
│       │   ├── course.py
│       │   ├── branch.py        CourseBranch
│       │   ├── student.py
│       │   ├── class_session.py ClassSession + SessionStatus enum
│       │   └── attendance.py    Attendance + AttendanceStatus enum
│       ├── schemas/             Pydantic giriş/çıkış şemaları
│       │   ├── auth.py
│       │   ├── course.py
│       │   ├── branch.py
│       │   ├── student.py
│       │   ├── class_session.py
│       │   └── attendance.py
│       ├── routers/             FastAPI APIRouter modülleri
│       │   ├── auth.py          /auth/* (register, login, me)
│       │   ├── courses.py       /courses + /courses/{id}/branches
│       │   ├── students.py      /students + /courses/{id}/students vb.
│       │   ├── sessions.py      /sessions, /sessions/{id}/recognize
│       │   └── kiosk.py         /kiosk/* (public öğrenci self check-in)
│       └── services/
│           └── face_service.py  dlib + face_recognition ile yüz encode/match
│
└── web/                         ▶ React 19 + Vite SPA
    ├── README.md
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── .env.example             VITE_API_URL örneği
    ├── public/                  Statik varlıklar (face-api modelleri burada olabilir)
    ├── dist/                    `npm run build` çıktısı
    └── src/
        ├── main.tsx             ReactDOM root + QueryClient + AuthProvider
        ├── App.tsx              react-router-dom v7 route tanımları
        ├── index.css            Tailwind direktifleri + tema tokenları
        ├── lib/
        │   ├── api.ts           fetch wrapper, JWT token saklama (localStorage)
        │   ├── auth-context.tsx Auth context + useAuth hook
        │   ├── queries.ts       React Query hook'ları (mutations + queries)
        │   └── types.ts         Backend ile birebir uyumlu TS tipleri
        ├── components/
        │   ├── ProtectedRoute.tsx   Auth guard
        │   ├── CameraCapture.tsx    Tek-kare kamera (öğrenci kayıt)
        │   ├── Modal.tsx, ConfirmDialog.tsx, Toast.tsx
        │   ├── LoadingState.tsx, LoadingSpinner.tsx
        ├── layouts/
        │   └── DashboardLayout.tsx  Sidebar + outlet
        └── pages/
            ├── Login.tsx              Giriş + Kayıt Ol (tablı)
            ├── Dashboard.tsx          Anasayfa + aktif oturumlar
            ├── Courses.tsx            Ders listesi
            ├── CourseForm.tsx         Ders ekle/düzenle formu
            ├── CourseDetail.tsx       Şube/öğrenci/oturum sekmeleri
            ├── Students.tsx           Tüm öğrenciler + filtre
            ├── StudentForm.tsx        Fotoğraflı öğrenci kayıt formu
            ├── Scanner.tsx            Hoca: canlı kamera + recognize döngüsü
            ├── Kiosk.tsx              Public: öğrenci kendi kendine check-in
            ├── History.tsx            Tüm oturum geçmişi
            ├── SessionDetail.tsx      Oturum içeriği + manuel düzeltme
            └── Settings.tsx           Profil + tema + çıkış
```

### Mimari Mantık

- **`backend/app/`** içindeki klasörler **katmanlı (layered) mimari** prensibine göre ayrılmıştır:
  - `models/` → veritabanı (persistence) katmanı
  - `schemas/` → DTO / API kontratı (input/output validation)
  - `routers/` → HTTP arayüzü (controller)
  - `services/` → domain mantığı (yüz tanıma servisi)
  - `database.py`, `config.py`, `deps.py`, `security.py` → cross-cutting altyapı
- **`web/src/`** klasörü ise **feature-folder + paylaşımlı katman** karışımı bir yapıya sahiptir:
  - `pages/` → route bazlı ekranlar
  - `components/` → birden fazla sayfada kullanılan parçalar
  - `layouts/` → sayfaları saran iskelet (sidebar, navigasyon)
  - `lib/` → API client, auth context, server-state hook'ları, ortak tipler

---

## 4. Sistem Mimarisi ve Veri Akışı

```text
┌────────────────────────┐  HTTPS/HTTP  ┌──────────────────────────────┐  SQL  ┌────────────┐
│   Web (React 19 SPA)   │─── JSON ───▶│   Backend (FastAPI)          │──────▶│  SQLite /  │
│   Vite dev server      │◀── JSON ────│   Uvicorn @ :8000            │◀──────│  Postgres  │
│   :3000                │             │                              │       └────────────┘
└────────────────────────┘             │   ┌────────────────────────┐ │
   │  ▲                                │   │ services/face_service  │ │
   │  │ getUserMedia                   │   │  (dlib HOG + 128-d enc)│ │
   │  │ canvas → JPEG blob             │   └────────────────────────┘ │
   ▼  │                                │                              │
┌────────────────────────┐  multipart  │  /sessions/{id}/recognize    │
│ Tarayıcı kamerası       │── frame ──▶│   → eşleşen öğrencileri       │
│  (her ~2.5 sn)          │             │     PRESENT yap              │
└────────────────────────┘             └──────────────────────────────┘
```

### 4.1 Tipik İstek Akışı (Yoklama Tanıma)

1. **Hoca girişi:** `POST /auth/login` → JWT döner; frontend tokenı `localStorage`'a yazar
   ([web/src/lib/api.ts](web/src/lib/api.ts)).
2. **Yetkili istek:** Sonraki tüm istekler `Authorization: Bearer <token>` header'ı taşır.
   `app/deps.py` içindeki `get_current_teacher` bağımlılığı bu tokenı çözer ve mevcut
   `Teacher` ORM nesnesini route'lara enjekte eder.
3. **Oturum başlatma:** `POST /branches/{id}/sessions` → `ClassSession` + her öğrenci için
   `Attendance(status=ABSENT)` satırları yaratılır.
4. **Tanıma döngüsü:** Frontend `Scanner` sayfası kameradan kare alıp
   `POST /sessions/{id}/recognize` ucuna multipart olarak gönderir. Backend
   `face_recognition.face_locations` + `face_encodings` ile yüzleri çıkarır,
   `face_distance` ile o şubedeki öğrencilere karşı vektör mesafesi hesaplar; tolerans
   altında kalanları `PRESENT` + `auto_detected=true` olarak işaretler
   ([backend/app/routers/sessions.py:302](backend/app/routers/sessions.py#L302)).
5. **UI senkronizasyonu:** React Query, `attendance` listesini periyodik olarak refetch
   ederek sınıf listesinin canlı güncellenmesini sağlar.

### 4.2 Kiosk Akışı (Alternatif Yol)

- Öğrenci `/kiosk/:sessionId` URL'ine girer (auth gerektirmez).
- Tarayıcıda `@vladmandic/face-api` modelleri yüklenir, kameradan yakalanan kare üzerinde
  client-side **128-d FaceNet descriptor** üretilir.
- Descriptor JSON gövdesi olarak `POST /kiosk/sessions/{id}/recognize` ucuna gönderilir.
- Backend, o şubedeki tüm `face_descriptor_faceapi` değerleri ile **Euclidean** mesafeyi
  hesaplar; eşik altındaysa öğrenciyi `PRESENT` olarak işaretler.
- **Önemli:** Kiosk descriptor'ları (`face_descriptor_faceapi`) ile sunucu-side dlib
  encoding'leri (`face_encoding`) **birbirinin yerine kullanılamaz**, ayrı sütunlarda durur.

### 4.3 Oturum / Kimlik Modeli

- JWT içinde `sub` claim'i `teacher.id` (string) tutar.
- `cors_origins` listesi `app/config.py` içinde tanımlı; LAN üzerinden telefondan kullanım
  için kendi IP'nizi `CORS_ORIGINS` ortam değişkeni ile genişletmeniz gerekir.
- Tüm endpoint'ler **owner-scoping** yapar: bir hoca sadece kendi `Course`'larına ve
  bunlara bağlı `Branch`/`Student`/`Session`/`Attendance` kayıtlarına erişebilir.

---

## 5. Temel API Uç Noktaları (Core API Endpoints)

> Tüm `/auth/*` ve `/ping` dışındaki uçlar `Authorization: Bearer <JWT>` header'ı bekler.
> Kiosk altındaki `POST /kiosk/sessions/{id}/recognize` ucu **public**'tir
> (öğrenci self check-in için).

### 5.1 Sağlık & Auth

| Method | Path | Auth | İşlev |
| --- | --- | :---: | --- |
| GET | `/ping` | — | Sağlık kontrolü; `{status, app}` döner |
| POST | `/auth/register` | — | Yeni hoca + JWT döndürür |
| POST | `/auth/login` | — | OAuth2 password flow → JWT |
| GET | `/auth/me` | ✓ | Mevcut hocayı döndür |
| PATCH | `/auth/me` | ✓ | Profil güncelle (name/email/password) |

### 5.2 Dersler & Şubeler ([routers/courses.py](backend/app/routers/courses.py))

| Method | Path | İşlev |
| --- | --- | --- |
| GET | `/courses` | Hocaya ait dersler (öğrenci ve oturum sayaçlarıyla) |
| POST | `/courses` | Yeni ders oluştur (otomatik "A Şubesi" eklenir) |
| GET | `/courses/{course_id}` | Ders + şubeler + sayaçlar |
| PATCH | `/courses/{course_id}` | Ders alanlarını güncelle |
| DELETE | `/courses/{course_id}` | Dersi cascade sil |
| GET | `/courses/{course_id}/branches` | Şubeler + öğrenci sayaçları |
| POST | `/courses/{course_id}/branches` | Şube ekle |
| GET | `/courses/{course_id}/branches/{branch_id}` | Şube detayı |
| PATCH | `/courses/{course_id}/branches/{branch_id}` | Şubeyi güncelle |
| DELETE | `/courses/{course_id}/branches/{branch_id}` | Şubeyi sil (en az 1 şube kalmalı) |

### 5.3 Öğrenciler ([routers/students.py](backend/app/routers/students.py))

| Method | Path | İşlev |
| --- | --- | --- |
| GET | `/students` | Hocanın tüm öğrencileri (devamsızlık istatistikleriyle) |
| GET | `/courses/{course_id}/students` | Bir derste tüm şubelerin öğrencileri |
| GET | `/branches/{branch_id}/students` | Bir şubenin öğrencileri |
| POST | `/courses/{course_id}/students` | **multipart/form-data**: `full_name`, `student_number`, `branch_id`, `photo` (zorunlu), `email` (opsiyonel) |
| PATCH | `/students/{student_id}` | Öğrenciyi güncelle |
| DELETE | `/students/{student_id}` | Öğrenciyi sil + fotoğrafı diskten temizle |

### 5.4 Oturumlar & Yoklama ([routers/sessions.py](backend/app/routers/sessions.py))

| Method | Path | İşlev |
| --- | --- | --- |
| POST | `/branches/{branch_id}/sessions` | Şube için oturum başlat (zaten ACTIVE varsa onu döner) |
| GET | `/branches/{branch_id}/sessions` | Şubenin oturumları |
| GET | `/courses/{course_id}/sessions` | Dersin oturumları |
| GET | `/sessions` | Tüm oturumlar |
| GET | `/sessions/active` | Aktif oturumlar |
| GET | `/sessions/{session_id}` | Oturum + sayaçlar |
| POST | `/sessions/{session_id}/end` | Oturumu kapat (`status=ENDED`, `ended_at=now`) |
| DELETE | `/sessions/{session_id}` | Oturumu sil |
| GET | `/sessions/{session_id}/attendance` | Yoklama listesi (öğrenci adıyla) |
| PATCH | `/attendance/{attendance_id}` | Manuel `present`/`absent`/`late` güncelle |
| POST | `/sessions/{session_id}/recognize` | **multipart**: `frame` (image) → eşleşenleri PRESENT yap |

### 5.5 Kiosk (Public Self Check-in) ([routers/kiosk.py](backend/app/routers/kiosk.py))

| Method | Path | Auth | İşlev |
| --- | --- | :---: | --- |
| POST | `/kiosk/sessions/{session_id}/recognize` | — | Body: `{descriptor: float[128]}` (face-api.js'ten); Euclidean ≤ 0.6 ise öğrenciyi PRESENT işaretler |
| PATCH | `/kiosk/students/{student_id}/enroll` | ✓ | Hoca, öğrencinin face-api.js descriptor'ını kaydeder |

### 5.6 Statik

| Path | İşlev |
| --- | --- |
| `/uploads/students/{filename}` | `StaticFiles` ile serve edilen öğrenci fotoğrafları |
| `/docs` | FastAPI'nin otomatik Swagger UI'ı |
| `/redoc` | ReDoc dökümanı |

---

## 6. Veritabanı Şeması ve Modeller

ORM: **SQLAlchemy 2.0 Declarative** (`Mapped[...]` + `mapped_column(...)`).
Tablolar `app.main` lifespan'inde `Base.metadata.create_all` ile yaratılır
([backend/app/main.py:32](backend/app/main.py#L32)). Sonradan eklenen
`students.face_descriptor_faceapi` sütunu basit bir runtime migration ile
eklenir ([backend/app/main.py:15-26](backend/app/main.py#L15-L26)).

### 6.1 Tablolar

#### `teachers` ([models/teacher.py](backend/app/models/teacher.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `email` | VARCHAR(255) | **UNIQUE**, indexed |
| `name` | VARCHAR(255) | not null |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `created_at` | DATETIME | server_default = `now()` |

#### `courses` ([models/course.py](backend/app/models/course.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `name` | VARCHAR(255) | |
| `code` | VARCHAR(64) | |
| `schedule` | VARCHAR(255) | default `""` |
| `location` | VARCHAR(255) | default `""` |
| `teacher_id` | INTEGER | **FK → teachers.id** (`ON DELETE CASCADE`) |
| `created_at` | DATETIME | server_default = `now()` |

#### `course_branches` ([models/branch.py](backend/app/models/branch.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `name` | VARCHAR(255) | örn. "A Şubesi" |
| `code` | VARCHAR(64) | örn. "A" |
| `course_id` | INTEGER | **FK → courses.id** (`ON DELETE CASCADE`) |
| `created_at` | DATETIME | server_default = `now()` |

#### `students` ([models/student.py](backend/app/models/student.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `full_name` | VARCHAR(255) | |
| `student_number` | VARCHAR(64) | |
| `email` | VARCHAR(255) | nullable |
| `course_id` | INTEGER | **FK → courses.id** (`CASCADE`) |
| `branch_id` | INTEGER | **FK → course_branches.id** (`CASCADE`) |
| `photo_path` | VARCHAR(512) | nullable; diskte fotoğrafın tam yolu |
| `face_encoding` | TEXT | dlib 128-d encoding (JSON list) |
| `face_descriptor_faceapi` | TEXT | face-api.js 128-d descriptor (JSON list, runtime-added) |
| `created_at` | DATETIME | server_default = `now()` |
| **UNIQUE** | | `(course_id, student_number)` — `uq_course_student_number` |

#### `class_sessions` ([models/class_session.py](backend/app/models/class_session.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `course_id` | INTEGER | **FK → courses.id** (`CASCADE`) |
| `branch_id` | INTEGER | **FK → course_branches.id** (`CASCADE`) |
| `status` | ENUM | `SessionStatus` = {`active`, `ended`}; default `active` |
| `started_at` | DATETIME | server_default = `now()` |
| `ended_at` | DATETIME | nullable |

#### `attendances` ([models/attendance.py](backend/app/models/attendance.py))

| Sütun | Tip | Kısıt / Not |
| --- | --- | --- |
| `id` | INTEGER | **PK** |
| `session_id` | INTEGER | **FK → class_sessions.id** (`CASCADE`) |
| `student_id` | INTEGER | **FK → students.id** (`CASCADE`) |
| `status` | ENUM | `AttendanceStatus` = {`present`, `absent`, `late`}; default `absent` |
| `auto_detected` | BOOLEAN | true ise yüz tanıma ile işaretlendi |
| `marked_at` | DATETIME | server_default = `now()` |
| **UNIQUE** | | `(session_id, student_id)` — `uq_session_student` |

### 6.2 İlişkiler (ER)

```text
Teacher (1) ──< (N) Course
                 │
                 ├──< (N) CourseBranch ──< (N) Student ──< (N) Attendance
                 │                                              │
                 │                                              │ (N)
                 │                                              ▼
                 └──< (N) ClassSession ────────────────────────(1)
```

| Üst Tablo | Alt Tablo | İlişki | Cascade |
| --- | --- | --- | --- |
| `Teacher` | `Course` | One-to-Many | delete-orphan |
| `Course` | `CourseBranch` | One-to-Many | delete-orphan |
| `Course` | `Student` | One-to-Many | delete-orphan |
| `Course` | `ClassSession` | One-to-Many | delete-orphan |
| `CourseBranch` | `Student` | One-to-Many | delete-orphan |
| `CourseBranch` | `ClassSession` | One-to-Many | delete-orphan |
| `ClassSession` | `Attendance` | One-to-Many | delete-orphan |
| `Student` | `Attendance` | One-to-Many | delete-orphan |

> Yoklama oturumları **şube bazlıdır** — A şubesi oturumunda yalnızca A şubesi öğrencileri
> tanıma sürecine dahil edilir.

---

## 7. Geliştirici Kurulumu (Local Setup)

### 7.1 Önkoşullar

- **Python 3.11+** (dlib derlemesi için Windows'ta Visual C++ Build Tools veya `dlib-bin` wheel)
- **Node.js 20+** ve **npm**
- Modern bir tarayıcı (kamera erişimi için Chromium tabanlı önerilir)
- *(Opsiyonel)* PostgreSQL — üretim için

### 7.2 Adım Adım — Backend

```bash
# 1) Repo'ya gir
cd SmartAttend/backend

# 2) Sanal ortam oluştur ve aktive et
python -m venv venv
venv\Scripts\activate          # Windows (PowerShell: venv\Scripts\Activate.ps1)
# source venv/bin/activate     # macOS / Linux

# 3) Bağımlılıkları kur
pip install --upgrade pip
pip install -r requirements.txt

# >>> dlib/face_recognition Windows'ta derlenmiyorsa:
# pip install dlib-bin
# pip install face-recognition

# 4) Ortam değişkenlerini hazırla
copy .env.example .env         # Windows
# cp .env.example .env         # macOS / Linux

#    .env içinde mutlaka değiştir:
#    - JWT_SECRET=...           [GELİŞTİRİCİ TARAFINDAN DOLDURULACAK — uzun rastgele string]
#    - (Postgres kullanacaksan) DATABASE_URL=postgresql+psycopg2://user:password@host:5432/smartattend
#       [GELİŞTİRİCİ TARAFINDAN DOLDURULACAK]
#    - CORS_ORIGINS=["http://localhost:3000","http://192.168.x.x:3000"]
#       [GELİŞTİRİCİ TARAFINDAN DOLDURULACAK — kendi LAN IP'n]

# 5) Sunucuyu başlat
python -m app.main
# veya
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend `http://localhost:8000` üzerinde çalışır. API dökümanı: `http://localhost:8000/docs`.

İlk açılışta `lifespan` hook'u tabloları oluşturur ve `students.face_descriptor_faceapi`
sütununu (yoksa) ekler.

> **Demo veri:** `python -m app.seed` örnek hoca/ders/öğrenci kayıtlarını ekler
> ([backend/app/seed.py](backend/app/seed.py)).

### 7.3 Adım Adım — Frontend

```bash
# 1) web klasörüne gir
cd SmartAttend/web

# 2) Bağımlılıkları kur
npm install

# 3) Ortam değişkenlerini hazırla
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS / Linux

#    .env.local içinde:
#    VITE_API_URL=http://localhost:8000        # yerel geliştirme
#    VITE_API_URL=http://192.168.x.x:8000      # LAN üzerinden telefondan kullanmak için
#       [GELİŞTİRİCİ TARAFINDAN DOLDURULACAK — laptop'un LAN IP'si]

# 4) Geliştirme sunucusunu başlat
npm run dev
```

Vite dev server `http://localhost:3000` (host=0.0.0.0) üzerinde dinler.

İlk açılışta **Kayıt Ol** sekmesinden hesap oluştur, ardından sırasıyla:

1. Ders ekle
2. Şubeye fotoğraflı öğrenci kaydet (fotoğrafta tek bir yüz görünmeli)
3. Şubenin oturumunu başlat ve **Scanner** sayfasından kameralı taramayı çalıştır

### 7.4 Tek Tıkla Başlatma (Windows)

Kök dizinde `start_project.bat` her iki servisi ayrı CMD pencerelerinde başlatır:

```bat
start_project.bat
```

> Bu script kök `.venv\Scripts\python.exe` ile uvicorn'u, ayrı bir pencerede `npm run dev`'i
> çalıştırır.

### 7.5 LAN'daki Telefondan Test Etmek

1. Laptop'un IPv4 adresini öğren: Windows'ta `ipconfig`, macOS/Linux'ta `ifconfig`/`ip addr`.
2. Windows Defender Firewall'da **TCP 8000** ve **TCP 3000** portlarına private network izni ver.
3. `web/.env.local` içinde `VITE_API_URL=http://<laptop-ip>:8000` yap, dev server'ı yeniden başlat.
4. `backend/.env` içindeki `CORS_ORIGINS` listesine `http://<laptop-ip>:3000` ekle.
5. Telefondan tarayıcıyı aç → `http://<laptop-ip>:3000`.

> **Kamera + HTTP uyarısı:** `getUserMedia` `localhost` dışındaki HTTP origin'lerde çalışmaz.
> Çözüm: Chrome'da `chrome://flags/#unsafely-treat-insecure-origin-as-secure` bayrağına
> `http://<laptop-ip>:3000` ekleyip Chrome'u yeniden başlat. Üretimde HTTPS kullanın.

### 7.6 Veritabanı Sıfırlama (SQLite)

```bash
cd backend
del smartattend.db          # Windows
# rm smartattend.db         # macOS / Linux
python -m app.main          # tablolar yeniden oluşur
```

---

## 8. [GELİŞTİRİCİ TARAFINDAN DOLDURULACAK] Açık Kalan Konular

Aşağıdaki bilgiler kod tabanından çıkarılamadığı için açık bırakılmıştır:

- **Üretim deployment'ı:** Docker / docker-compose dosyası, CI/CD pipeline yapılandırması.
  *(Şu anda kodda Dockerfile veya CI yapılandırması bulunmuyor.)*
- **Üretim için JWT_SECRET değeri:** Güçlü rastgele bir string ile doldurulmalı
  (`openssl rand -hex 32`).
- **Üretim DATABASE_URL:** PostgreSQL host / port / şifre bilgileri.
- **HTTPS sertifikası:** Üretimde `getUserMedia`'nın çalışabilmesi için zorunlu.
- **face-api.js model dosyaları:** Kiosk akışı için `web/public/` altında ilgili
  pretrained model JSON ve weights'lerinin bulunması gerekir
  (`tiny_face_detector_model`, `face_landmark_68_model`, `face_recognition_model` vb.).
- **Yedekleme stratejisi:** SQLite/Postgres düzenli yedekleme planı.
- **Loglama / Monitoring:** Yapılandırılmış loglama, Sentry vb. tooling tanımlı değil.
- **Rate limiting / abuse koruması:** `/auth/login` ve `/sessions/{id}/recognize` uçları için
  henüz rate limit tanımlı değil.
- **Test paketi:** Birim/entegrasyon test klasörü mevcut değil.

---

## 9. Hızlı Referans

| Servis | URL | Komut |
| --- | --- | --- |
| Backend API | http://localhost:8000 | `python -m app.main` |
| Swagger UI | http://localhost:8000/docs | — |
| ReDoc | http://localhost:8000/redoc | — |
| Web SPA | http://localhost:3000 | `npm run dev` |
| Üretim build | `web/dist/` | `npm run build` |
| Demo seed | — | `python -m app.seed` |

Detaylı alt-modül dökümanları için:
[`backend/README.md`](backend/README.md) · [`web/README.md`](web/README.md)
