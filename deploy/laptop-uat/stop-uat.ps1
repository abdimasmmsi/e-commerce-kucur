# Menghentikan tunnel dan stack UAT. Data (volume Docker) TIDAK dihapus.
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\stop-uat.ps1
#   tambahkan -DeleteData untuk menghapus seluruh data UAT (akun, pesanan, foto) setelah UAT selesai.
param([switch]$DeleteData)
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
$tunnelPid = Join-Path $PSScriptRoot "tunnel.pid"
if (Test-Path $tunnelPid) {
  Stop-Process -Id ([int](Get-Content $tunnelPid)) -Force -ErrorAction SilentlyContinue
  Remove-Item $tunnelPid -ErrorAction SilentlyContinue
  Write-Host "Tunnel dihentikan."
}
$compose = @("compose", "--env-file", (Join-Path $repo "deploy\.env.production"), "-f", (Join-Path $repo "deploy\docker-compose.prod.yml"))
if ($DeleteData) {
  & docker @compose down -v
  Remove-Item (Join-Path $repo "deploy\.uat-credentials.txt") -ErrorAction SilentlyContinue
  Write-Host "Stack dan seluruh data UAT dihapus."
} else {
  & docker @compose down
  Write-Host "Stack dihentikan (data tetap ada; jalankan start-uat.ps1 untuk menyalakan lagi)."
}
