import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

# Replace with your actual PostgreSQL credentials
DATABASE_URL = "postgresql://postgres:Psql.23@127.0.0.1/attendance_db"

# Parse connection string if needed, or just use it directly
# psycopg2.connect accepts the URL directly
connection_pool = None
try:
    connection_pool = psycopg2.pool.SimpleConnectionPool(
        1, 20, # min and max connections
        dsn=DATABASE_URL
    )
    if connection_pool:
        print("Connection pool created successfully")
except Exception as e:
    print(f"Error creating connection pool: {e}")


def get_db():
    if connection_pool is None:
        raise RuntimeError("Database connection pool is not initialized. Please check your DATABASE_URL credentials and ensure PostgreSQL is running.")
    conn = connection_pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        connection_pool.putconn(conn)

db_context = contextmanager(get_db)

def init_db():
    """Create tables if they don't exist"""
    commands = (
        """
        CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            student_number VARCHAR(255) UNIQUE,
            name VARCHAR(255),
            face_encoding BYTEA
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            code VARCHAR(255) UNIQUE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS enrollments (
            student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
            course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
            PRIMARY KEY (student_id, course_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
            student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'Absent',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    try:
        with db_context() as conn:
            with conn.cursor() as cur:
                for command in commands:
                    cur.execute(command)
        print("Database tables initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {e}")


