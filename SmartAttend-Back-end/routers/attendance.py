from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
import psycopg2.extras
from models.database import get_db
from schemas import schemas

router = APIRouter(prefix="/attendance", tags=["attendance"])

@router.get("/{session_id}", response_model=List[schemas.AttendanceReport])
def get_session_attendance(session_id: int, conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Check if session exists
        cur.execute("SELECT course_id FROM sessions WHERE id = %s", (session_id,))
        db_session = cur.fetchone()
        if not db_session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get all students enrolled in the course of this session and their attendance status
        cur.execute("""
            SELECT 
                s.name as student_name, 
                s.student_number, 
                COALESCE(a.status, 'Pending') as status, 
                a.timestamp
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            LEFT JOIN attendance a ON s.id = a.student_id AND a.session_id = %s
            WHERE e.course_id = %s
        """, (session_id, db_session['course_id']))
        
        return cur.fetchall()

@router.patch("/manual", response_model=schemas.Attendance)
def update_attendance_manual(update: schemas.AttendanceUpdate, conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Check if record exists
        cur.execute(
            "SELECT * FROM attendance WHERE session_id = %s AND student_id = %s",
            (update.session_id, update.student_id)
        )
        attendance = cur.fetchone()

        if not attendance:
            cur.execute(
                "INSERT INTO attendance (session_id, student_id, status, timestamp) VALUES (%s, %s, %s, %s) RETURNING *",
                (update.session_id, update.student_id, update.status, datetime.utcnow())
            )
            attendance = cur.fetchone()
        else:
            cur.execute(
                "UPDATE attendance SET status = %s, timestamp = %s WHERE id = %s RETURNING *",
                (update.status, datetime.utcnow(), attendance['id'])
            )
            attendance = cur.fetchone()
    
    return attendance

@router.get("/student/{student_id}/absences")
def get_student_absences(student_id: int, conn = Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM attendance WHERE student_id = %s AND status = 'Absent'",
            (student_id,)
        )
        count = cur.fetchone()[0]
    
    return {"student_id": student_id, "total_absences": count}

# Internal endpoint for AI Engine to mark presence
@router.post("/mark-present")
def mark_present(session_id: int, student_id: int, conn = Depends(get_db)):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM attendance WHERE session_id = %s AND student_id = %s",
            (session_id, student_id)
        )
        attendance = cur.fetchone()

        if not attendance:
            cur.execute(
                "INSERT INTO attendance (session_id, student_id, status, timestamp) VALUES (%s, %s, %s, %s)",
                (session_id, student_id, "Present", datetime.utcnow())
            )
        else:
            cur.execute(
                "UPDATE attendance SET status = 'Present', timestamp = %s WHERE id = %s",
                (datetime.utcnow(), attendance['id'])
            )
    
    return {"message": f"Student {student_id} marked as present"}

