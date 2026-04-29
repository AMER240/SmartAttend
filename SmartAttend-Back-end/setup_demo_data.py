import pickle
import numpy as np
from models.database import init_db, get_db, db_context

# Create tables
init_db()

def setup_data():
    try:
        with db_context() as conn:
            with conn.cursor() as cur:
                # 1. Create a Course
                cur.execute(
                    "INSERT INTO courses (name, code) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING RETURNING id",
                    ("Yapay Zeka Giriş", "YZ101")
                )
                course_res = cur.fetchone()
                if not course_res:
                    # Course already exists, get its id
                    cur.execute("SELECT id FROM courses WHERE code = %s", ("YZ101",))
                    course_id = cur.fetchone()[0]
                else:
                    course_id = course_res[0]

                # 2. Create some Students
                # For demo, we'll use a random 128-d vector for face encoding
                encoding_demo = np.random.rand(128)
                encoding_bytes = pickle.dumps(encoding_demo)

                students_data = [
                    ("Ahmet Yılmaz", "2021001", encoding_bytes),
                    ("Ayşe Demir", "2021002", encoding_bytes)
                ]

                student_ids = []
                for name, student_number, face_encoding in students_data:
                    cur.execute(
                        "INSERT INTO students (name, student_number, face_encoding) VALUES (%s, %s, %s) ON CONFLICT (student_number) DO NOTHING RETURNING id",
                        (name, student_number, psycopg2.Binary(face_encoding))
                    )
                    student_res = cur.fetchone()
                    if not student_res:
                        cur.execute("SELECT id FROM students WHERE student_number = %s", (student_number,))
                        student_ids.append(cur.fetchone()[0])
                    else:
                        student_ids.append(student_res[0])

                # 3. Enroll Students in Course
                for student_id in student_ids:
                    cur.execute(
                        "INSERT INTO enrollments (student_id, course_id) VALUES (%s, %s) ON CONFLICT (student_id, course_id) DO NOTHING",
                        (student_id, course_id)
                    )

        print("Demo data created successfully!")
    except Exception as e:
        print(f"Error setting up demo data: {e}")

if __name__ == "__main__":
    import psycopg2 # Need to import psycopg2 here for psycopg2.Binary
    setup_data()

