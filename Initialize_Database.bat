@echo off
setlocal enabledelayedexpansion
title Dolly POS - Database ^& Schema Initialization Engine
cd /d "%~dp0"

echo ======================================================================
echo          DOLLY POS - DATABASE ^& SCHEMA INITIALIZATION ENGINE
echo                   Dolly Toys ^& Kids Wear, Dhule
echo ======================================================================
echo  This tool creates a PostgreSQL database (if not already existing),
echo  generates all 23 tables, schemas, indexes, and foreign keys,
echo  applies all column migrations, seeds default store settings ^& users,
echo  and updates the application configuration (.env) files.
echo ======================================================================
echo.

:: 1. Locate Python executable
set "PYTHON_EXE="

if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
) else if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    )
)

:: 2. Check if Python was found
if not defined PYTHON_EXE (
    echo [ERROR] Python was not found on this system.
    echo Please make sure Dolly POS virtual environment is installed at:
    echo   backend\venv\Scripts\python.exe
    echo or that Python is available in system PATH.
    echo.
    pause
    exit /b 1
)

:: 3. Run the database initialization engine
if "%~1"=="" (
    :: Run interactive prompt mode
    "%PYTHON_EXE%" "%~dp0scripts\init_database.py"
) else (
    :: Run with arguments passed from command line
    "%PYTHON_EXE%" "%~dp0scripts\init_database.py" --dbname "%~1" --user "%~2" --password "%~3" --port "%~4" --host "%~5"
)

set "EXIT_CODE=%errorlevel%"

echo.
if %EXIT_CODE% equ 0 (
    echo [SUCCESS] Database setup and schema generation finished successfully!
) else (
    echo [ERROR] Database setup exited with code %EXIT_CODE%.
)
echo.

pause
exit /b %EXIT_CODE%
