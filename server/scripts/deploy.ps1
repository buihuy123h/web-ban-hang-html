# Deploy pipeline: test backend -> build frontend -> restart API server -> health check.
# Run:    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy.ps1
# or from the server folder:  npm run deploy
# Optional: -SkipTests
param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$serverDir = Split-Path -Parent $PSScriptRoot
$clientDir = Join-Path (Split-Path -Parent $serverDir) 'client'

Write-Host '== [1/5] Backend tests ==' -ForegroundColor Cyan
if ($SkipTests) {
  Write-Host 'Skipped (-SkipTests)'
} else {
  npm --prefix $serverDir test
  if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed - deploy aborted.' }
}

Write-Host '== [2/5] Frontend build ==' -ForegroundColor Cyan
npm --prefix $clientDir run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed - deploy aborted.' }

Write-Host '== [3/5] Precompress static assets (Brotli + Gzip) ==' -ForegroundColor Cyan
npm --prefix $serverDir run precompress
if ($LASTEXITCODE -ne 0) { throw 'Precompress failed - deploy aborted.' }

Write-Host '== [4/5] Restart API server (port 3000) ==' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'free-port.ps1') -Port 3000
Start-Process node -ArgumentList 'server.js' -WorkingDirectory $serverDir -WindowStyle Hidden

Write-Host '== [5/5] Health check ==' -ForegroundColor Cyan
$health = $null
for ($i = 0; $i -lt 15; $i++) {
  try {
    $health = Invoke-RestMethod 'http://localhost:3000/api/health'
    if ($health.ok) { break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $health -or -not $health.ok) { throw 'Health check failed after deploy.' }

Write-Host ("OK: {0} v{1} is running at http://localhost:3000" -f $health.name, $health.version) -ForegroundColor Green

