@echo off
title Dolly POS - 1-Click Database Backup
color 0B
echo ===================================================
echo     DOLLY POS - 1-CLICK BACKUP UTILITY
echo ===================================================

set BACKUP_DIR=%~dp0Backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,4%

set SOURCE_DB=%~dp0backend\dolly_pos.db
set TARGET_DB=%BACKUP_DIR%\dolly_pos_backup_%TIMESTAMP%.db

if exist "%SOURCE_DB%" (
    copy "%SOURCE_DB%" "%TARGET_DB%" >nul
    echo [SUCCESS] Database successfully backed up to:
    echo %TARGET_DB%
) else (
    echo [ERROR] Source database file not found at %SOURCE_DB%!
)

echo ===================================================
pause
