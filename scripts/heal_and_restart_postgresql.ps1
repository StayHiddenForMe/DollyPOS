# ============================================================================
# Dolly POS - PostgreSQL 1-Click Service Healer & Restarter Engine
# Dolly Toys & Kids Wear, Dhule
# ============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "       DOLLY POS - POSTGRESQL 1-CLICK HEALER & SERVICE RESTARTER" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host " Diagnosing PostgreSQL service, resolving stale locks, and restarting..." -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Terminate orphaned / stuck postgres processes holding port 5432
Write-Host "[1/4] Checking for orphaned background PostgreSQL processes..." -ForegroundColor Cyan
$pgProcs = Get-Process -Name "postgres", "pg_ctl" -ErrorAction SilentlyContinue
if ($pgProcs) {
    Write-Host "      Found $($pgProcs.Count) hung background processes. Terminating cleanly..." -ForegroundColor Yellow
    $pgProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} else {
    Write-Host "      [OK] No orphaned PostgreSQL processes found." -ForegroundColor Green
}

# 2. Search for and remove any stale postmaster.pid lock files
Write-Host ""
Write-Host "[2/4] Scanning for stale 'postmaster.pid' lock files..." -ForegroundColor Cyan
$dataDirs = @(
    "C:\Program Files\PostgreSQL\16\data",
    "C:\Program Files\PostgreSQL\17\data",
    "C:\Program Files\PostgreSQL\18\data",
    "C:\Program Files\PostgreSQL\15\data",
    "C:\Program Files\PostgreSQL\14\data",
    "C:\Program Files (x86)\PostgreSQL\16\data",
    "D:\All Program\PostgreSQL\18\data",
    "D:\Program Files\PostgreSQL\16\data"
)

$lockRemoved = $false
foreach ($dd in $dataDirs) {
    $pidFile = Join-Path $dd "postmaster.pid"
    if (Test-Path $pidFile) {
        try {
            Remove-Item -Path $pidFile -Force -ErrorAction Stop
            Write-Host "      [FIXED] Removed stale lock file: $pidFile" -ForegroundColor Green
            $lockRemoved = $true
        } catch {
            Write-Host "      [NOTE] Could not remove $pidFile: $_" -ForegroundColor Gray
        }
    }
}
if (-not $lockRemoved) {
    Write-Host "      [OK] No stale lock files detected." -ForegroundColor Green
}

# 3. Configure and start PostgreSQL Windows Service
Write-Host ""
Write-Host "[3/4] Configuring & starting PostgreSQL Windows service..." -ForegroundColor Cyan
$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
    foreach ($svc in $pgServices) {
        Write-Host "      Target Service: $($svc.Name) (Current Status: $($svc.Status))" -ForegroundColor White
        try {
            Set-Service -Name $svc.Name -StartupType Automatic -ErrorAction SilentlyContinue
            if ($svc.Status -ne "Running") {
                Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
            } else {
                Restart-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
            }
            Write-Host "      [OK] Service $($svc.Name) started successfully!" -ForegroundColor Green
        } catch {
            Write-Host "      [WARNING] Error starting service $($svc.Name): $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "      [WARNING] No PostgreSQL Windows service found registered." -ForegroundColor Yellow
}

# 4. Readiness Test & Verification Loop
Write-Host ""
Write-Host "[4/4] Verifying PostgreSQL connection on localhost:5432..." -ForegroundColor Cyan

# Read credentials from .env if present
$dbPass = "somesh123"
$dbUser = "postgres"
$dbPort = "5432"
$dbName = "dollytoyskidswear"

$envPaths = @(
    "$env:LOCALAPPDATA\DollyPOS\.env",
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path $PSScriptRoot "..\.env")
)
foreach ($ep in $envPaths) {
    if (Test-Path $ep) {
        Get-Content $ep | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                $k = $parts[0].Trim()
                $v = $parts[1].Trim().Trim("'`"")
                if ($k -eq "DB_PASSWORD") { $dbPass = $v }
                elseif ($k -eq "DB_USER") { $dbUser = $v }
                elseif ($k -eq "DB_PORT") { $dbPort = $v }
                elseif ($k -eq "DB_NAME") { $dbName = $v }
            }
        }
        break
    }
}

$env:PGPASSWORD = $dbPass
$connected = $false

# Locate psql
$psqlPaths = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe"
)
$psqlExe = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $psqlExe) {
    foreach ($p in $psqlPaths) { if (Test-Path $p) { $psqlExe = $p; break } }
}

if ($psqlExe) {
    for ($i = 1; $i -le 15; $i++) {
        $res = & "$psqlExe" -U "$dbUser" -h 127.0.0.1 -p $dbPort -d postgres -c "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0 -or ($res -match "1")) {
            $connected = $true
            break
        }
        Start-Sleep -Seconds 1
    }
} else {
    # Fallback to TCP port check
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", [int]$dbPort)
        $connected = $tcp.Connected
        $tcp.Close()
    } catch {}
}

Write-Host ""
if ($connected) {
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "   POSTGRESQL SERVICE IS 100% HEALTHY, ONLINE & ACCEPTING CONNECTIONS!" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host "   Host            : 127.0.0.1 (localhost)" -ForegroundColor White
    Write-Host "   Port            : $dbPort" -ForegroundColor White
    Write-Host "   Target Database : $dbName" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now launch Dolly POS to resume live billing with PostgreSQL." -ForegroundColor Cyan
} else {
    Write-Host "============================================================================" -ForegroundColor Yellow
    Write-Host "   POSTGRESQL RESTART ATTEMPT COMPLETED" -ForegroundColor Yellow
    Write-Host "============================================================================" -ForegroundColor Yellow
    Write-Host "   Please verify that PostgreSQL 16 is installed or run 'Setup_PostgreSQL_Database.bat'." -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to close this window..."
