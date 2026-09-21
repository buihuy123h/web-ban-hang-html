# Giai phong cong bi chiem (dung tien trinh dang listen) — dung boi predev/prestart va deploy.
# Chay truc tiep:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\free-port.ps1 [-Port 3000]
param([int]$Port = 3000)
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($conns) {
  $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 600
  Write-Host ("Freed port {0}" -f $Port) -ForegroundColor Yellow
}
