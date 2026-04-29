from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import List
import psycopg2.extras
from models.database import get_db
from schemas import schemas

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("/courses", response_model=List[schemas.Course])
def list_courses(conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM courses")
        return cur.fetchall()

@router.post("/start", response_model=schemas.Session)
def start_session(session_data: schemas.SessionCreate, conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Check if course exists
        cur.execute("SELECT * FROM courses WHERE id = %s", (session_data.course_id,))
        course = cur.fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Check if there's already an active session for this course
        cur.execute(
            "SELECT * FROM sessions WHERE course_id = %s AND is_active = TRUE",
            (session_data.course_id,)
        )
        active_session = cur.fetchone()
        if active_session:
            return active_session

        # Create new session
        cur.execute(
            "INSERT INTO sessions (course_id, start_time, is_active) VALUES (%s, %s, %s) RETURNING *",
            (session_data.course_id, datetime.utcnow(), True)
        )
        new_session = cur.fetchone()
        return new_session

@router.post("/end/{session_id}")
def end_session(session_id: int, conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
        db_session = cur.fetchone()
        if not db_session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if not db_session['is_active']:
            return {"message": "Session already ended"}

        # Mark as inactive and set end time
        cur.execute(
            "UPDATE sessions SET is_active = %s, end_time = %s WHERE id = %s",
            (False, datetime.utcnow(), session_id)
        )

        # Automatically mark all enrolled students who are not Present as Absent
        cur.execute("""
            SELECT s.id 
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE e.course_id = %s
        """, (db_session['course_id'],))
        enrolled_students = cur.fetchall()

        for student in enrolled_students:
            # Check if student already has a record (Present) for this session
            cur.execute(
                "SELECT * FROM attendance WHERE session_id = %s AND student_id = %s",
                (session_id, student['id'])
            )
            attendance = cur.fetchone()

            if not attendance:
                # Mark as Absent
                cur.execute(
                    "INSERT INTO attendance (session_id, student_id, status, timestamp) VALUES (%s, %s, %s, %s)",
                    (session_id, student['id'], "Absent", datetime.utcnow())
                )
    
    return {"message": "Session ended and attendance finalized"}

