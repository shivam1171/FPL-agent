@echo off
echo Starting FPL Agent...

:: Start Backend
echo Starting Backend...
start "FPL Backend" cmd /k "cd backend && call venv\Scripts\activate && python -m src.main"

:: Wait a few seconds for backend to initialize
timeout /t 5 /nobreak >nul

:: Start Frontend
echo Starting Frontend...
start "FPL Frontend" cmd /k "cd frontend && npm run dev"

echo FPL Agent started!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this launcher (the app windows will remain open)...
pause >nul
