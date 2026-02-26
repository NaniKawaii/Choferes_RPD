$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path (Join-Path $root '.runtime') 'pids.json'

if (-not (Test-Path $pidFile)) {
  Write-Output 'No existe archivo de PIDs. Nada que detener.'
  exit 0
}

$pids = Get-Content $pidFile -Raw | ConvertFrom-Json
$targets = @($pids.backend_pid, $pids.frontend_pid) | Where-Object { $_ }

foreach ($procId in $targets) {
  try {
    Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop
    Write-Output "Detenido PID $procId"
  } catch {
    Write-Output "PID $procId ya no estaba activo"
  }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Output 'Servicios detenidos.'
