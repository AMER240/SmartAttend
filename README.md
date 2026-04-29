# SmartAttend — Otomatik Yüz Tanıma Yoklama Sistemi

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6-646CFF)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-38BDF8)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8)

## 1. Proje Özeti

**SmartAttend**, üniversite derslerindeki manuel yoklama sürecini ortadan
kaldırmak için tasarlanmış, web tabanlı, gerçek zamanlı bir yoklama yönetim
sistemidir.

* **Arka Uç (FastAPI + SQLAlchemy + PostgreSQL)** öğrencileri, dersleri,
  oturumları ve yoklama kayıtlarını saklar; REST API olarak sunar.
* **Yapay Zekâ Motoru (OpenCV + face_recognition)** kameradan gelen kareleri
  128-boyutlu yüz vektörlerine çevirir ve veritabanındaki kayıtlı öğrencilerle
  eşleştirir.
* **Ön Yüz (React 19 + TypeScript + Vite + TailwindCSS 4 + TanStack Query)**
  öğretim üyelerine modern, mobil-uyumlu bir kontrol paneli sunar:
  Dashboard, dersler, öğrenciler, canlı tarayıcı (Scanner), geçmiş oturumlar
  ve manuel düzeltmeler tek bir SPA içinde.

## 2. Mimari

```
+----------------------+        HTTP/JSON        +----------------------+
|                      | ----------------------> |                      |
|   React 19 + Vite    |  GET  /courses/         |   FastAPI Backend    |
|   (frontend, port    |  POST /students/        |   (port 8000)        |
|     3000)            |  POST /sessions/start   |                      |
|                      |  POST /attendance/      |                      |
|                      |       live_match        |                      |
+----------+-----------+                         +----------+-----------+
           |                                                |
           v                                                v
   webcam (getUserMedia)                  +-----------------+----------------+
   2.5sn'de bir kare → backend            |  SQLAlchemy ORM (psycopg2)       |
                                          |              ↓                   |
                                          |   PostgreSQL Database            |
                                          +-----------------+----------------+
                                                            |
                                                            v
                                          +----------------------------------+
                                          |  AI Engine (face_matcher.py)     |
                                          |  OpenCV + face_recognition       |
                                          +----------------------------------+
```

## 3. Klasör Yapısı

```
SmartAttend/
├── backend/                      # Python · FastAPI · SQLAlchemy · OpenCV
│   ├── main.py                   # FastAPI uygulaması & rotalar
│   ├── database.py               # SQLAlchemy engine + Session + Base
│   ├── models.py                 # ORM tabloları (4 ana tablo)
│   ├── schemas.py                # Pydantic veri doğrulama sınıfları
│   ├── seed_demo_data.py         # Demo veri yükleme scripti
│   └── ai_engine/
│       └── face_matcher.py       # OpenCV / face_recognition entegrasyonu
│
├── frontend/                     # React 19 · TypeScript · Vite · Tailwind
│   ├── index.html
│   ├── package.json              # Node bağımlılıkları
│   ├── vite.config.ts            # Vite + Tailwind plugin
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # React entry point + QueryClientProvider
│       ├── App.tsx               # React Router (BrowserRouter) yapılandırması
│       ├── index.css             # Tailwind + Material You tema değişkenleri
│       ├── components/           # Toast, Modal, ConfirmDialog, vs.
│       ├── layouts/
│       │   └── DashboardLayout.tsx  # Üst navigasyon çubuğu + alt sekme
│       ├── lib/
│       │   ├── api.ts            # `apiRequest` HTTP istemcisi
│       │   ├── auth-context.tsx  # Sahte teacher (auth bypass)
│       │   ├── queries.ts        # TanStack hooks → backend adapter katmanı
│       │   └── types.ts          # React tarafının veri şekilleri
│       └── pages/                # Dashboard, Courses, Students, Scanner, vs.
│
├── frontend-streamlit/           # (Yedek) eski Streamlit ön yüzü, kullanılmıyor
├── requirements.txt              # Tüm Python bağımlılıkları
├── .env.example                  # Backend ortam değişkenleri şablonu
├── .gitignore
└── README.md                     # Bu dosya
```

> `frontend-streamlit/` klasörü, projenin önceki Streamlit prototipidir.
> Sadece referans amacıyla saklanıyor; çalıştırılması gerekmiyor.

## 4. Veritabanı Şeması

| Tablo            | Sütunlar (PK / FK / vb.) |
|------------------|---------------------------|
| `students`       | `student_id` (PK, String) · `full_name` (String) · `face_encoding` (LargeBinary) |
| `courses`        | `course_id` (PK, Int) · `course_name` (String) · `course_code` (String, unique) |
| `sessions`       | `session_id` (PK, Int) · `course_id` (FK) · `session_date` (Date) · `is_active` (Bool) |
| `attendance_log` | `log_id` (PK, Int) · `session_id` (FK) · `student_id` (FK) · `status` (`Present`/`Absent`) · `check_in_time` (DateTime) |

Tablolar uygulama açılırken `Base.metadata.create_all` ile otomatik oluşturulur.

## 5. API Sözleşmesi (Contract)

| Method | Endpoint                              | Açıklama |
|--------|---------------------------------------|----------|
| POST   | `/students/`                          | Yeni öğrenci ekler (multipart: `student_id`, `full_name`, `photo`). |
| GET    | `/students/`                          | Tüm öğrencileri listeler. |
| DELETE | `/students/{student_id}`              | Öğrenciyi siler. |
| GET    | `/courses/`                           | Tüm dersleri listeler. |
| POST   | `/courses/`                           | Yeni ders ekler. |
| GET    | `/courses/{course_id}`                | Tek ders detayı. |
| DELETE | `/courses/{course_id}`                | Dersi siler (cascade). |
| GET    | `/sessions/`                          | Tüm oturumları listeler. |
| GET    | `/sessions/active`                    | Sadece aktif (devam eden) oturumlar. |
| GET    | `/sessions/{session_id}`              | Tek oturum detayı. |
| POST   | `/sessions/start`                     | Yeni yoklama oturumu başlatır. |
| POST   | `/sessions/end/{session_id}`          | Oturumu kapatır, eksikleri otomatik `Absent` yapar. |
| DELETE | `/sessions/{session_id}`              | Oturumu siler. |
| GET    | `/sessions/{session_id}/log`          | Oturumun yoklama listesini döner. |
| POST   | `/attendance/live_match`              | Kameradan gelen kareyi (`session_id` + `frame`) DB ile eşleştirir, eşleşeni `Present` yapar. |
| PATCH  | `/attendance/{log_id}`                | Tek satırın statüsünü günceller (React Scanner manuel mod için). |
| PUT    | `/attendance/override`                | Hocanın manuel `Present`/`Absent` düzeltmesi (legacy). |

Detaylı şema ve örnek istek/yanıtlar için `http://127.0.0.1:8000/docs`
(otomatik Swagger UI) sayfasını ziyaret edin.

## 6. Yerel Kurulum (Step-by-step)

> Tahmini süre: yaklaşık 15 dakika.

### 6.1 Ön gereksinimler
* Python **3.12** (önemli: 3.13/3.14 ile `dlib` wheel'i yok – derleme gerekir)
* Node.js **20+ (LTS)** ve npm
* PostgreSQL **14+** kurulu ve çalışıyor
* Webcam erişimi (canlı yoklama için)

### 6.2 Depoyu klonla
```powershell
git clone <repo-url> SmartAttend
cd SmartAttend
```

### 6.3 Backend — Sanal ortam + bağımlılıklar

**Windows (PowerShell):**
```powershell
py -3.12 -m venv venv

# Activate.ps1 engellenirse:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Aktivasyona gerek yok – venv'in python'unu doğrudan kullan:
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m pip install --no-deps face_recognition
```

**macOS / Linux:**
```bash
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install --no-deps face_recognition
```

> **Neden `--no-deps`?** `face_recognition` paketinin metadata'sında `dlib`
> (kaynak paket) yazılı, ama biz `dlib-bin` (precompiled wheel) kullanıyoruz.
> `--no-deps` olmadan pip dlib'i kaynaktan derlemeye çalışır ve C++ compiler ister.

### 6.4 PostgreSQL veritabanı oluştur
```sql
CREATE DATABASE smartattend;
-- (opsiyonel) ayrı bir kullanıcı:
CREATE USER smartattend_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE smartattend TO smartattend_user;
```

### 6.5 Backend ortam değişkenlerini ayarla
```powershell
copy .env.example .env
# .env içindeki DATABASE_URL'yi kendi kullanıcı/şifrenize göre düzenleyin.
```

Örnek `.env`:
```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@127.0.0.1:5432/smartattend
SMARTATTEND_API_URL=http://127.0.0.1:8000
```

### 6.6 (Opsiyonel) Demo verileri yükle
```powershell
.\venv\Scripts\python.exe -m backend.seed_demo_data
```
Bu, 3 ders ve 3 öğrenciyi sahte yüz vektörleriyle veritabanına ekler. Gerçek
canlı yoklama için bu öğrencilerin yüz fotoğraflarını **React › Öğrenciler ›
Yeni Öğrenci** ekranından tekrar kaydetmelisiniz (gerçek `face_encoding` üretilir).

### 6.7 Frontend — Node bağımlılıkları
```powershell
cd frontend
npm install
cd ..
```

### 6.8 Backend'i başlat (Terminal #1)
```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```
Tarayıcıda `http://127.0.0.1:8000/docs` adresinden Swagger UI'a erişebilirsiniz.

### 6.9 Frontend'i başlat (Terminal #2)
```powershell
cd frontend
npm run dev
```
Tarayıcıda `http://localhost:3000` otomatik açılır. Üst navigasyondan
**Panel / Dersler / Öğrenciler / Geçmiş / Ayarlar** sayfaları arasında
geçiş yapın.

> Frontend, backend'i `VITE_API_URL` (varsayılan: `http://localhost:8000`)
> üzerinden çağırır. Farklı bir host/port kullanmak için
> `frontend/.env` dosyasını oluşturup `VITE_API_URL=...` ekleyin.

## 7. Tipik Kullanım Akışı

1. **Panel** ekranındaki **Yeni Ders** ile bir ders ekleyin
   (ör. `BIL301 – İleri Programlama`).
2. **Öğrenci Ekle** ile her öğrenciyi numara, ad-soyad ve net bir yüz
   fotoğrafıyla kaydedin (Camera Capture bileşeni hem dosyadan hem canlı
   webcam'den fotoğraf alabilir).
3. **Panel › Derslerim** kısmından şubenin (`A`) **Başlat** butonuna basın
   → otomatik olarak Scanner ekranına yönlendirilirsiniz.
4. **Scanner** sayfasında kamera açılır, 2.5 saniyede bir kare
   `/attendance/live_match` endpoint'ine gönderilir, eşleşen öğrenci
   `Present` olarak işaretlenir. Manuel olarak da **Manuel İşaretle**
   panelinden statü değiştirebilirsiniz.
5. **Yoklamayı Bitir** → eksikler otomatik `Absent` olur, **Geçmiş**
   sayfasında oturumun raporunu görebilirsiniz.

## 8. Mimari Notlar / Tasarım Kararları

* **Auth bypass:** Bu sürümde JWT auth yoktur. Frontend, sahte bir
  "Demo Hoca" hesabıyla kullanıcıyı her zaman "girişli" gösterir
  (`frontend/src/lib/auth-context.tsx`). Çoklu kullanıcı / yetkilendirme
  ileride eklenebilir.
* **Şube (Branch) sistemi:** Backend'de yoktur. Frontend, her dersi
  tek bir varsayılan şube (`Genel / A`, `branch_id == course_id`) ile
  gösterir. Adapter mantığı `lib/queries.ts` içindedir.
* **ID Eşleme:** Backend `student_id` String, React tarafı `id: number`
  bekler. Adapter `Number(student_id)` ile çevirir; sayısal olmayan ID'ler
  için deterministik 32-bit hash kullanılır. Orijinal string ID
  `student_number` alanında muhafaza edilir.

## 9. Hata Ayıklama / Sorun Giderme

| Hata | Çözüm |
|------|-------|
| `Could not initialize database tables` | `.env` içindeki `DATABASE_URL` doğru mu? PostgreSQL servisi çalışıyor mu? |
| `Failed building wheel for dlib` | Python 3.13/3.14 kullanıyorsunuz. **Python 3.12'ye düşürün** ve `dlib-bin` wheel'ini kullanın. |
| `Please install face_recognition_models …` | `pip install "setuptools<80"` çalıştırın. setuptools 81+ `pkg_resources`'ı kaldırdı. |
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` veya aktivasyon yerine `.\venv\Scripts\python.exe`'yi doğrudan kullanın. |
| `npm: command not found` | Node.js LTS'i kurun: `winget install -e --id OpenJS.NodeJS.LTS`. Ardından **terminal'i yeniden açın** (PATH güncellenir). |
| Frontend "Backend unreachable" gösteriyor | FastAPI 8000'de açık mı? Tarayıcı konsolunda CORS hatası varsa backend `--reload` ile yeniden başlatılmalı. |
| Kamera açılmıyor | Tarayıcıya kamera izni verdiniz mi? `localhost` HTTP olduğu için Chrome bazı durumlarda izin istemiyor olabilir. Site izinlerinden manuel açın. |
| `No face detected in the provided photo` | Daha aydınlık ve yüzü tam karşıdan gösteren bir fotoğraf yükleyin. |

Backend, veritabanı bağlantısı koptuğunda veya CV kütüphaneleri yüklü
olmadığında **çökmek yerine** anlamlı `503 Service Unavailable` döner.

## 10. Takım — İleri Programlama Teknikleri

* **Scrum Master:** Amir
* **Developer:** Eyup
* **Developer:** Reyyan
* **Developer:** Nurullah
* **Developer:** Hediye

---
*İleri Programlama Teknikleri dersi için geliştirilmiştir.*
