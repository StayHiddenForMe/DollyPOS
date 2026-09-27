@echo off
setlocal
title Dolly POS - Database Connection Switcher
cd /d "%~dp0"

echo ======================================================================
echo          DOLLY POS - DATABASE CONNECTION SWITCHER
echo ======================================================================
echo  Use this tool to connect Dolly POS to an existing database
echo  or update PostgreSQL connection credentials in seconds.
echo ======================================================================
echo.

if exist "%~dp0scripts\change_database_connection.ps1" (
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\change_database_connection.ps1"
) else if exist "%~dp0change_database_connection.ps1" (
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0change_database_connection.ps1"
) else (
    echo Error: change_database_connection.ps1 script not found.
    pause
)

exit /b
