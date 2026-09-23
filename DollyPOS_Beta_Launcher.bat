@echo off
title Dolly POS - [BETA / DEVELOPMENT MODE]
cd /d "%~dp0"

echo ======================================================================
echo           Dolly Toys and Kids Wear - [BETA / DEV TESTING]
echo ======================================================================
echo.
echo Starting Dolly POS in Beta / Development Mode...
echo (All new code changes will appear here for your testing)
echo.

:: 1. Verify backend Python virtual environment
if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo [ERROR] Python environment not found in backend\venv.
    pause
    exit /b 1
)

:: 2. Auto-build frontend if source modified
echo Checking frontend bundle...
if exist "%~dp0frontend\node_modules" (
    call npm run build --prefix "%~dp0frontend" >nul 2>&1
)

:: 3. Launch Beta Desktop App
echo Launching Beta POS Window...
start "" "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\desktop_app.py"
exit /b 0