# Snapshot dan pemulihan database UAT (kondisi "baseline" = setelah admin, pengaturan, dan lapak contoh siap).
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\snapshot-uat.ps1            # simpan snapshot (menimpa baseline lama)
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\snapshot-uat.ps1 -Restore   # kembalikan database ke snapshot
# Pemulihan menghapus seluruh data UAT sejak snapshot (akun peserta, pesanan, ulasan). Foto unggahan tidak ikut dipulihkan.
param([switch]$Restore, [string]$Name = "baseline")
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
foreach ($var in @("MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "SITE_ADDRESS", "HTTP_PORT", "HTTPS_PORT", "CORS_ALLOWED_ORIGINS", "TZ", "DATABASE_URL", "UAT_ACCOUNTS_JSON", "UAT_SAMPLE_PASSWORD")) { Remove-Item "Env:$var" -ErrorAction SilentlyContinue }
$envFile = Join-Path $repo "deploy\.env.production"
if (-not (Test-Path $envFile)) { throw "Belum ada deploy\.env.production." }
$root = ((Get-Content $envFile | Where-Object { $_ -match "^MYSQL_ROOT_PASSWORD=" }) -replace "^MYSQL_ROOT_PASSWORD=", "").Trim()
$dir = Join-Path $repo "deploy\backups-uat"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir "$Name.sql"
$mysql = "kucur-prod-mysql"

if (-not $Restore) {
  docker exec -e "MYSQL_PWD=$root" $mysql sh -c "mysqldump -uroot --single-transaction --no-tablespaces --routines --default-character-set=utf8mb4 kucur > /tmp/uat-snapshot.sql"
  if ($LASTEXITCODE -ne 0) { throw "mysqldump gagal." }
  docker cp "${mysql}:/tmp/uat-snapshot.sql" $file | Out-Null
  docker exec $mysql rm -f /tmp/uat-snapshot.sql | Out-Null
  $size = [math]::Round((Get-Item $file).Length / 1KB)
  Write-Host "Snapshot '$Name' disimpan: $file ($size KB)"
} else {
  if (-not (Test-Path $file)) { throw "Snapshot '$Name' belum ada ($file). Buat dulu tanpa -Restore." }
  Write-Host "Memulihkan database dari snapshot '$Name' (data UAT sejak snapshot akan hilang)..."
  docker stop kucur-prod-backend | Out-Null
  docker cp $file "${mysql}:/tmp/uat-restore.sql" | Out-Null
  docker exec -e "MYSQL_PWD=$root" $mysql sh -c "mysql -uroot -e 'DROP DATABASE kucur; CREATE DATABASE kucur CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci' && mysql -uroot --default-character-set=utf8mb4 kucur < /tmp/uat-restore.sql && rm -f /tmp/uat-restore.sql"
  if ($LASTEXITCODE -ne 0) { docker start kucur-prod-backend | Out-Null; throw "Pemulihan gagal." }
  docker start kucur-prod-backend | Out-Null
  Write-Host "Selesai. Backend dinyalakan lagi; semua sesi login lama dibuat ulang saat masuk."
}
