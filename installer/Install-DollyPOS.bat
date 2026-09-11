@echo off
setlocal enabledelayedexpansion
title Dolly POS - Setup & Installation Wizard
cd /d "%~dp0\.."

echo ======================================================================
echo       Dolly Toys and Kids Wear - POS System Installer
echo ======================================================================
echo.
echo Installing Dolly POS on this system...
echo.

:: 1. Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

:: 2. Setup Backend Virtual Environment
if not exist "backend\venv" (
    echo [1/4] Creating Python virtual environment in backend\venv...
    python -m venv backend\venv
)

echo [2/4] Installing backend dependencies...
call backend\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt

:: 3. Build Frontend Assets
if exist "frontend\dist" (
    echo [3/4] Frontend production build already exists.
) else (
    echo [3/4] Building frontend production bundle...
    where npm >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        cd frontend
        call npm install
        call npm run build
        cd ..
    ) else (
        echo [WARNING] Node.js / npm not found. Using pre-built static bundle if available.
    )
)

:: 4. Create Desktop Shortcut
echo [4/4] Creating Desktop Shortcut for Dolly POS...
set "TARGET_DIR=%~dp0.."
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Dolly POS.lnk"
set "BAT_PATH=%TARGET_DIR%\DollyPOS_Launcher.bat"
set "ICON_PATH=%TARGET_DIR%\backend\app\static\logo.ico"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%BAT_PATH%'; $s.WorkingDirectory = '%TARGET_DIR%'; if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%' }; $s.Save()"

echo.
echo ======================================================================
echo    Installation Complete! 
echo    A shortcut 'Dolly POS' has been created on your Desktop.
echo    You can now double-click 'Dolly POS' on your Desktop to launch.
echo ======================================================================
echo.
pause
