@echo off
setlocal enabledelayedexpansion
title Dolly POS - PostgreSQL 16 One-Click Database Installer & Setup

:: ============================================================================
:: Check Administrator Privileges (Auto-Elevate if required)
:: ============================================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator Privileges to configure PostgreSQL service...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

color 0B
echo.
echo ============================================================================
echo   DOLLY TOYS ^& KIDS WEAR - POSTGRESQL 16 ONE-CLICK DATABASE SETUP
echo ============================================================================
echo   Application : Dolly POS Retail Management System
echo   Target DB   : dollytoyskidswear
echo   Host/Port   : localhost:5432
echo   DB User     : postgres
echo   DB Password : somesh123
echo   PG Version  : PostgreSQL 16 (64-Bit)
echo ============================================================================
echo.

set "DB_USER=postgres"
set "DB_PASS=somesh123"
set "DB_NAME=dollytoyskidswear"
set "DB_PORT=5432"
set "PG_INSTALLER_URL=https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
set "TEMP_INSTALLER=%TEMP%\postgresql-16.6-windows-x64.exe"
set "PSQL_BIN="

:: ============================================================================
:: Step 1: Detect Existing PostgreSQL Installation
:: ============================================================================
echo [STEP 1/4] Checking for existing PostgreSQL installation...

:: Check PATH first
where psql >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('where psql') do (
        set "PSQL_BIN=%%i"
        goto :found_psql
    )
)

:: Check common default paths
set "CANDIDATES[0]=C:\Program Files\PostgreSQL\16\bin\psql.exe"
set "CANDIDATES[1]=C:\Program Files\PostgreSQL\17\bin\psql.exe"
set "CANDIDATES[2]=C:\Program Files\PostgreSQL\18\bin\psql.exe"
set "CANDIDATES[3]=C:\Program Files\PostgreSQL\15\bin\psql.exe"
set "CANDIDATES[4]=C:\Program Files\PostgreSQL\14\bin\psql.exe"
set "CANDIDATES[5]=D:\All Program\PostgreSQL\18\bin\psql.exe"
set "CANDIDATES[6]=D:\Program Files\PostgreSQL\16\bin\psql.exe"

for /L %%n in (0,1,6) do (
    if exist "!CANDIDATES[%%n]!" (
        set "PSQL_BIN=!CANDIDATES[%%n]!"
        goto :found_psql
    )
)

:: ============================================================================
:: Step 2: Download & Install PostgreSQL 16 if not found
:: ============================================================================
echo [!] PostgreSQL was not detected on this system.
echo [STEP 2/4] Downloading official PostgreSQL 16 (x64) silent installer...
echo     Source: %PG_INSTALLER_URL%
echo     Please wait, downloading (~380 MB)...
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%PG_INSTALLER_URL%', '%TEMP_INSTALLER%')"

if not exist "%TEMP_INSTALLER%" (
    echo [ERROR] Failed to download PostgreSQL installer. Please check internet connection.
    pause
    exit /b 1
)

echo.
echo [STEP 2/4] Installing PostgreSQL 16 silently with standard configuration...
echo     Port: %DB_PORT%
echo     Password: %DB_PASS%
echo     This may take 1 to 2 minutes...

"%TEMP_INSTALLER%" --mode unattended --unattendedmodeui none --superpassword "%DB_PASS%" --serverport %DB_PORT%

:: Re-check installed path
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    set "PSQL_BIN=C:\Program Files\PostgreSQL\16\bin\psql.exe"
)

:found_psql
echo.
echo [OK] PostgreSQL CLI found at: "!PSQL_BIN!"

:: ============================================================================
:: Step 3: Ensure PostgreSQL Service is Running
:: ============================================================================
echo.
echo [STEP 3/4] Ensuring PostgreSQL Windows Service is active...
net start postgresql-x64-16 >nul 2>&1
net start postgresql-x64-17 >nul 2>&1
net start postgresql-x64-18 >nul 2>&1
net start postgresql-x64-15 >nul 2>&1

:: Allow service initialization time
timeout /t 2 /nobreak >nul

:: ============================================================================
:: Step 4: Create Target Database (dollytoyskidswear)
:: ============================================================================
echo.
echo [STEP 4/4] Configuring database: "%DB_NAME%"...

set "PGPASSWORD=%DB_PASS%"

:: Check if database already exists
"!PSQL_BIN!" -U %DB_USER% -h localhost -p %DB_PORT% -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '%DB_NAME%';" > "%TEMP%\pg_check.txt" 2>&1

findstr /C:"1" "%TEMP%\pg_check.txt" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Database "%DB_NAME%" already exists.
) else (
    echo [*] Creating database "%DB_NAME%" (UTF8)...
    "!PSQL_BIN!" -U %DB_USER% -h localhost -p %DB_PORT% -d postgres -c "CREATE DATABASE %DB_NAME% ENCODING 'UTF8';"
    if %errorlevel% equ 0 (
        echo [SUCCESS] Database "%DB_NAME%" created successfully!
    ) else (
        echo [WARNING] Could not create database directly. Please verify postgres superuser password.
    )
)

:: Test Connection to target database
"!PSQL_BIN!" -U %DB_USER% -h localhost -p %DB_PORT% -d %DB_NAME% -c "SELECT 'Connection Successful' as status;" > "%TEMP%\pg_test.txt" 2>&1

findstr /C:"Connection Successful" "%TEMP%\pg_test.txt" >nul 2>&1
if %errorlevel% equ 0 (
    color 0A
    echo.
    echo ============================================================================
    echo   [SUCCESS] POSTGRESQL ^& DOLLY POS DATABASE SETUP COMPLETED!
    echo ============================================================================
    echo   Database Name : %DB_NAME%
    echo   Host / Port   : localhost:%DB_PORT%
    echo   User / Pass   : %DB_USER% / %DB_PASS%
    echo   Connection    : 100%% VERIFIED AND ACTIVE
    echo ============================================================================
    echo.
    echo   You can now launch Dolly POS:
    echo   - Double-click "DollyPOS_Setup_v1.0.0.exe" or "Dolly POS" desktop icon.
    echo   - The software will automatically connect to this PostgreSQL database!
    echo.
) else (
    color 0C
    echo.
    echo ============================================================================
    echo   [NOTICE] Database setup finished, but check the log below:
    echo ============================================================================
    type "%TEMP%\pg_test.txt"
    echo.
    echo   Note: If your postgres password on this laptop is different from "somesh123",
    echo   please update the password in Dolly POS settings or PostgreSQL config.
    echo ============================================================================
)

:: Cleanup temp files
if exist "%TEMP%\pg_check.txt" del "%TEMP%\pg_check.txt"
if exist "%TEMP%\pg_test.txt" del "%TEMP%\pg_test.txt"
if exist "%TEMP_INSTALLER%" del "%TEMP_INSTALLER%"

echo.
pause
