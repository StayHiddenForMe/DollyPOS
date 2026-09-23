@echo off
title Dolly POS - [UPDATE PRODUCTION APP]
cd /d "%~dp0"

echo ======================================================================
echo       Dolly Toys and Kids Wear - [PRODUCE SOFTWARE UPDATE]
echo ======================================================================
echo.
echo Compiling latest Beta changes into Stable Production Release...
echo.

:: 1. Build Production Frontend Bundle
echo [1/3] Building Optimized Frontend Production Bundle...
call npm run build --prefix "%~dp0frontend"
if %errorlevel% neq 0 (
    echo [ERROR] Frontend compilation failed. Please check errors above.
    pause
    exit /b 1
)

:: 2. Build Standalone Native Executable
echo.
echo [2/3] Building Standalone DollyPOS.exe Native Package...
call "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\build_standalone_exe.py"
if %errorlevel% neq 0 (
    echo [ERROR] Standalone binary build failed.
    pause
    exit /b 1
)

:: 3. Package Single Standalone Setup Installer EXE
echo.
echo [3/3] Packaging Single Standalone Setup Installer (DollyPOS_Setup_v1.0.0.exe)...
call "%~dp0backend\venv\Scripts\python.exe" "%~dp0backend\package_single_setup_exe.py"
if %errorlevel% neq 0 (
    echo [ERROR] Single installer packaging failed.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo   [SUCCESS] SOFTWARE UPDATE COMPILED SUCCESSFULLY!
echo ======================================================================
echo.
echo What would you like to do now?
echo   [1] Update THIS Laptop's Installed Production App Now (Instant)
echo   [2] I will copy dist_installer to my OTHER Laptop
echo   [3] Exit
echo.
set /p CHOICE="Select an option (1, 2, or 3): "

if "%CHOICE%"=="1" (
    echo.
    echo Installing update to LocalAppData...
    start "" "%~dp0dist_installer\DollyPOS_Setup_v1.0.0.exe"
)

exit /b 0