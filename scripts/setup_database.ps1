# Automated PostgreSQL Database Setup Script for Dolly POS
$env:PGPASSWORD = "somesh123"

Write-Host "Creating database dollytoyskidswear..." -ForegroundColor Cyan
psql -U postgres -h localhost -c "CREATE DATABASE dollytoyskidswear WITH OWNER postgres ENCODING 'UTF8';"

Write-Host "Running table seeding and initialization..." -ForegroundColor Cyan
$RootPath = Split-Path -Parent $PSScriptRoot
& "$RootPath\backend\venv\Scripts\python.exe" "$RootPath\backend\seed_demo_data.py"

Write-Host "Database ready!" -ForegroundColor Green
