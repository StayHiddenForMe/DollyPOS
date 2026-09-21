@echo off
title Dolly POS - Uninstaller
cd /d "%~dp0\.."

echo ======================================================================
echo       Dolly Toys and Kids Wear - POS System Uninstaller
echo ======================================================================
echo.
echo This will remove Dolly POS shortcuts and Control Panel registration.
echo NOTE: Your PostgreSQL database and store backups will NOT be deleted.
echo.
set /p CONFIRM="Are you sure you want to proceed? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Uninstallation cancelled.
    pause
    exit /b 0
)

echo.
echo Stopping any running Dolly POS processes...
taskkill /F /IM DollyPOS.exe /T >nul 2>&1

echo Removing Desktop Shortcut...
if exist "%USERPROFILE%\Desktop\Dolly POS.lnk" (
    del /f /q "%USERPROFILE%\Desktop\Dolly POS.lnk" >nul 2>&1
    echo [OK] Removed Desktop Shortcut.
)

echo Removing Start Menu Shortcuts...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS" (
    rd /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS" >nul 2>&1
    echo [OK] Removed Start Menu Folder.
)
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS.lnk" (
    del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS.lnk" >nul 2>&1
)

echo Removing Windows Control Panel Registration...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DollyPOS" /f >nul 2>&1
echo [OK] Removed Control Panel Entry.

echo.
echo ======================================================================
echo    Uninstallation Complete!
echo    Dolly POS has been uninstalled successfully.
echo ======================================================================
pause
exit /b 0

