# Mengisi server UAT (yang sudah menyala lewat start-uat.ps1) dengan 3 lapak + produk contoh, lalu menyimpan snapshot "baseline".
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\seed-uat.ps1
# Akun pemilik lapak contoh (kata sandi acak) ditulis ke deploy\.uat-sample-accounts.txt (tidak masuk git).
param([switch]$ForceSnapshot)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
foreach ($name in @("MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "SITE_ADDRESS", "HTTP_PORT", "HTTPS_PORT", "CORS_ALLOWED_ORIGINS", "TZ", "DATABASE_URL", "UAT_ACCOUNTS_JSON", "UAT_SAMPLE_PASSWORD")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
$envFile = Join-Path $repo "deploy\.env.production"
if (-not (Test-Path $envFile)) { throw "Jalankan start-uat.ps1 dulu (belum ada deploy\.env.production)." }
$compose = @("compose", "--env-file", $envFile, "-f", (Join-Path $repo "deploy\docker-compose.prod.yml"))
$sampleFile = Join-Path $repo "deploy\.uat-sample-accounts.txt"

# Kata sandi bersama untuk akun penjual contoh: dibuat sekali, disimpan di .env.production, dan ditampilkan di halaman Masuk (hanya akun berhak rendah, tanpa admin).
$samplePassword = $null
foreach ($line in Get-Content $envFile) { if ($line -match "^UAT_SAMPLE_PASSWORD=(.+)$") { $samplePassword = $Matches[1].Trim() } }
if (-not $samplePassword) {
  $bytes = New-Object byte[] 6
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $samplePassword = "Kucur-" + (($bytes | ForEach-Object { $_.ToString("x2") }) -join "") + "!"
}

$output = & docker @compose exec -T -e "SAMPLE_PASSWORD=$samplePassword" backend node scripts/seedUat.js 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { $output | ForEach-Object { Write-Host $_ }; throw "Seed gagal. Pastikan server menyala (start-uat.ps1) dan gambar backend sudah dibangun ulang (start-uat.ps1 membangunnya otomatis)." }
$output | Where-Object { $_ -notmatch "^SAMPLE " -and $_ -notmatch "injected env" } | ForEach-Object { Write-Host $_ }
$lines = @($output | Where-Object { $_ -match "^SAMPLE " } | ForEach-Object { $parts = ($_ -replace "^SAMPLE ", "") -split " ", 3; "Email: $($parts[0])  Kata sandi: $($parts[1])  Lapak: $($parts[2])" })
if ($lines.Count -gt 0) {
  Set-Content -Path $sampleFile -Value (@("Akun pemilik lapak contoh UAT (tampil juga di halaman Masuk; jangan di-commit)") + $lines) -Encoding ascii
  Write-Host "Akun lapak contoh ditulis ke deploy\.uat-sample-accounts.txt"

  # Bangun ulang web supaya panel akun contoh muncul di halaman Masuk.
  $accounts = @($output | Where-Object { $_ -match "^SAMPLE " } | ForEach-Object { $parts = ($_ -replace "^SAMPLE ", "") -split " ", 3; [ordered]@{ label = ($parts[2] -replace "\s*\(contoh\)\s*$", ""); email = $parts[0]; password = $parts[1] } })
  $json = ConvertTo-Json -InputObject $accounts -Compress
  $kept = @(Get-Content $envFile | Where-Object { $_ -notmatch "^(UAT_SAMPLE_PASSWORD|UAT_ACCOUNTS_JSON)=" })
  Set-Content -Path $envFile -Value ($kept + @("UAT_SAMPLE_PASSWORD=$samplePassword", "UAT_ACCOUNTS_JSON='$json'")) -Encoding ascii
  & docker @compose up -d --build web
  if ($LASTEXITCODE -ne 0) { throw "Gagal membangun ulang web." }
  Write-Host "Panel akun contoh aktif di halaman Masuk."
}

# Snapshot baseline supaya bisa dikembalikan kapan saja.
# Baseline hanya dibuat bila belum ada, supaya menjalankan seed ulang setelah ada data peserta tidak menimpa baseline. Paksa dengan -ForceSnapshot.
if ($ForceSnapshot -or -not (Test-Path (Join-Path $repo "deploy/backups-uat/baseline.sql"))) { powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "snapshot-uat.ps1") } else { Write-Host "Snapshot baseline sudah ada; tidak ditimpa (pakai -ForceSnapshot untuk menimpa)." }
