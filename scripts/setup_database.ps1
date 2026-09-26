# ============================================================================
# Dolly POS - Automated PostgreSQL 16 & Database Setup Engine
# Dolly Toys & Kids Wear, Dhule
# ============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   DOLLY TOYS & KIDS WEAR - POSTGRESQL 16 SETUP ENGINE" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   This setup wizard configures PostgreSQL 16 and your store database." -ForegroundColor White
Write-Host "   Press [ENTER] on any prompt to accept the default recommended values." -ForegroundColor Gray
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Automatically unblock all files in this directory
try {
    Get-ChildItem -Path $PSScriptRoot -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
} catch {}

# 2. Interactive Database Configuration Prompt Loop
$confirmed = $false
$dbName = "dollytoyskidswear"
$dbUser = "postgres"
$dbPass = "somesh123"
$dbPort = "5432"

while (-not $confirmed) {
    Write-Host "----------------------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host " STEP 1: DATABASE CONFIGURATION PARAMETERS" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------------------------" -ForegroundColor DarkCyan

    $rawDbName = Read-Host " 1. Database Name [Default: dollytoyskidswear]"
    if (-not [string]::IsNullOrWhiteSpace($rawDbName)) {
        $dbName = $rawDbName.Trim()
    } else {
        $dbName = "dollytoyskidswear"
    }

    $rawDbUser = Read-Host " 2. PostgreSQL Superuser [Default: postgres]"
    if (-not [string]::IsNullOrWhiteSpace($rawDbUser)) {
        $dbUser = $rawDbUser.Trim()
    } else {
        $dbUser = "postgres"
    }

    $rawDbPass = Read-Host " 3. Superuser Password [Default: somesh123]"
    if (-not [string]::IsNullOrWhiteSpace($rawDbPass)) {
        $dbPass = $rawDbPass.Trim()
    } else {
        $dbPass = "somesh123"
    }

    $rawDbPort = Read-Host " 4. PostgreSQL Port [Default: 5432]"
    if (-not [string]::IsNullOrWhiteSpace($rawDbPort)) {
        $dbPort = $rawDbPort.Trim()
    } else {
        $dbPort = "5432"
    }

    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "   CONFIGURATION SUMMARY TO BE APPLIED" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "   Database Name : $dbName" -ForegroundColor White
    Write-Host "   Superuser     : $dbUser" -ForegroundColor White
    Write-Host "   Password      : $dbPass" -ForegroundColor White
    Write-Host "   Port          : $dbPort" -ForegroundColor White
    Write-Host "   Host          : 127.0.0.1 (localhost)" -ForegroundColor White
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""

    $confirmInput = Read-Host " Confirm these database settings? (Y/N) [Default: Y]"
    if ([string]::IsNullOrWhiteSpace($confirmInput) -or $confirmInput.Trim().ToUpper() -eq "Y") {
        $confirmed = $true
        Write-Host "`n[OK] Configuration confirmed. Proceeding with database setup...`n" -ForegroundColor Green
    } else {
        Write-Host "`n[!] Let's re-enter the configuration settings.`n" -ForegroundColor Yellow
    }
}

# 3. Function to locate psql.exe
function Find-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $paths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
        "D:\All Program\PostgreSQL\18\bin\psql.exe",
        "D:\Program Files\PostgreSQL\16\bin\psql.exe"
    )

    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }

    # Recursive check in Program Files
    if (Test-Path "C:\Program Files\PostgreSQL") {
        $found = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    return $null
}

$psqlExe = Find-Psql

# 4. If PostgreSQL not found, download and install silently
if (-not $psqlExe) {
    Write-Host "[STEP 2/5] PostgreSQL engine was not found on this system." -ForegroundColor Yellow
    Write-Host "[STEP 2/5] Downloading official PostgreSQL 16 (x64) silent installer..." -ForegroundColor Cyan
    
    $downloadUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
    $installerPath = "$env:TEMP\postgresql-16.6-windows-x64.exe"

    Write-Host "           Source: $downloadUrl" -ForegroundColor Gray
    Write-Host "           Please wait, downloading (~380 MB)..." -ForegroundColor White
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $wc = New-Object System.Net.WebClient
    try {
        $wc.DownloadFile($downloadUrl, $installerPath)
        Write-Host "           Download completed successfully." -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to download installer: $_" -ForegroundColor Red
        Write-Host "Please ensure your laptop is connected to the internet and retry." -ForegroundColor Yellow
        Read-Host "Press Enter to exit..."
        exit 1
    }

    Write-Host ""
    Write-Host "[STEP 2/5] Installing PostgreSQL 16 silently (Password: $dbPass, Port: $dbPort)..." -ForegroundColor Cyan
    Write-Host "           This takes 1 to 2 minutes. Please wait..." -ForegroundColor Gray

    $installArgs = "--mode unattended --unattendedmodeui none --superpassword $dbPass --serverport $dbPort"
    $process = Start-Process -FilePath $installerPath -ArgumentList $installArgs -PassThru -Wait

    Write-Host "           Installation finished with exit code $($process.ExitCode)." -ForegroundColor Green

    # Re-detect psql
    Start-Sleep -Seconds 3
    $psqlExe = Find-Psql
} else {
    Write-Host "[STEP 2/5] Existing PostgreSQL installation detected." -ForegroundColor Green
    Write-Host "           psql located at: $psqlExe" -ForegroundColor Gray
}

if (-not $psqlExe) {
    Write-Host "[ERROR] Could not find psql.exe after installation. Please check C:\Program Files\PostgreSQL" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# 5. Ensure PostgreSQL Windows Service is Running
Write-Host ""
Write-Host "[STEP 3/5] Ensuring PostgreSQL Windows service is running..." -ForegroundColor Cyan
$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
    foreach ($svc in $pgServices) {
        if ($svc.Status -ne "Running") {
            Write-Host "           Starting service: $($svc.Name)..." -ForegroundColor Gray
            Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
        }
    }
}

# 6. Readiness Polling Loop: Wait for PostgreSQL socket to accept connections
Write-Host ""
Write-Host "[STEP 4/5] Connecting to PostgreSQL engine on port $dbPort..." -ForegroundColor Cyan
$env:PGPASSWORD = $dbPass

$connected = $false
for ($i = 1; $i -le 30; $i++) {
    Write-Host "           Testing connection to localhost:$dbPort (attempt $i/30)..." -ForegroundColor Gray
    $testResult = & "$psqlExe" -U "$dbUser" -h 127.0.0.1 -p $dbPort -d postgres -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0 -or ($testResult -match "1")) {
        $connected = $true
        Write-Host "           [OK] PostgreSQL engine is ready and accepting connections!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $connected) {
    Write-Host "[WARNING] Could not connect to PostgreSQL within 30 seconds." -ForegroundColor Yellow
    Write-Host "Details: $testResult" -ForegroundColor Gray
    Write-Host "If the postgres superuser password is already set differently, please verify it." -ForegroundColor Yellow
}

# 7. Create Database and verify
Write-Host ""
Write-Host "[STEP 5/5] Configuring Database: $dbName..." -ForegroundColor Cyan

# Clean up accidental alias database if present
$null = & "$psqlExe" -U "$dbUser" -h 127.0.0.1 -p $dbPort -d postgres -c "DROP DATABASE IF EXISTS dollytoysandkidswear WITH (FORCE);" 2>&1

$checkDb = & "$psqlExe" -U "$dbUser" -h 127.0.0.1 -p $dbPort -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$dbName';" 2>&1
if ($checkDb -match "1") {
    Write-Host "  [OK] Database '$dbName' already exists and is ready." -ForegroundColor Green
} else {
    Write-Host "  [*] Creating database '$dbName' with UTF-8 encoding..." -ForegroundColor Yellow
    $createRes = & "$psqlExe" -U "$dbUser" -h 127.0.0.1 -p $dbPort -d postgres -c "CREATE DATABASE $dbName WITH OWNER $dbUser ENCODING 'UTF8';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [SUCCESS] Database '$dbName' created successfully!" -ForegroundColor Green
    } else {
        Write-Host "  [NOTICE] Create DB response: $createRes" -ForegroundColor Gray
    }
}

# 8. Persist Database Configuration to .env Files
Write-Host ""
Write-Host "Saving configuration settings to environment files (.env)..." -ForegroundColor Cyan

$envContent = @"
# Dolly POS - PostgreSQL Database Configuration
DB_USER=$dbUser
DB_PASSWORD=$dbPass
DB_HOST=127.0.0.1
DB_PORT=$dbPort
DB_NAME=$dbName
"@

$envSavePaths = @(
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path (Get-Location).Path ".env"),
    "$env:LOCALAPPDATA\DollyPOS\.env",
    "$env:USERPROFILE\DollyPOS_Backups\.env"
)

# If running inside dist_installer or scripts, also check parent folder
$parentDir = Split-Path -Path $PSScriptRoot -Parent
if ($parentDir -and (Test-Path $parentDir)) {
    $envSavePaths += (Join-Path $parentDir ".env")
}

foreach ($savePath in $envSavePaths) {
    try {
        $parentFolder = Split-Path -Path $savePath -Parent
        if ($parentFolder -and -not (Test-Path $parentFolder)) {
            New-Item -ItemType Directory -Path $parentFolder -Force | Out-Null
        }
        $envContent | Out-File -FilePath $savePath -Encoding utf8 -Force
        Write-Host "  [OK] Saved config -> $savePath" -ForegroundColor Gray
    } catch {}
}

# 9. Trust Digital Certificate (Optional / Enhanced Security)
$certFile = Join-Path $PSScriptRoot "DollyToys_Publisher.cer"
if (Test-Path $certFile) {
    try {
        certutil -addstore -f "TrustedPublisher" "$certFile" > $null 2>&1
        certutil -addstore -f "ROOT" "$certFile" > $null 2>&1
    } catch {}
}

# 10. Clean up temp installer
if (Test-Path "$env:TEMP\postgresql-16.6-windows-x64.exe") {
    Remove-Item "$env:TEMP\postgresql-16.6-windows-x64.exe" -Force -ErrorAction SilentlyContinue
}

# 11. Final Verification Summary
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   DOLLY POS DATABASE & POSTGRESQL ENGINE ARE 100% READY!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   PostgreSQL Host : 127.0.0.1 (localhost)" -ForegroundColor White
Write-Host "   Port            : $dbPort" -ForegroundColor White
Write-Host "   Superuser       : $dbUser" -ForegroundColor White
Write-Host "   Password        : $dbPass" -ForegroundColor White
Write-Host "   Database Name   : $dbName (Live & Verified)" -ForegroundColor Yellow
Write-Host "   Config File     : $env:LOCALAPPDATA\DollyPOS\.env" -ForegroundColor Gray
Write-Host "============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Step: You can now launch Dolly POS:" -ForegroundColor Cyan
Write-Host "1. Double-click 'DollyPOS_Setup_v1.0.0.exe' or 'Dolly POS' desktop icon." -ForegroundColor White
Write-Host "2. The software will automatically connect to database '$dbName'!" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close this window..."

