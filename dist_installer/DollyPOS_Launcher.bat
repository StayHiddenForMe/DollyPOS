@echo off
title Dolly Toys ^& Kids Wear - POS System
cd /d "%~dp0"

echo ======================================================================
echo           Dolly Toys and Kids Wear - POS ^& Retail Management
echo ======================================================================
echo Starting Dolly POS Desktop App...
echo.

if exist "%~dp0dist_app\DollyPOS\DollyPOS.exe" (
    start "" "%~dp0dist_app\DollyPOS\DollyPOS.exe"
    exit /b 0
)
if exist "%~dp0..\dist_app\DollyPOS\DollyPOS.exe" (
    start "" "%~dp0..\dist_app\DollyPOS\DollyPOS.exe"
    exit /b 0
)
if exist "%~dp0backend\venv\Scripts\python.exe" (
    start "" "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\desktop_app.py"
    exit /b 0
)
if exist "%~dp0..\backend\venv\Scripts\python.exe" (
    start "" "%~dp0..\backend\venv\Scripts\python.exe" "%~dp0..\backend\desktop_app.py"
    exit /b 0
)

echo Error: Standalone DollyPOS.exe or Python environment not found.
echo Please ensure dist_app\DollyPOS or backend\venv exists.
pause
exit /b 1

