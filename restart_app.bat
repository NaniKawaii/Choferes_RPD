@echo off
setlocal

set ROOT=%~dp0

echo [1/2] Deteniendo servicios...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%stop_detached.ps1"

echo [2/2] Iniciando servicios...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start_detached.ps1"

echo.
echo Reinicio completado.
echo URL: http://localhost:5173

endlocal
