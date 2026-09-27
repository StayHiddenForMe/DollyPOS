# ============================================================================
# Dolly POS - Rapid Database Connection Switcher & Configurator
# Dolly Toys & Kids Wear, Dhule
# ============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "       DOLLY POS - DATABASE CONNECTION SWITCHER & RE-CONNECTOR" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host " Switch between existing databases (e.g. database1, dollytoyskidswear)" -ForegroundColor White
Write-Host " or update your PostgreSQL password / port in 5 seconds." -ForegroundColor Gray
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Read current settings if available
$currentDb = "dollytoyskidswear"
$currentUser = "postgres"
$currentPass = "somesh123"
$currentPort = "5432"

$envPaths = @(
    "$env:LOCALAPPDATA\DollyPOS\.env",
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path $PSScriptRoot "..\.env"),
    "$env:USERPROFILE\DollyPOS_Backups\.env"
)

foreach ($ep in $envPaths) {
    if (Test-Path $ep) {
        Get-Content $ep | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                $k = $parts[0].Trim()
                $v = $parts[1].Trim().Trim("'`"")
                if ($k -eq "DB_USER") { $currentUser = $v }
                elseif ($k -eq "DB_PASSWORD") { $currentPass = $v }
                elseif ($k -eq "DB_PORT") { $currentPort = $v }
                elseif ($k -eq "DB_NAME") { $currentDb = $v }
            }
        }
        break
    }
}

Write-Host "Current Connected Database Configuration:" -ForegroundColor DarkCyan
Write-Host "  Database Name : $currentDb" -ForegroundColor White
Write-Host "  Superuser     : $currentUser" -ForegroundColor White
Write-Host "  Port          : $currentPort" -ForegroundColor White
Write-Host "  Host          : 127.0.0.1" -ForegroundColor White
Write-Host "----------------------------------------------------------------------------" -ForegroundColor DarkCyan
Write-Host "Enter new settings (press [ENTER] to keep current values):" -ForegroundColor Gray
Write-Host ""

$inputDb = Read-Host " 1. Target Database Name [Current: $currentDb]"
if ([string]::IsNullOrWhiteSpace($inputDb)) { $inputDb = $currentDb } else { $inputDb = $inputDb.Trim() }

$inputUser = Read-Host " 2. PostgreSQL Username  [Current: $currentUser]"
if ([string]::IsNullOrWhiteSpace($inputUser)) { $inputUser = $currentUser } else { $inputUser = $inputUser.Trim() }

$inputPass = Read-Host " 3. PostgreSQL Password  [Current: $currentPass]"
if ([string]::IsNullOrWhiteSpace($inputPass)) { $inputPass = $currentPass } else { $inputPass = $inputPass.Trim() }

$inputPort = Read-Host " 4. PostgreSQL Port      [Current: $currentPort]"
if ([string]::IsNullOrWhiteSpace($inputPort)) { $inputPort = $currentPort } else { $inputPort = $inputPort.Trim() }

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   NEW CONFIGURATION TO APPLY" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   Database Name : $inputDb" -ForegroundColor White
Write-Host "   Superuser     : $inputUser" -ForegroundColor White
Write-Host "   Port          : $inputPort" -ForegroundColor White
Write-Host "   Host          : 127.0.0.1" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host " Apply this connection configuration? (Y/N) [Default: Y]"
if (-not [string]::IsNullOrWhiteSpace($confirm) -and $confirm.Trim().ToUpper() -ne "Y") {
    Write-Host "`nCancelled. No changes made." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 0
}

# 2. Function to locate psql.exe
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

    if (Test-Path "C:\Program Files\PostgreSQL") {
        $found = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    return $null
}

$psqlExe = Find-Psql
if ($psqlExe) {
    Write-Host "Testing connection to database '$inputDb'..." -ForegroundColor Cyan
    $env:PGPASSWORD = $inputPass
    
    # Check if target database exists
    $checkDb = & "$psqlExe" -U "$inputUser" -h 127.0.0.1 -p $inputPort -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$inputDb';" 2>&1
    if ($checkDb -match "1") {
        Write-Host "  [OK] Existing database '$inputDb' verified on PostgreSQL server!" -ForegroundColor Green
    } else {
        Write-Host "  [*] Database '$inputDb' does not exist yet. Creating it now..." -ForegroundColor Yellow
        $createRes = & "$psqlExe" -U "$inputUser" -h 127.0.0.1 -p $inputPort -d postgres -c "CREATE DATABASE $inputDb WITH OWNER $inputUser ENCODING 'UTF8';" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [SUCCESS] Database '$inputDb' created successfully!" -ForegroundColor Green
        }
    }
}

# 3. Write .env to all locations
$envContent = @"
# Dolly POS - PostgreSQL Database Configuration
DB_USER=$inputUser
DB_PASSWORD=$inputPass
DB_HOST=127.0.0.1
DB_PORT=$inputPort
DB_NAME=$inputDb
"@

$saveLocations = @(
    "$env:LOCALAPPDATA\DollyPOS\.env",
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path (Get-Location).Path ".env"),
    "$env:USERPROFILE\DollyPOS_Backups\.env"
)

$parentDir = Split-Path -Path $PSScriptRoot -Parent
if ($parentDir -and (Test-Path $parentDir)) {
    $saveLocations += (Join-Path $parentDir ".env")
}

foreach ($loc in $saveLocations) {
    try {
        $p = Split-Path -Path $loc -Parent
        if ($p -and -not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
        $envContent | Out-File -FilePath $loc -Encoding utf8 -Force
        Write-Host "  [OK] Updated config -> $loc" -ForegroundColor Gray
    } catch {}
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   DOLLY POS DATABASE CONNECTION SWITCHED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   Connected Database : $inputDb" -ForegroundColor Yellow
Write-Host "   Host / Port        : 127.0.0.1:$inputPort" -ForegroundColor White
Write-Host "   Superuser          : $inputUser" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Step: You can now launch Dolly POS to use database '$inputDb'." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close..."
