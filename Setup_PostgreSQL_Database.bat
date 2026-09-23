@echo off
setlocal
title Dolly POS - PostgreSQL Database Setup Launcher

:: Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator Privileges to install and configure PostgreSQL...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

:: Launch PowerShell Engine
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_database.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] PostgreSQL setup encountered an issue. See details above.
    pause
)


