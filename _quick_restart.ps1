Write-Host "Deteniendo Node..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Write-Host "Iniciando servicios..." -ForegroundColor Green
& "$PSScriptRoot\start_detached.ps1"
Start-Sleep -Seconds 2

Write-Host "Verificando procesos..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | Format-Table

Write-Host "Reinicio completado!" -ForegroundColor Green
