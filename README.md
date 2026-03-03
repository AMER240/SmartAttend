# 🎓 SmartAttend: Automated Facial Recognition Attendance System

![Python](https://img.shields.io/badge/Python-3.12%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![Streamlit](https://img.shields.io/badge/Streamlit-Frontend-FF4B4B)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8)

## 📖 Project Overview
**SmartAttend** is a modern, web-based attendance management system designed to eliminate manual roll calls. Built entirely in Python, it uses real-time computer vision (OpenCV) and AI facial recognition to detect and identify students seamlessly. 

The system features a robust backend (FastAPI + PostgreSQL) to securely manage course sessions and precise absence records, while offering professors an interactive, user-friendly dashboard (Streamlit) to monitor attendance in real-time.

## ✨ Key Features
- **Real-Time Facial Recognition:** Automatically detects and marks students as 'Present' via a live camera feed.
- **Interactive Professor Dashboard:** A clean UI to start/stop sessions, view connected classes, and monitor real-time attendance tables.
- **Smart Absence Tracking:** Automatically generates 'Absent' records for missing students when a session is closed.
- **Manual Override & Session Management:** Allows professors to manually update attendance statuses and delete accidental sessions securely.
- **Exportable Reports:** One-click export of attendance history to CSV/Excel formats.

## 🛠️ Technology Stack
- **Frontend:** Streamlit
- **Backend:** FastAPI, Uvicorn
- **AI & Vision:** OpenCV (`opencv-python`), `face_recognition`
- **Database:** PostgreSQL, SQLAlchemy (ORM), `psycopg2`
- **Data Manipulation:** Pandas

## 👥 Team (İleri Programlama Teknikleri)
- **Scrum Master:** [Your Name]
- **Developer:** [Member 2 Name]
- **Developer:** [Member 3 Name]
- **Developer:** [Member 4 Name]
- **Developer:** [Member 5 Name]

---
*Developed for the İleri Programlama Teknikleri course.*