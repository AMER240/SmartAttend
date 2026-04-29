# SmartAttend — Automated Face-Recognition Attendance System

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Vite](https://img.shields.io/badge/Vite-6-646CFF)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-38BDF8)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8)

## 1. Project Overview

**SmartAttend** is a web-based, real-time attendance management system designed
to eliminate the manual roll-call process in university classrooms.

* **Backend (FastAPI + SQLAlchemy + PostgreSQL)** stores students, courses,
  sessions and attendance records and exposes them as a REST API.
* **AI Engine (OpenCV + face_recognition)** turns webcam frames into 128-D
  face vectors and matches them against the registered students in the DB.
* **Frontend (React 19 + TypeScript + Vite + TailwindCSS 4 + TanStack Query)**
  provides instructors with a modern, mobile-friendly SPA: dashboard, courses,
  students, live scanner, session history and manual overrides — all in one
  place.

## 2. Architecture

```
+----------------------+        HTTP / JSON        +----------------------+
|                      | ------------------------> |                      |
|   React 19 + Vite    |  GET  /courses/           |   FastAPI Backend    |
|   (frontend, port    |  POST /students/          |   (port 8000)        |
|     3000)            |  POST /sessions/start     |                      |
|                      |  POST /attendance/        |                      |
|                      |       live_match          |                      |
+----------+-----------+                           +----------+-----------+
           |                                                  |
           v                                                  v
   webcam (getUserMedia)                    +-----------------+----------------+
   one frame every 2.5 s → backend          |  SQLAlchemy ORM (psycopg2)       |
                                            |              |                   |
                                            |              v                   |
                                            |       PostgreSQL Database        |
                                            +-----------------+----------------+
                                                              |
                                                              v
                                            +----------------------------------+
                                            |  AI Engine (face_matcher.py)     |
                                            |  OpenCV + face_recognition       |
                                            +----------------------------------+
```

## 3. Folder Structure

```
SmartAttend/
├── backend/                      # Python · FastAPI · SQLAlchemy · OpenCV
│   ├── main.py                   # FastAPI app & routes
│   ├── database.py               # SQLAlchemy engine, Session, Base
│   ├── models.py                 # ORM tables (4 main tables)
│   ├── schemas.py                # Pydantic request/response models
│   ├── seed_demo_data.py         # Optional demo-data loader script
│   └── ai_engine/
│       └── face_matcher.py       # OpenCV / face_recognition glue code
│
├── frontend/                     # React 19 · TypeScript · Vite · Tailwind
│   ├── index.html
│   ├── package.json              # Node dependencies
│   ├── vite.config.ts            # Vite + Tailwind plugin
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # React entry + QueryClient + Toast provider
│       ├── App.tsx               # React Router (BrowserRouter) setup
│       ├── index.css             # Tailwind + Material You theme tokens
│       ├── components/           # Toast, Modal, ConfirmDialog, etc.
│       ├── layouts/
│       │   └── DashboardLayout.tsx
│       ├── lib/
│       │   ├── api.ts            # Tiny `apiRequest` HTTP client
│       │   ├── auth-context.tsx  # Fake "Demo Teacher" (auth bypassed)
│       │   ├── queries.ts        # TanStack hooks → backend adapter layer
│       │   └── types.ts          # UI-side data shapes
│       └── pages/                # Dashboard, Courses, Students, Scanner, ...
│
├── requirements.txt              # All Python dependencies
├── .env.example                  # Backend env template
├── .gitignore
└── README.md                     # This file
```

## 4. Database Schema

| Table            | Columns (PK / FK / etc.) |
|------------------|--------------------------|
| `students`       | `student_id` (PK, String) · `full_name` (String) · `face_encoding` (LargeBinary) |
| `courses`        | `course_id` (PK, Int) · `course_name` (String) · `course_code` (String, unique) |
| `sessions`       | `session_id` (PK, Int) · `course_id` (FK) · `session_date` (Date) · `is_active` (Bool) |
| `attendance_log` | `log_id` (PK, Int) · `session_id` (FK) · `student_id` (FK) · `status` (`Present` / `Absent`) · `check_in_time` (DateTime) |

Tables are created automatically at startup via `Base.metadata.create_all`.

## 5. API Contract

| Method | Endpoint                              | Description |
|--------|---------------------------------------|-------------|
| POST   | `/students/`                          | Register a new student (multipart: `student_id`, `full_name`, `photo`). |
| GET    | `/students/`                          | List all students. |
| DELETE | `/students/{student_id}`              | Delete a student (and their attendance rows). |
| GET    | `/courses/`                           | List all courses. |
| POST   | `/courses/`                           | Create a new course. |
| GET    | `/courses/{course_id}`                | Get a single course. |
| DELETE | `/courses/{course_id}`                | Delete a course (cascades to its sessions). |
| GET    | `/sessions/`                          | List all sessions. |
| GET    | `/sessions/active`                    | List only active (in-progress) sessions. |
| GET    | `/sessions/{session_id}`              | Get a single session. |
| POST   | `/sessions/start`                     | Open a new attendance session for a course. |
| POST   | `/sessions/end/{session_id}`          | Close a session; mark missing students as `Absent`. |
| DELETE | `/sessions/{session_id}`              | Delete a session and its log. |
| GET    | `/sessions/{session_id}/log`          | Return the attendance log for a session. |
| POST   | `/attendance/live_match`              | Match a webcam frame (`session_id` + `frame`) against the DB and mark the recognised student `Present`. |
| PATCH  | `/attendance/{log_id}`                | Update a single row's status (used by the manual marking UI). Accepts `present` / `absent` / `late`. |
| PUT    | `/attendance/override`                | Legacy manual override endpoint (kept for backwards compatibility). |

Full request / response schemas are available at
`http://127.0.0.1:8000/docs` (auto-generated Swagger UI).

## 6. Local Setup (step-by-step)

> Estimated time: about 15 minutes.

### 6.1 Prerequisites
* Python **3.12** (important: 3.13/3.14 have no prebuilt `dlib` wheel — would
  require a C++ compiler)
* Node.js **20+ (LTS)** and npm
* PostgreSQL **14+** installed and running
* A working webcam (for live attendance)

### 6.2 Clone the repo
```powershell
git clone <repo-url> SmartAttend
cd SmartAttend
```

### 6.3 Backend — virtual environment + dependencies

**Windows (PowerShell):**
```powershell
py -3.12 -m venv venv

# If Activate.ps1 is blocked by execution policy:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# You don't actually need to activate — just call the venv's python directly:
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

> **Why `--no-deps`?** The `face_recognition` package's metadata declares
> `dlib` (the source distribution) as a dependency, but we use `dlib-bin`
> (a precompiled wheel) instead. Without `--no-deps`, pip will try to compile
> dlib from source and demand a C++ compiler.

### 6.4 Create the PostgreSQL database
```sql
CREATE DATABASE smartattend;
-- (optional) create a dedicated user:
CREATE USER smartattend_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE smartattend TO smartattend_user;
```

### 6.5 Configure backend env
```powershell
copy .env.example .env
# Then edit .env and set DATABASE_URL with your real DB user/password.
```

Example `.env`:
```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@127.0.0.1:5432/smartattend
```

### 6.6 (Optional) Load demo data
```powershell
.\venv\Scripts\python.exe -m backend.seed_demo_data
```
This inserts 3 courses and 3 students with placeholder face vectors. For real
live attendance to work, you must re-register those students from
**Frontend › Students › New Student** so a real `face_encoding` gets generated
from a real photo.

### 6.7 Frontend — Node dependencies
```powershell
cd frontend
npm install
cd ..
```

### 6.8 Start the backend (Terminal #1)
```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```
Swagger UI: `http://127.0.0.1:8000/docs`.

### 6.9 Start the frontend (Terminal #2)
```powershell
cd frontend
npm run dev
```
The browser will open `http://localhost:3000` automatically. Use the top nav
to move between **Dashboard / Courses / Students / History / Settings**.

> The frontend talks to the backend via `VITE_API_URL`
> (default `http://localhost:8000`). To use a different host/port, create
> `frontend/.env` with `VITE_API_URL=...`.

## 7. Typical Workflow

1. From the **Dashboard**, click **New Course** to create one
   (e.g. `CS301 – Advanced Programming`).
2. Use **New Student** to register each student with a name, student number
   and a clear face photo (the `CameraCapture` component supports both file
   upload and live webcam capture).
3. From **Dashboard › My Courses**, hit the branch's **Start** button — you
   are redirected to the Scanner screen.
4. On the **Scanner** page the camera opens and one frame every 2.5 s is sent
   to `/attendance/live_match`. Recognised students are marked `Present`
   automatically. You can also flip statuses manually from the **Manual Mark**
   panel.
5. Click **End Attendance** → missing students get `Absent`, and the session
   report becomes available on the **History** page.

## 8. Architectural Notes / Design Decisions

* **Auth bypass:** This build has no JWT authentication. The frontend always
  shows the user as logged in via a fake "Demo Teacher" account (see
  `frontend/src/lib/auth-context.tsx`). Multi-user / role-based access can be
  layered on later.
* **Branches:** The backend has no concept of branches. The frontend exposes
  a single virtual branch (`Genel / A`, with `branch_id == course_id`) per
  course. The adapter logic lives in `frontend/src/lib/queries.ts`.
* **ID mapping:** Backend `student_id` is a String, while the React side
  expects a numeric `id`. The adapter converts via `Number(student_id)` and
  falls back to a deterministic 32-bit hash for non-numeric IDs. The original
  string is preserved as `student_number`.

## 9. Troubleshooting

| Error | Fix |
|-------|-----|
| `Could not initialize database tables` | Is `DATABASE_URL` correct in `.env`? Is the PostgreSQL service running? |
| `Failed building wheel for dlib` | You're on Python 3.13/3.14. **Downgrade to Python 3.12** and use the `dlib-bin` wheel. |
| `Please install face_recognition_models ...` | Run `pip install "setuptools<80"`. setuptools 81+ removed `pkg_resources`. |
| `Activate.ps1 cannot be loaded` | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or just call `.\venv\Scripts\python.exe` directly without activating. |
| `npm: command not found` | Install Node.js LTS (`winget install -e --id OpenJS.NodeJS.LTS`) and **reopen the terminal** so PATH refreshes. |
| Frontend says "Backend unreachable" | Is FastAPI on port 8000? If the browser console shows a CORS error, restart the backend with `--reload`. |
| Camera does not open | Did you grant the browser camera permission? Check site permissions; on `localhost` Chrome sometimes silently denies. |
| `No face detected in the provided photo` | Use a brighter photo with the face fully facing the camera. |
| `[WinError 10013] / 10048` on backend start | Another process is still bound to port 8000. Find it with `netstat -ano | findstr :8000` and kill its PID. |

The backend returns a meaningful `503 Service Unavailable` instead of
crashing when the database connection drops or the CV libraries are missing.

## 10. Team — Advanced Programming Techniques

* **Scrum Master:** Amir
* **Developer:** Eyup
* **Developer:** Reyyan
* **Developer:** Nurullah
* **Developer:** Hediye

---
*Built for the "Advanced Programming Techniques" course.*
