"""
SmartAttend – Streamlit frontend.

A single-file Streamlit dashboard that talks to the FastAPI backend over
HTTP. The sidebar navigation lets a professor:

    * Register students (with a face photo)
    * Manage courses
    * Start / end class sessions
    * Run automatic face-recognition attendance from the webcam (no clicks!)
    * Review and override attendance reports

Run with:
    streamlit run frontend/app.py

Configure the backend URL via the `SMARTATTEND_API_URL` environment variable
(defaults to http://127.0.0.1:8000).
"""

from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import cv2
import pandas as pd
import requests
import streamlit as st
from streamlit_autorefresh import st_autorefresh

API_URL: str = os.getenv("SMARTATTEND_API_URL", "http://127.0.0.1:8000").rstrip("/")
REQUEST_TIMEOUT = 30  # seconds for normal API calls
HEALTH_TIMEOUT = 5    # seconds for the lightweight backend ping
HEALTH_CACHE_SECS = 15  # avoid re-pinging on every interaction

# How frequently the live attendance page captures a frame and asks the
# backend to match faces. 1.5 seconds is a good balance between fluid UX and
# not overloading face_recognition (which is CPU-heavy).
LIVE_REFRESH_MS = 1500

st.set_page_config(
    page_title="SmartAttend",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ---------------------------------------------------------------------------
# HTTP helpers – all wrapped in try/except so the UI never crashes on a
# transient backend / network failure.
# ---------------------------------------------------------------------------


def _api_get(path: str, **kwargs) -> Optional[Any]:
    try:
        r = requests.get(f"{API_URL}{path}", timeout=REQUEST_TIMEOUT, **kwargs)
    except requests.RequestException as exc:
        st.error(f"Backend unreachable: {exc}")
        return None
    if not r.ok:
        st.error(f"GET {path} → {r.status_code}: {_extract_detail(r)}")
        return None
    return r.json()


def _api_post(path: str, **kwargs) -> Optional[Any]:
    try:
        r = requests.post(f"{API_URL}{path}", timeout=REQUEST_TIMEOUT, **kwargs)
    except requests.RequestException as exc:
        st.error(f"Backend unreachable: {exc}")
        return None
    if not r.ok:
        st.error(f"POST {path} → {r.status_code}: {_extract_detail(r)}")
        return None
    return r.json()


def _api_put(path: str, **kwargs) -> Optional[Any]:
    try:
        r = requests.put(f"{API_URL}{path}", timeout=REQUEST_TIMEOUT, **kwargs)
    except requests.RequestException as exc:
        st.error(f"Backend unreachable: {exc}")
        return None
    if not r.ok:
        st.error(f"PUT {path} → {r.status_code}: {_extract_detail(r)}")
        return None
    return r.json()


def _extract_detail(response: requests.Response) -> str:
    try:
        return response.json().get("detail", response.text)
    except Exception:
        return response.text


def _check_backend(force: bool = False) -> bool:
    """
    Sidebar status indicator – cached for HEALTH_CACHE_SECS so we don't ping
    the backend on every reactive Streamlit re-run. Pass force=True from the
    "Tekrar Dene" button to bypass the cache.
    """
    now = time.time()
    last = st.session_state.get("_backend_check_at", 0.0)
    if not force and (now - last) < HEALTH_CACHE_SECS:
        return st.session_state.get("_backend_online", False)

    try:
        r = requests.get(f"{API_URL}/", timeout=HEALTH_TIMEOUT)
        online = r.ok
    except requests.RequestException:
        online = False

    st.session_state["_backend_check_at"] = now
    st.session_state["_backend_online"] = online
    return online


# ---------------------------------------------------------------------------
# Navigation – we drive the sidebar radio from session_state so other pages
# can programmatically jump (e.g. "Start session" → "Live attendance").
# ---------------------------------------------------------------------------


PAGE_DASHBOARD = "🏠 Dashboard"
PAGE_STUDENTS = "👤 Öğrenciler"
PAGE_COURSES = "📚 Dersler"
PAGE_SESSIONS = "▶️ Oturumlar"
PAGE_LIVE = "📷 Canlı Yoklama"
PAGE_REPORTS = "📊 Raporlar"

PAGE_ORDER = [
    PAGE_DASHBOARD,
    PAGE_STUDENTS,
    PAGE_COURSES,
    PAGE_SESSIONS,
    PAGE_LIVE,
    PAGE_REPORTS,
]


def _goto(page_label: str) -> None:
    """
    Request a programmatic page switch. We can't write to `nav_radio`
    directly here – the widget has already been instantiated on this run –
    so we leave a pending flag and trigger a rerun. `render_sidebar()`
    consumes the flag BEFORE the radio widget is rendered next time.
    """
    st.session_state["_pending_page"] = page_label
    st.rerun()


def render_sidebar() -> str:
    # Apply any pending programmatic navigation BEFORE the radio widget
    # is created (this is the only window in which we can mutate the key).
    pending = st.session_state.pop("_pending_page", None)
    if pending and pending in PAGE_ORDER:
        st.session_state["nav_radio"] = pending
    elif "nav_radio" not in st.session_state:
        st.session_state["nav_radio"] = PAGE_DASHBOARD

    st.sidebar.title("🎓 SmartAttend")
    st.sidebar.caption("Otomatik Yüz Tanıma Yoklama Sistemi")

    online = _check_backend()
    if online:
        st.sidebar.success("🟢 Backend Online")
    else:
        st.sidebar.error("🔴 Backend Offline")
        if st.sidebar.button("🔄 Tekrar Dene", width="stretch"):
            _check_backend(force=True)
            st.rerun()

    with st.sidebar.expander("ℹ️ Bu ne anlama geliyor?", expanded=False):
        st.caption(
            f"**Online (yeşil):** FastAPI backend `{API_URL}` adresinde "
            "çalışıyor ve istekleri yanıtlıyor.\n\n"
            "**Offline (kırmızı):** Backend kapalı, kilitlenmiş veya port "
            "engelli. Bu durumda ön yüz hiçbir veriyi okuyamaz/yazamaz.\n\n"
            "**Kontrol listesi:**\n"
            "1. Backend terminali açık mı? (`uvicorn backend.main:app --port 8000`)\n"
            "2. PostgreSQL servisi çalışıyor mu?\n"
            "3. `.env` içindeki `SMARTATTEND_API_URL` doğru port'a mı işaret ediyor?"
        )

    page = st.sidebar.radio("Sayfa", PAGE_ORDER, key="nav_radio")
    st.sidebar.divider()
    st.sidebar.caption("İleri Programlama Teknikleri – 2026")
    return page


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------


def page_dashboard() -> None:
    st.title(PAGE_DASHBOARD)
    st.write("SmartAttend yönetim paneline hoş geldiniz.")

    col1, col2, col3 = st.columns(3)

    students = _api_get("/students/") or []
    courses = _api_get("/courses/") or []
    sessions = _api_get("/sessions/") or []
    active = [s for s in sessions if s.get("is_active")]

    col1.metric("Toplam Öğrenci", len(students))
    col2.metric("Toplam Ders", len(courses))
    col3.metric("Aktif Oturum", len(active))

    st.divider()
    st.subheader("Aktif Oturumlar")
    if not active:
        st.info(
            "Şu an aktif bir oturum yok. **Oturumlar** sekmesinden başlatabilirsiniz."
        )
    else:
        st.dataframe(pd.DataFrame(active), width="stretch")


def page_students() -> None:
    st.title(PAGE_STUDENTS)

    tab1, tab2 = st.tabs(["📋 Liste", "➕ Yeni Öğrenci"])

    with tab1:
        students = _api_get("/students/") or []
        if not students:
            st.info("Henüz kayıtlı öğrenci yok.")
        else:
            df = pd.DataFrame(students)
            df["has_face_encoding"] = df["has_face_encoding"].map(
                {True: "✓", False: "✗"}
            )
            df = df.rename(
                columns={
                    "student_id": "Öğrenci No",
                    "full_name": "Ad Soyad",
                    "has_face_encoding": "Yüz Verisi",
                }
            )
            st.dataframe(df, width="stretch")

    with tab2:
        with st.form("new_student_form", clear_on_submit=True):
            student_id = st.text_input("Öğrenci Numarası *", max_chars=50)
            full_name = st.text_input("Ad Soyad *", max_chars=255)
            photo = st.file_uploader("Yüz Fotoğrafı *", type=["jpg", "jpeg", "png"])
            submitted = st.form_submit_button("Kaydet")

        if submitted:
            if not (student_id and full_name and photo):
                st.warning("Tüm alanlar zorunludur.")
            else:
                result = _api_post(
                    "/students/",
                    data={"student_id": student_id, "full_name": full_name},
                    files={"photo": (photo.name, photo.getvalue(), photo.type)},
                )
                if result:
                    st.success(
                        f"Öğrenci {result['student_id']} – {result['full_name']} kaydedildi."
                    )


def page_courses() -> None:
    st.title(PAGE_COURSES)

    tab1, tab2 = st.tabs(["📋 Liste", "➕ Yeni Ders"])

    with tab1:
        courses = _api_get("/courses/") or []
        if not courses:
            st.info("Henüz kayıtlı ders yok.")
        else:
            df = pd.DataFrame(courses).rename(
                columns={
                    "course_id": "ID",
                    "course_name": "Ders Adı",
                    "course_code": "Kod",
                }
            )
            st.dataframe(df, width="stretch")

    with tab2:
        with st.form("new_course_form", clear_on_submit=True):
            course_name = st.text_input("Ders Adı *", max_chars=255)
            course_code = st.text_input("Ders Kodu *", max_chars=50)
            submitted = st.form_submit_button("Kaydet")

        if submitted:
            if not (course_name and course_code):
                st.warning("Tüm alanlar zorunludur.")
            else:
                result = _api_post(
                    "/courses/",
                    json={"course_name": course_name, "course_code": course_code},
                )
                if result:
                    st.success(f"Ders kaydedildi: {result['course_code']}")


def page_sessions() -> None:
    st.title(PAGE_SESSIONS)

    courses = _api_get("/courses/") or []
    course_options = {
        f"{c['course_code']} – {c['course_name']}": c["course_id"] for c in courses
    }

    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Yeni Oturum Başlat")
        if not course_options:
            st.info("Önce bir ders kaydetmelisiniz.")
        else:
            label = st.selectbox("Ders", list(course_options.keys()))
            auto_open = st.checkbox(
                "Başlatınca otomatik kamerayı aç ve canlı yoklamaya geç",
                value=True,
            )
            if st.button("▶️ Oturumu Başlat", type="primary", width="stretch"):
                result = _api_post(
                    "/sessions/start", json={"course_id": course_options[label]}
                )
                if result:
                    st.session_state["selected_session_id"] = result["session_id"]
                    if auto_open:
                        st.session_state["camera_running"] = True
                        st.success(
                            f"Oturum #{result['session_id']} başlatıldı. "
                            "Canlı yoklamaya yönlendiriliyor…"
                        )
                        time.sleep(0.5)
                        _goto(PAGE_LIVE)
                    else:
                        st.success(
                            f"Oturum #{result['session_id']} başlatıldı "
                            f"(aktif: {result['is_active']})."
                        )

    with col_right:
        st.subheader("Oturumu Sonlandır")
        sessions = _api_get("/sessions/") or []
        active = [s for s in sessions if s.get("is_active")]
        if not active:
            st.info("Aktif oturum yok.")
        else:
            sid_options = {
                f"#{s['session_id']} – Ders {s['course_id']} – {s['session_date']}": s[
                    "session_id"
                ]
                for s in active
            }
            label = st.selectbox("Aktif Oturum", list(sid_options.keys()))
            if st.button("⏹ Oturumu Bitir", width="stretch"):
                sid = sid_options[label]
                _stop_camera()
                result = _api_post(f"/sessions/end/{sid}")
                if result:
                    st.success(f"Oturum #{sid} sonlandırıldı.")

    st.divider()
    st.subheader("Tüm Oturumlar")
    sessions = _api_get("/sessions/") or []
    if not sessions:
        st.info("Henüz oturum yok.")
    else:
        df = pd.DataFrame(sessions).rename(
            columns={
                "session_id": "ID",
                "course_id": "Ders ID",
                "session_date": "Tarih",
                "is_active": "Aktif",
            }
        )
        st.dataframe(df, width="stretch")


# ---------------------------------------------------------------------------
# Live attendance – server-side webcam, automatic face detection (no clicks!)
# ---------------------------------------------------------------------------


def _stop_camera() -> None:
    """Release the OpenCV capture stored in session_state, if any."""
    cap = st.session_state.pop("video_capture", None)
    if cap is not None:
        try:
            cap.release()
        except Exception:
            pass
    st.session_state["camera_running"] = False


def _open_camera() -> Optional["cv2.VideoCapture"]:
    """Open the default webcam, preferring DirectShow on Windows for speed."""
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return cap


def page_live_attendance() -> None:
    st.title(PAGE_LIVE)

    sessions = _api_get("/sessions/") or []
    active = [s for s in sessions if s.get("is_active")]
    if not active:
        st.warning(
            "Aktif oturum yok. Önce **Oturumlar** sekmesinden bir oturum başlatın."
        )
        if st.button("➡️ Oturumlar sayfasına git"):
            _goto(PAGE_SESSIONS)
        return

    sid_options = {
        f"#{s['session_id']} – Ders {s['course_id']} – {s['session_date']}": s[
            "session_id"
        ]
        for s in active
    }

    default_idx = 0
    selected_sid = st.session_state.get("selected_session_id")
    if selected_sid is not None:
        for i, sid in enumerate(sid_options.values()):
            if sid == selected_sid:
                default_idx = i
                break

    label = st.selectbox(
        "Aktif Oturum", list(sid_options.keys()), index=default_idx, key="live_session"
    )
    session_id = sid_options[label]
    st.session_state["selected_session_id"] = session_id

    if "camera_running" not in st.session_state:
        st.session_state["camera_running"] = False
    if "recognized_set" not in st.session_state:
        st.session_state["recognized_set"] = set()

    col1, col2 = st.columns(2)
    if col1.button(
        "▶️ Yoklamayı Başlat",
        type="primary",
        disabled=st.session_state["camera_running"],
        width="stretch",
    ):
        st.session_state["camera_running"] = True
        st.session_state["recognized_set"] = set()
        st.rerun()
    if col2.button(
        "⏹ Yoklamayı Durdur",
        disabled=not st.session_state["camera_running"],
        width="stretch",
    ):
        _stop_camera()
        st.rerun()

    video_slot = st.empty()
    status_slot = st.empty()

    if st.session_state["camera_running"]:
        # Auto-rerun the script every LIVE_REFRESH_MS ms. Each rerun captures
        # one frame, sends it to the backend, and renders the result – this
        # mimics a "live" experience without the user pressing any button.
        st_autorefresh(interval=LIVE_REFRESH_MS, key="live_autorefresh")

        cap = st.session_state.get("video_capture")
        if cap is None or not cap.isOpened():
            cap = _open_camera()
            if cap is None:
                status_slot.error(
                    "❌ Kamera açılamadı. Başka bir uygulama kamerayı kullanıyor olabilir."
                )
                _stop_camera()
                return
            st.session_state["video_capture"] = cap

        ret, frame = cap.read()
        if not ret or frame is None:
            status_slot.warning("Kameradan kare alınamadı, tekrar deniyor…")
            return

        frame = cv2.flip(frame, 1)  # mirror so the user sees themselves naturally
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_slot.image(rgb, channels="RGB", width="stretch")

        # JPEG-encode and ship to backend.
        ok, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            status_slot.warning("Kare JPEG'e çevrilemedi.")
            return

        try:
            r = requests.post(
                f"{API_URL}/attendance/live_match",
                data={"session_id": str(session_id)},
                files={"frame": ("live.jpg", jpeg_buf.tobytes(), "image/jpeg")},
                timeout=10,
            )
        except requests.RequestException as exc:
            status_slot.error(f"Backend bağlantı hatası: {exc}")
        else:
            if r.ok:
                res = r.json()
                if res.get("matched"):
                    sid = res.get("student_id")
                    if sid not in st.session_state["recognized_set"]:
                        st.session_state["recognized_set"].add(sid)
                    status_slot.success(
                        f"✅ **{res.get('full_name')}** ({sid}) yoklamaya işaretlendi "
                        f"– benzerlik: {1 - (res.get('distance') or 0):.0%}"
                    )
                else:
                    status_slot.info(f"🔍 {res.get('message', 'Eşleşme yok.')}")
            else:
                status_slot.warning(f"API yanıtı: {r.status_code} – {_extract_detail(r)}")
    else:
        video_slot.info(
            "Yoklamayı başlatmak için yukarıdaki **▶️ Yoklamayı Başlat** "
            "butonuna basın. Kamera otomatik açılacak ve öğrencileri kendisi "
            "tanıyacaktır – herhangi bir butona basmanıza gerek yok."
        )

    st.divider()
    st.subheader(f"Oturum #{session_id} – Anlık Yoklama Listesi")
    log = _api_get(f"/sessions/{session_id}/log") or []
    if not log:
        st.caption("Bu oturum için henüz kayıt yok.")
    else:
        df = pd.DataFrame(log)
        df = df.rename(
            columns={
                "log_id": "ID",
                "student_id": "Öğrenci No",
                "full_name": "Ad Soyad",
                "status": "Durum",
                "check_in_time": "Giriş Saati",
            }
        )
        st.dataframe(
            df[["ID", "Öğrenci No", "Ad Soyad", "Durum", "Giriş Saati"]],
            width="stretch",
        )


def page_reports() -> None:
    st.title(PAGE_REPORTS)

    sessions = _api_get("/sessions/") or []
    if not sessions:
        st.info("Henüz oturum yok.")
        return

    sid_options = {
        f"#{s['session_id']} – Ders {s['course_id']} – {s['session_date']} "
        f"({'Aktif' if s['is_active'] else 'Kapalı'})": s["session_id"]
        for s in sessions
    }
    label = st.selectbox("Oturum", list(sid_options.keys()))
    session_id = sid_options[label]

    log: List[Dict[str, Any]] = _api_get(f"/sessions/{session_id}/log") or []

    if not log:
        st.info("Bu oturum için kayıt yok.")
        return

    df = pd.DataFrame(log)

    present = (df["status"] == "Present").sum()
    absent = (df["status"] == "Absent").sum()
    c1, c2, c3 = st.columns(3)
    c1.metric("Toplam", len(df))
    c2.metric("Var", int(present))
    c3.metric("Yok", int(absent))

    st.subheader("Detaylı Yoklama Listesi")
    display_df = df.rename(
        columns={
            "log_id": "ID",
            "student_id": "Öğrenci No",
            "full_name": "Ad Soyad",
            "status": "Durum",
            "check_in_time": "Giriş Saati",
        }
    )
    st.dataframe(
        display_df[["ID", "Öğrenci No", "Ad Soyad", "Durum", "Giriş Saati"]],
        width="stretch",
    )

    st.download_button(
        "⬇️ CSV İndir",
        df.to_csv(index=False).encode("utf-8"),
        file_name=f"smartattend_session_{session_id}_{datetime.now():%Y%m%d_%H%M%S}.csv",
        mime="text/csv",
    )

    st.divider()
    st.subheader("Manuel Düzeltme (Override)")
    st.caption("Yanlış işaretlenen bir öğrenciyi 'Var' veya 'Yok' olarak güncelleyin.")

    student_options = {
        f"{row['student_id']} – {row.get('full_name','')} (şu an: {row['status']})": row[
            "student_id"
        ]
        for row in log
    }
    chosen = st.selectbox("Öğrenci", list(student_options.keys()))
    new_status = st.radio("Yeni durum", ["Present", "Absent"], horizontal=True)

    if st.button("💾 Güncelle"):
        result = _api_put(
            "/attendance/override",
            json={
                "session_id": session_id,
                "student_id": student_options[chosen],
                "status": new_status,
            },
        )
        if result:
            st.success(
                f"Öğrenci {result['student_id']} → {result['status']} olarak güncellendi."
            )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

PAGES = {
    PAGE_DASHBOARD: page_dashboard,
    PAGE_STUDENTS: page_students,
    PAGE_COURSES: page_courses,
    PAGE_SESSIONS: page_sessions,
    PAGE_LIVE: page_live_attendance,
    PAGE_REPORTS: page_reports,
}


def main() -> None:
    page = render_sidebar()

    # If we leave the live page, make sure the camera is released so other
    # apps can reuse it and we don't leak the OS handle.
    if page != PAGE_LIVE and st.session_state.get("camera_running"):
        _stop_camera()

    PAGES.get(page, page_dashboard)()


if __name__ == "__main__":
    main()
