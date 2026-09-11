@echo off
title Dolly POS - Uninstaller
cd /d "%~dp0\.."

echo ======================================================================
echo       Dolly Toys and Kids Wear - POS System Uninstaller
echo ======================================================================
echo.
echo This will remove Dolly POS shortcuts from your Desktop and Start Menu.
echo NOTE: Your database and sales data will NOT be deleted.
echo.
set /p CONFIRM="Are you sure you want to proceed? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo Uninstallation cancelled.
    pause
    exit /b 0
)

echo.
echo Removing Desktop Shortcut...
if exist "%USERPROFILE%\Desktop\Dolly POS.lnk" (
    del "%USERPROFILE%\Desktop\Dolly POS.lnk"
    echo [OK] Removed Desktop Shortcut.
)

echo Removing Start Menu Shortcut...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Dolly POS.lnk"
    echo [OK] Removed Start Menu Shortcut.
)

echo.
echo ======================================================================
echo    Uninstallation Complete!
echo    Shortcuts have been removed.
echo ======================================================================
pause
