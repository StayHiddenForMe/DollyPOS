# Dolly POS - Manual Database Backup Script
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "$HOME\DollyPOS_Backups"

# Default parameters
$dbUser = "postgres"
$dbPass = "somesh123"
$dbHost = "127.0.0.1"
$dbPort = "5432"
$dbName = "dollytoyskidswear"

# Load .env if present
$envPaths = @(
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path $PSScriptRoot "..\.env"),
    "$env:LOCALAPPDATA\DollyPOS\.env",
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
                if ($k -eq "DB_USER") { $dbUser = $v }
                elseif ($k -eq "DB_PASSWORD") { $dbPass = $v }
                elseif ($k -eq "DB_HOST") { $dbHost = $v }
                elseif ($k -eq "DB_PORT") { $dbPort = $v }
                elseif ($k -eq "DB_NAME") { $dbName = $v }
            }
        }
        break
    }
}

if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$BackupFile = "$BackupDir\${dbName}_$timestamp.sql"

$env:PGPASSWORD = $dbPass
Write-Host "Creating backup of $dbName database on $dbHost:$dbPort..." -ForegroundColor Cyan

pg_dump -U $dbUser -h $dbHost -p $dbPort -d $dbName -F p -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $BackupFile).Length / 1KB
    Write-Host "Backup created successfully at: $BackupFile ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "Backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

