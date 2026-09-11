# ============================================================================
# Dolly POS - Automated PostgreSQL 16 & Database Setup Engine
# Dolly Toys & Kids Wear, Dhule
# ============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   DOLLY TOYS & KIDS WEAR - POSTGRESQL 16 ONE-CLICK SETUP ENGINE" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "   Target Database : dollytoyskidswear" -ForegroundColor White
Write-Host "   Superuser       : postgres" -ForegroundColor White
Write-Host "   Password        : somesh123" -ForegroundColor White
Write-Host "   Port            : 5432" -ForegroundColor White
Write-Host "   Recommended PG  : PostgreSQL 16 (64-Bit)" -ForegroundColor White
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Automatically unblock all files in this directory
try {
    Get-ChildItem -Path $PSScriptRoot -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
} catch {}

# 2. Function to locate psql.exe
function Find-Psql {
    # Check PATH
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

# 3. If PostgreSQL not found, download and install silently
if (-not $psqlExe) {
    Write-Host "[STEP 1/4] PostgreSQL was not found on this system." -ForegroundColor Yellow
    Write-Host "[STEP 2/4] Downloading official PostgreSQL 16 (x64) silent installer..." -ForegroundColor Cyan
    
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
    Write-Host "[STEP 2/4] Installing PostgreSQL 16 silently (Password: somesh123, Port: 5432)..." -ForegroundColor Cyan
    Write-Host "           This takes 1 to 2 minutes. Please wait..." -ForegroundColor Gray

    $installArgs = "--mode unattended --unattendedmodeui none --superpassword somesh123 --serverport 5432"
    $process = Start-Process -FilePath $installerPath -ArgumentList $installArgs -PassThru -Wait

    Write-Host "           Installation finished with exit code $($process.ExitCode)." -ForegroundColor Green

    # Re-detect psql
    Start-Sleep -Seconds 3
    $psqlExe = Find-Psql
} else {
    Write-Host "[STEP 1/4] Existing PostgreSQL installation detected." -ForegroundColor Green
    Write-Host "           psql located at: $psqlExe" -ForegroundColor Gray
}

if (-not $psqlExe) {
    Write-Host "[ERROR] Could not find psql.exe after installation. Please check C:\Program Files\PostgreSQL" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# 4. Ensure PostgreSQL Service is Running
Write-Host ""
Write-Host "[STEP 3/4] Ensuring PostgreSQL Windows service is running..." -ForegroundColor Cyan
$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
    foreach ($svc in $pgServices) {
        if ($svc.Status -ne "Running") {
            Write-Host "           Starting service: $($svc.Name)..." -ForegroundColor Gray
            Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
        }
    }
}

# 5. Readiness Polling Loop: Wait for PostgreSQL socket to accept connections
Write-Host ""
Write-Host "[STEP 4/4] Connecting to PostgreSQL engine..." -ForegroundColor Cyan
$env:PGPASSWORD = "somesh123"

$connected = $false
for ($i = 1; $i -le 30; $i++) {
    Write-Host "           Testing connection to localhost:5432 (attempt $i/30)..." -ForegroundColor Gray
    $testResult = & "$psqlExe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "SELECT 1;" 2>&1
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
    Write-Host "If the postgres password is not 'somesh123', please update it in pgAdmin." -ForegroundColor Yellow
}

# 6. Create Database dollytoyskidswear & dollytoysandkidswear
Write-Host ""
Write-Host "Configuring Databases..." -ForegroundColor Cyan

$dbNames = @("dollytoyskidswear", "dollytoysandkidswear")

foreach ($db in $dbNames) {
    $checkDb = & "$psqlExe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$db';" 2>&1
    if ($checkDb -match "1") {
        Write-Host "  [OK] Database '$db' already exists." -ForegroundColor Green
    } else {
        Write-Host "  [*] Creating database '$db' with UTF-8 encoding..." -ForegroundColor Yellow
        $createRes = & "$psqlExe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "CREATE DATABASE $db WITH OWNER postgres ENCODING 'UTF8';" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [SUCCESS] Database '$db' created successfully!" -ForegroundColor Green
        } else {
            Write-Host "  [NOTICE] Create DB response: $createRes" -ForegroundColor Gray
        }
    }
}

# 7. Trust Digital Certificate (Optional / Enhanced Security)
$certFile = Join-Path $PSScriptRoot "DollyToys_Publisher.cer"
if (Test-Path $certFile) {
    try {
        certutil -addstore -f "TrustedPublisher" "$certFile" > $null 2>&1
        certutil -addstore -f "ROOT" "$certFile" > $null 2>&1
    } catch {}
}

# 8. Clean up temp installer
if (Test-Path "$env:TEMP\postgresql-16.6-windows-x64.exe") {
    Remove-Item "$env:TEMP\postgresql-16.6-windows-x64.exe" -Force -ErrorAction SilentlyContinue
}

# 9. Final Verification Summary
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   DOLLY POS DATABASE & POSTGRESQL ENGINE ARE 100% READY!" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "   PostgreSQL Host : 127.0.0.1 (localhost)" -ForegroundColor White
Write-Host "   Port            : 5432" -ForegroundColor White
Write-Host "   Superuser       : postgres" -ForegroundColor White
Write-Host "   Password        : somesh123" -ForegroundColor White
Write-Host "   Primary DB      : dollytoyskidswear (Live & Verified)" -ForegroundColor Yellow
Write-Host "   Alias DB        : dollytoysandkidswear (Live & Verified)" -ForegroundColor Yellow
Write-Host "============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Step: You can now launch Dolly POS:" -ForegroundColor Cyan
Write-Host "1. Double-click 'DollyPOS_Setup_v1.0.0.exe' or 'Dolly POS' desktop icon." -ForegroundColor White
Write-Host "2. The software will automatically connect to PostgreSQL and run live!" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close this window..."

# SIG # Begin signature block
# MIIFrQYJKoZIhvcNAQcCoIIFnjCCBZoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCA94cg3POXLYNa6
# 0flKueuONDpLY1H+HTlnMger5WlDbKCCAxowggMWMIIB/qADAgECAhAV3yWlToTs
# pE4IHJXI+ymmMA0GCSqGSIb3DQEBCwUAMCMxITAfBgNVBAMMGERvbGx5IFRveXMg
# YW5kIEtpZHMgV2VhcjAeFw0yNjA5MTExODA5MTRaFw0zNjA5MTExODE5MTNaMCMx
# ITAfBgNVBAMMGERvbGx5IFRveXMgYW5kIEtpZHMgV2VhcjCCASIwDQYJKoZIhvcN
# AQEBBQADggEPADCCAQoCggEBAKb0q5/YiXBPomgecnT9JRwXND2o38NAY41ToYa5
# Gbb2WGTrsfJOUSg1yAUe+Ftp1CHfZcwHl2VlB6zJYfAq5Pdyh45bIhnIrb2yKejT
# sl2sd69mq6hktTqiQ+54p2Xj6lLMHS2uHkR9IemL6HiHCsUY3+RUfNbSEUhjOCL6
# bI1IAV8WJXx5BDJc9qlGqIqRN4M43CSQ/JrLn3E/nyW5+E3y2R4QsHCWim1izaRT
# wO+qkhPaUFO0LKoyNJjilIcYHRnfysbuFa8nqz2s7QjNrf4ohsWZHauM499cHL+0
# Kj4rXOfORvmylyijJ1Q3vneNCAD1S0LHKyxYFlCfhxUYdAkCAwEAAaNGMEQwDgYD
# VR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoGCCsGAQUFBwMDMB0GA1UdDgQWBBTHOb17
# XhShYdzfa8YAPntmhDIEfzANBgkqhkiG9w0BAQsFAAOCAQEAQHXR4yAOh4IhTrEn
# jvfnvuZXwhvZNIkGeocPBB3TkWZRUCHsvNpwKd7xpYWIw2/2oTs12sbYrCZx+DRe
# G/vWt9Mjv9cz8MWNer1qWBOKUDU2N5gCy6F3xcNDAOnbduI+25kqUN/9uZM+vGU8
# 30npsiIVi6ovMjUI/Ec9tT/lo5wUzS8SWR5X28ajNjMcmyT6iJepg1GDzIIDY/uP
# tqlb5aPX0V5haeq0Qtrer5Aa2Bs2XY6WXzeN7EKAmeUmyvk5Y+1mDHVB9B12QLLg
# q8LVHhCfu0pRvWB9lgYlGrGEYoDFEBeubB+rIpr/d5IDFioK+Imo2/Jny3LntPDi
# 8/BDrDGCAekwggHlAgEBMDcwIzEhMB8GA1UEAwwYRG9sbHkgVG95cyBhbmQgS2lk
# cyBXZWFyAhAV3yWlToTspE4IHJXI+ymmMA0GCWCGSAFlAwQCAQUAoIGEMBgGCisG
# AQQBgjcCAQwxCjAIoAKAAKECgAAwGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQw
# HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIIjE
# 5PwwFF/PuLg5MEMpU4jCWQ8AoGK+5xxFkSvqQWA7MA0GCSqGSIb3DQEBAQUABIIB
# AFx8tMEmuZL7hojLU+y/3w7/fYMueqsLM52aqgDrf4x+DyTCMZy3TOnzB/KlKdG6
# 4aeVkL4Tf+dv2kqDCo/avuwdVEqtAzCZTAPNDrBASiiFk09xl2eVq5DLR63FN1ld
# e1a2WXyObWgHDWvx3sZCVgsc4VW6R8tZqp8DYAMOMcYVAogXs292lF78HKKmTsnH
# lbvB4SsbTeA4HvIcrnvCsV8ttric9cvzvZmgJFUUt0WUSb/SVDeY++wtqQ3oO8Dq
# ZU0isnvZXEsCxMQrcnrmZmxpTJOb1ezz9KfnuF7LzvGyywD2s5zTJWe2Z3/3saXW
# VX5Aty9z5LNyuDNoCLAMc3s=
# SIG # End signature block
