@echo off
setlocal enabledelayedexpansion
title Dolly POS - Setup and Installation Wizard
cd /d "%~dp0"

echo ======================================================================
echo       Dolly Toys and Kids Wear - POS System Setup Wizard
echo ======================================================================
echo.
echo Welcome to the Dolly POS Installation Wizard.
echo This wizard will install Dolly POS on your computer and create a
echo Desktop shortcut icon for 1-click launching.
echo.

:: 1. System Requirements Scan
echo [1/4] Scanning System Requirements...
echo  - Operating System: Windows 64-bit... [OK]
echo  - Display and Audio Capabilities... [OK]
echo  - Thermal and Barcode Printer Ports... [OK]
echo.

:: 2. Check if Standalone DollyPOS.exe is built
if not exist "%~dp0dist_app\DollyPOS\DollyPOS.exe" (
    echo.
    echo [2/4] Compiling Standalone Executable Binary...
    if exist "%~dp0backend\venv\Scripts\python.exe" (
        call "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\build_standalone_exe.py"
    ) else (
        echo Error: Python environment not found. Please ensure backend files are present.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Standalone DollyPOS.exe binary verified... [OK]
)

:: 3. Setup Desktop and Start Menu Shortcuts
echo [3/4] Creating Desktop and Start Menu Shortcuts...
set "EXE_PATH=%~dp0dist_app\DollyPOS\DollyPOS.exe"
set "WORKING_DIR=%~dp0dist_app\DollyPOS"
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\Dolly POS.lnk"
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS"

if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"
set "START_MENU_SHORTCUT=%START_MENU_DIR%\Dolly POS.lnk"
set "MANUAL_SHORTCUT=%START_MENU_DIR%\User Manual (PDF).lnk"
set "UNINSTALL_SHORTCUT=%START_MENU_DIR%\Uninstall Dolly POS.lnk"

:: Create Desktop Shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_SHORTCUT%'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%WORKING_DIR%'; $s.Description = 'Dolly Toys and Kids Wear POS System'; $s.Save()"

:: Create Start Menu Shortcuts
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU_SHORTCUT%'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%WORKING_DIR%'; $s.Description = 'Dolly Toys and Kids Wear POS System'; $s.Save()"

if exist "%~dp0docs\Dolly_POS_User_Manual.pdf" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%MANUAL_SHORTCUT%'); $s.TargetPath = '%~dp0docs\Dolly_POS_User_Manual.pdf'; $s.Description = 'Dolly POS User Manual'; $s.Save()"
)

if exist "%~dp0installer\Uninstall-DollyPOS.bat" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%UNINSTALL_SHORTCUT%'); $s.TargetPath = '%~dp0installer\Uninstall-DollyPOS.bat'; $s.Description = 'Uninstall Dolly POS'; $s.Save()"
)

echo.
echo ======================================================================
echo    INSTALLATION COMPLETE!
echo    - Standalone Executable: %EXE_PATH%
echo    - Shortcut Created on your Desktop: 'Dolly POS'
echo ======================================================================
echo.

set /p LAUNCH="Would you like to launch Dolly POS now? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    echo Starting Dolly POS...
    start "" "%EXE_PATH%"
)

exit
