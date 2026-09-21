@echo off
title Dolly Toys ^& Kids Wear - POS System
cd /d "%~dp0"

echo ======================================================================
echo           Dolly Toys and Kids Wear - POS ^& Retail Management
echo ======================================================================
echo Starting Dolly POS Desktop App...
echo.

:: 1. Check if installed in LocalAppData (from DollyPOS_Setup_v1.0.0.exe)
if exist "%LOCALAPPDATA%\DollyPOS\DollyPOS.exe" (
    start "" "%LOCALAPPDATA%\DollyPOS\DollyPOS.exe"
    exit /b 0
)

:: 2. Check if standalone dist_app exists in current folder or parent folder
if exist "%~dp0dist_app\DollyPOS\DollyPOS.exe" (
    start "" "%~dp0dist_app\DollyPOS\DollyPOS.exe"
    exit /b 0
)
if exist "%~dp0..\dist_app\DollyPOS\DollyPOS.exe" (
    start "" "%~dp0..\dist_app\DollyPOS\DollyPOS.exe"
    exit /b 0
)

:: 3. Check if single installer EXE is in current directory
if exist "%~dp0DollyPOS_Setup_v1.0.0.exe" (
    echo Dolly POS not yet installed. Launching Setup Installer...
    start "" "%~dp0DollyPOS_Setup_v1.0.0.exe"
    exit /b 0
)

:: 4. Fallback to python venv (Development Mode)
if exist "%~dp0backend\venv\Scripts\python.exe" (
    start "" "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\desktop_app.py"
    exit /b 0
)
if exist "%~dp0..\backend\venv\Scripts\python.exe" (
    start "" "%~dp0..\backend\venv\Scripts\python.exe" "%~dp0..\backend\desktop_app.py"
    exit /b 0
)

echo Error: Dolly POS could not find an installed copy or standalone executable.
echo Please run DollyPOS_Setup_v1.0.0.exe to install Dolly POS.
pause
exit /b 1


