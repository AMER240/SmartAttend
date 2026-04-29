@echo off
echo Starting Backend...
start cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload"

echo Starting Frontend...
start cmd /k "cd web && npm run dev"

echo Both services started!
