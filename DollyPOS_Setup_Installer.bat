@echo off
setlocal enabledelayedexpansion
title Dolly POS - Setup and Installation Wizard
cd /d "%~dp0"

echo ======================================================================
echo       Dolly Toys and Kids Wear - POS System Setup Wizard
echo ======================================================================
echo.

:: 1. If standalone setup executable exists in current folder, launch setup wizard directly
if exist "%~dp0DollyPOS_Setup_v1.0.0.exe" (
    echo Launching Dolly POS Standalone Installation Wizard...
    start "" "%~dp0DollyPOS_Setup_v1.0.0.exe"
    exit /b 0
)

:: 2. Detect root project folder whether run from root or dist_installer subfolder
set "ROOT_DIR=%~dp0"
if exist "%~dp0dist_app\DollyPOS\DollyPOS.exe" (
    set "ROOT_DIR=%~dp0"
) else if exist "%~dp0..\dist_app\DollyPOS\DollyPOS.exe" (
    set "ROOT_DIR=%~dp0..\"
) else if exist "%~dp0backend\desktop_app.py" (
    set "ROOT_DIR=%~dp0"
) else if exist "%~dp0..\backend\desktop_app.py" (
    set "ROOT_DIR=%~dp0..\"
)

:: 3. Check if Standalone DollyPOS.exe is built
if not exist "%ROOT_DIR%dist_app\DollyPOS\DollyPOS.exe" (
    echo.
    echo Compiling Standalone Executable Binary...
    if exist "%ROOT_DIR%backend\venv\Scripts\python.exe" (
        call "%ROOT_DIR%backend\venv\Scripts\python.exe" "%ROOT_DIR%backend\build_standalone_exe.py"
    ) else (
        echo Error: Neither Standalone DollyPOS.exe nor Python environment found.
        echo If running on a new laptop, please run DollyPOS_Setup_v1.0.0.exe.
        pause
        exit /b 1
    )
) else (
    echo Standalone DollyPOS.exe binary verified... [OK]
)

:: 4. Setup Desktop and Start Menu Shortcuts
echo Creating Desktop and Start Menu Shortcuts...
set "EXE_PATH=%ROOT_DIR%dist_app\DollyPOS\DollyPOS.exe"
set "WORKING_DIR=%ROOT_DIR%dist_app\DollyPOS"
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

if exist "%ROOT_DIR%docs\Dolly_POS_User_Manual.pdf" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%MANUAL_SHORTCUT%'); $s.TargetPath = '%ROOT_DIR%docs\Dolly_POS_User_Manual.pdf'; $s.Description = 'Dolly POS User Manual'; $s.Save()"
)

if exist "%ROOT_DIR%installer\Uninstall-DollyPOS.bat" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%UNINSTALL_SHORTCUT%'); $s.TargetPath = '%ROOT_DIR%installer\Uninstall-DollyPOS.bat'; $s.Description = 'Uninstall Dolly POS'; $s.Save()"
)

:: 5. Register in Windows Control Panel (Programs and Features / Installed Apps)
echo Registering in Windows Control Panel...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "DisplayName" /d "Dolly POS - Retail Management" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "DisplayVersion" /d "1.0.0" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "Publisher" /d "Dolly Toys & Kids Wear" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "InstallLocation" /d "%WORKING_DIR%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "DisplayIcon" /d "%EXE_PATH%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "UninstallString" /d "cmd.exe /c \"%ROOT_DIR%installer\Uninstall-DollyPOS.bat\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "URLInfoAbout" /d "https://github.com/StayHiddenForMe/DollyPOS" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "NoModify" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "NoRepair" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /v "EstimatedSize" /t REG_DWORD /d 184320 /f >nul 2>&1

echo.
echo ======================================================================
echo    INSTALLATION COMPLETE!
echo    - Standalone Executable: %EXE_PATH%
echo    - Shortcut Created on your Desktop: 'Dolly POS'
echo    - Registered in Windows Control Panel: 'Dolly POS - Retail Management'
echo ======================================================================
echo.

set /p LAUNCH="Would you like to launch Dolly POS now? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    echo Starting Dolly POS...
    start "" "%EXE_PATH%"
)

exit



