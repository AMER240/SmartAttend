from fastapi import FastAPI
from models.database import init_db
from routers import sessions, attendance

# Create database tables
init_db()

app = FastAPI(title="Face Recognition Attendance System")

# Include routers
app.include_router(sessions.router)
app.include_router(attendance.router)

@app.get("/")
async def root():
    return {"message": "Attendance System API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
