import cv2
import face_recognition
import numpy as np
import requests
import pickle
import time
import psycopg2.extras
from datetime import datetime
from models.database import get_db, db_context

class FaceRecognitionEngine:
    def __init__(self, session_id: int, tolerance: float = 0.55, process_every_n_frames: int = 5):
        self.session_id = session_id
        self.tolerance = tolerance
        self.process_every_n_frames = process_every_n_frames
        self.known_face_encodings = []
        self.known_student_ids = []
        self.recognized_students = set()
        self.is_running = False

    def load_known_faces(self):
        """Loads student faces from the database for the course associated with the session."""
        try:
            with db_context() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Get the session and its course_id
                    cur.execute("SELECT course_id FROM sessions WHERE id = %s", (self.session_id,))
                    session_rec = cur.fetchone()
                    if not session_rec:
                        print(f"Session {self.session_id} not found.")
                        return False
                    
                    # Get students enrolled in this course
                    cur.execute("""
                        SELECT s.id, s.face_encoding 
                        FROM students s
                        JOIN enrollments e ON s.id = e.student_id
                        WHERE e.course_id = %s
                    """, (session_rec['course_id'],))
                    students = cur.fetchall()

                    self.known_face_encodings = []
                    self.known_student_ids = []

                    for student in students:
                        if student['face_encoding']:
                            # Deserialize face encoding (stored as bytes)
                            encoding = pickle.loads(student['face_encoding'])
                            self.known_face_encodings.append(encoding)
                            self.known_student_ids.append(student['id'])
            
            print(f"Loaded {len(self.known_face_encodings)} student faces.")
            return True
        except Exception as e:
            print(f"Error loading faces: {e}")
            return False

    def mark_student_present(self, student_id: int):
        """Marks a student as present in the database."""
        if student_id in self.recognized_students:
            return
        
        try:
            with db_context() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT id FROM attendance WHERE session_id = %s AND student_id = %s",
                        (self.session_id, student_id)
                    )
                    attendance = cur.fetchone()

                    if not attendance:
                        cur.execute(
                            "INSERT INTO attendance (session_id, student_id, status, timestamp) VALUES (%s, %s, %s, %s)",
                            (self.session_id, student_id, "Present", datetime.utcnow())
                        )
                    else:
                        cur.execute(
                            "UPDATE attendance SET status = 'Present', timestamp = %s WHERE id = %s",
                            (datetime.utcnow(), attendance['id'])
                        )
            
            self.recognized_students.add(student_id)
            print(f"Student {student_id} marked as present.")
        except Exception as e:
            print(f"Error marking student present: {e}")


    def run(self):
        if not self.load_known_faces():
            return

        video_capture = cv2.VideoCapture(0)
        if not video_capture.isOpened():
            print("Error: Could not open camera.")
            return

        self.is_running = True
        frame_count = 0

        try:
            while self.is_running:
                ret, frame = video_capture.read()
                if not ret:
                    print("Error: Could not read frame.")
                    break

                frame_count += 1
                # Only process every Nth frame for performance
                if frame_count % self.process_every_n_frames == 0:
                    # Resize frame for faster processing (optional but good)
                    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
                    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

                    # Find all faces and encodings in the current frame
                    face_locations = face_recognition.face_locations(rgb_small_frame)
                    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

                    for face_encoding in face_encodings:
                        if not self.known_face_encodings:
                            continue
                            
                        # Compare face with known faces
                        matches = face_recognition.compare_faces(
                            self.known_face_encodings, 
                            face_encoding, 
                            tolerance=self.tolerance
                        )
                        
                        if True in matches:
                            first_match_index = matches.index(True)
                            student_id = self.known_student_ids[first_match_index]
                            self.mark_student_present(student_id)

                # Optional: Show the video feed (comment out in production)
                cv2.imshow('Face Recognition Attendance', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        except Exception as e:
            print(f"Engine Runtime Error: {e}")
        finally:
            self.is_running = False
            video_capture.release()
            cv2.destroyAllWindows()
            print("AI Engine stopped.")

if __name__ == "__main__":
    # Test run for session 1
    engine = FaceRecognitionEngine(session_id=1)
    engine.run()
