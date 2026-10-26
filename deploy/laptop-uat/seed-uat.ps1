# Mengisi server UAT (yang sudah menyala lewat start-uat.ps1) dengan 3 lapak + produk contoh, lalu menyimpan snapshot "baseline".
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\seed-uat.ps1
# Akun pemilik lapak contoh (kata sandi acak) ditulis ke deploy\.uat-sample-accounts.txt (tidak masuk git).
param([switch]$ForceSnapshot)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
foreach ($name in @("MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "SITE_ADDRESS", "HTTP_PORT", "HTTPS_PORT", "CORS_ALLOWED_ORIGINS", "TZ", "DATABASE_URL")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
$envFile = Join-Path $repo "deploy\.env.production"
if (-not (Test-Path $envFile)) { throw "Jalankan start-uat.ps1 dulu (belum ada deploy\.env.production)." }
$compose = @("compose", "--env-file", $envFile, "-f", (Join-Path $repo "deploy\docker-compose.prod.yml"))
$sampleFile = Join-Path $repo "deploy\.uat-sample-accounts.txt"

$output = & docker @compose exec -T backend node scripts/seedUat.js 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { $output | ForEach-Object { Write-Host $_ }; throw "Seed gagal. Pastikan server menyala (start-uat.ps1) dan gambar backend sudah dibangun ulang (start-uat.ps1 membangunnya otomatis)." }
$output | Where-Object { $_ -notmatch "^SAMPLE " -and $_ -notmatch "injected env" } | ForEach-Object { Write-Host $_ }
$lines = @($output | Where-Object { $_ -match "^SAMPLE " } | ForEach-Object { $parts = ($_ -replace "^SAMPLE ", "") -split " ", 3; "Email: $($parts[0])  Kata sandi: $($parts[1])  Lapak: $($parts[2])" })
if ($lines.Count -gt 0) {
  if (-not (Test-Path $sampleFile)) { Set-Content -Path $sampleFile -Value @("Akun pemilik lapak contoh UAT (jangan dibagikan, jangan di-commit)") -Encoding ascii }
  Add-Content -Path $sampleFile -Value $lines -Encoding ascii
  Write-Host "Akun lapak contoh ditulis ke deploy\.uat-sample-accounts.txt"
}

# Snapshot baseline supaya bisa dikembalikan kapan saja.
# Baseline hanya dibuat bila belum ada, supaya menjalankan seed ulang setelah ada data peserta tidak menimpa baseline. Paksa dengan -ForceSnapshot.
if ($ForceSnapshot -or -not (Test-Path (Join-Path $repo "deploy/backups-uat/baseline.sql"))) { powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "snapshot-uat.ps1") } else { Write-Host "Snapshot baseline sudah ada; tidak ditimpa (pakai -ForceSnapshot untuk menimpa)." }
