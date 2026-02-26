$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $root '.runtime'
$logsDir = Join-Path $runtimeDir 'logs'
$pidFile = Join-Path $runtimeDir 'pids.json'

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Ensure-PortFree {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $procId = [int]$listener.OwningProcess
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 300
      Write-Output "Liberado puerto $Port (PID $procId)"
    } catch {
      throw "No se pudo liberar el puerto $Port (PID $procId). Cierra ese proceso o ejecuta PowerShell como administrador."
    }
  }
}

$nodeDir = Get-ChildItem (Join-Path $root '.tools') -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'node-*-win-x64' } |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $nodeDir) {
  throw "No se encontró Node portable en .tools."
}

$nodePath = Join-Path $nodeDir.FullName 'node.exe'
if (-not (Test-Path $nodePath)) {
  throw "No existe node.exe en $($nodeDir.FullName)"
}

$backendLog = Join-Path $logsDir 'backend.log'
$frontendLog = Join-Path $logsDir 'frontend.log'
$backendErrLog = Join-Path $logsDir 'backend.err.log'
$frontendErrLog = Join-Path $logsDir 'frontend.err.log'

Ensure-PortFree -Port 4000
Ensure-PortFree -Port 5173

$backendProc = Start-Process -FilePath $nodePath -ArgumentList 'index.js' -WorkingDirectory (Join-Path $root 'backend') -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrLog
$frontendProc = Start-Process -FilePath $nodePath -ArgumentList '.\\node_modules\\vite\\bin\\vite.js','--host','--port','5173','--strictPort' -WorkingDirectory (Join-Path $root 'frontend') -PassThru -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrLog

Start-Sleep -Seconds 2
if ($backendProc.HasExited) {
  throw "Backend no inició correctamente. Revisar log: $backendLog"
}
if ($frontendProc.HasExited) {
  throw "Frontend no inició correctamente. Revisar log: $frontendLog"
}

[pscustomobject]@{
  started_at = (Get-Date).ToString('s')
  backend_pid = $backendProc.Id
  frontend_pid = $frontendProc.Id
} | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Output "Backend PID: $($backendProc.Id)"
Write-Output "Frontend PID: $($frontendProc.Id)"
Write-Output "Logs: $logsDir"
Write-Output "URL: http://localhost:5173"
