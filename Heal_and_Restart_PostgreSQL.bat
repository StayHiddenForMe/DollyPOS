@echo off
setlocal
title Dolly POS - PostgreSQL 1-Click Service Healer and Restarter
cd /d "%~dp0"

:: Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator Privileges to restart PostgreSQL service...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

if exist "%~dp0scripts\heal_and_restart_postgresql.ps1" (
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\heal_and_restart_postgresql.ps1"
) else if exist "%~dp0heal_and_restart_postgresql.ps1" (
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0heal_and_restart_postgresql.ps1"
) else (
    echo Error: heal_and_restart_postgresql.ps1 not found.
    pause
)

exit /b
