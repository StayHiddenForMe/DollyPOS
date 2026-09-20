@echo off
title Dolly Toys ^& Kids Wear - POS System
cd /d "%~dp0"

echo ======================================================================
echo           Dolly Toys and Kids Wear - POS ^& Retail Management
echo ======================================================================
echo Starting Dolly POS Standalone Server...
echo.

if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo Error: Python virtual environment not found in backend\venv.
    echo Please run Install-DollyPOS.bat to setup environment.
    pause
    exit /b 1
)

start "" "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\desktop_app.py"
exit
