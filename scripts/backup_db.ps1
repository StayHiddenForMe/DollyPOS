# Dolly POS - Manual Database Backup Script
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "$HOME\DollyPOS_Backups"

if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$BackupFile = "$BackupDir\DollyToysKidsWear_$timestamp.sql"

$env:PGPASSWORD = "somesh123"
Write-Host "Creating backup of DollyToysKidsWear database..." -ForegroundColor Cyan

pg_dump -U postgres -h localhost -p 5432 -d dollytoyskidswear -F p -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $BackupFile).Length / 1KB
    Write-Host "Backup created successfully at: $BackupFile ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "Backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
