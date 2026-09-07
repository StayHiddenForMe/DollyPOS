@echo off
title Dolly POS - Automatic Launcher
color 0A
echo ===================================================
echo     DOLLY TOYS & KIDS WEAR - DOLLY POS LAUNCHER
echo ===================================================
echo Starting Backend API (Port 8000)...
start "Dolly POS Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend UI (Port 5173)...
start "Dolly POS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for services to initialize...
timeout /t 3 >nul

echo Opening Dolly POS in Google Chrome...
start http://localhost:5173

echo ===================================================
echo Dolly POS is running smoothly!
echo Keep the backend and frontend terminal windows open.
echo ===================================================
