# Dolly POS - Complete Launcher Script for Windows
# Dolly Toys and Kids Wear, Dhule

Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "       DOLLY TOYS AND KIDS WEAR - POS & ERP SYSTEM        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "Location: Agra Road, Near Mahatma Gandhi Statue, Dhule" -ForegroundColor Yellow
Write-Host "Contact:  7972558842" -ForegroundColor Yellow
Write-Host ""

$RootPath = Split-Path -Parent $PSScriptRoot

# 1. Start Python FastAPI Backend in Background
Write-Host "[1/2] Starting Python FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$BackendProcess = Start-Process -FilePath "$RootPath\backend\venv\Scripts\python.exe" `
    -ArgumentList "$RootPath\backend\run_backend.py" `
    -WorkingDirectory "$RootPath\backend" `
    -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# 2. Start Frontend Vite Server / Electron Desktop
Write-Host "[2/2] Launching Frontend Interface on http://localhost:5173..." -ForegroundColor Green
Set-Location -Path "$RootPath\frontend"
npm run dev

# Stop backend process when terminal closes
if ($BackendProcess -and !$BackendProcess.HasExited) {
    Stop-Process -Id $BackendProcess.Id -Force
}
