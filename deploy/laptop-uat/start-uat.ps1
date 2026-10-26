# Menjalankan server UAT dari laptop (Docker + Cloudflare Tunnel opsional).
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\start-uat.ps1            # dengan tunnel (bila cloudflared terpasang)
#   powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\start-uat.ps1 -NoTunnel  # hanya http://localhost:8080
# Aman dijalankan berulang: data (volume Docker) dan akun admin tidak dibuat ulang.
param([switch]$NoTunnel, [int]$Port = 8080)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repo
# Variabel di terminal bisa menimpa file .env.production (Docker Compose mengutamakan variabel terminal), mis. MYSQL_PASSWORD
# bawaan dari pengembangan. Bersihkan semua nama yang dipakai compose supaya hanya file .env.production yang berlaku.
foreach ($name in @("MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "SITE_ADDRESS", "HTTP_PORT", "HTTPS_PORT", "CORS_ALLOWED_ORIGINS", "TZ", "AUTH_SESSION_TTL_HOURS", "WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_PRIVATE_KEY", "WEB_PUSH_SUBJECT", "MIDTRANS_SERVER_KEY", "MIDTRANS_CLIENT_KEY", "OPENROUTESERVICE_API_KEY", "DATABASE_URL")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
# Segarkan PATH dari registry supaya program yang baru dipasang (mis. cloudflared) langsung dikenali tanpa membuka terminal baru.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$envFile = Join-Path $repo "deploy\.env.production"
$credFile = Join-Path $repo "deploy\.uat-credentials.txt"
$tunnelLog = Join-Path $PSScriptRoot "tunnel.log"
$tunnelPid = Join-Path $PSScriptRoot "tunnel.pid"
$compose = @("compose", "--env-file", $envFile, "-f", (Join-Path $repo "deploy\docker-compose.prod.yml"))

function New-Secret([int]$bytes = 24) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return ($buffer | ForEach-Object { $_.ToString("x2") }) -join ""
}
function Set-EnvValue([string]$key, [string]$value) {
  $lines = if (Test-Path $envFile) { @(Get-Content $envFile) } else { @() }
  $found = $false
  $lines = @($lines | ForEach-Object { if ($_ -match "^$key=") { $found = $true; "$key=$value" } else { $_ } })
  if (-not $found) { $lines += "$key=$value" }
  Set-Content -Path $envFile -Value $lines -Encoding ascii
}

# 1. Docker harus berjalan.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Menyalakan Docker Desktop..."
  $exe = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe"
  if (-not (Test-Path $exe)) { $exe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe" }
  Start-Process $exe
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
  if ($LASTEXITCODE -ne 0) { throw "Docker belum siap. Buka Docker Desktop lalu jalankan skrip ini lagi." }
}

# 2. File konfigurasi (dibuat sekali, berisi kata sandi acak; tidak masuk git).
$firstRun = -not (Test-Path $envFile)
if ($firstRun) {
  Set-EnvValue "SITE_ADDRESS" ":80"
  Set-EnvValue "HTTP_PORT" "$Port"
  Set-EnvValue "HTTPS_PORT" "8443"
  Set-EnvValue "MYSQL_PASSWORD" (New-Secret 24)
  Set-EnvValue "MYSQL_ROOT_PASSWORD" (New-Secret 24)
  Set-EnvValue "TZ" "Asia/Jakarta"
  Set-EnvValue "CORS_ALLOWED_ORIGINS" "http://localhost:$Port"
  Write-Host "deploy\.env.production dibuat dengan kata sandi acak."
}

# 3. Tunnel HTTPS publik (alamat acak *.trycloudflare.com; berubah setiap tunnel dimulai ulang).
$publicUrl = $null
if (-not $NoTunnel) {
  $cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (-not $cloudflared) {
    Write-Warning "cloudflared belum terpasang, jadi hanya bisa diakses dari laptop ini (http://localhost:$Port). Pasang dengan: winget install Cloudflare.cloudflared"
  } else {
    if (Test-Path $tunnelPid) { Stop-Process -Id ([int](Get-Content $tunnelPid)) -Force -ErrorAction SilentlyContinue }
    Remove-Item $tunnelLog -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $cloudflared.Source -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://localhost:$Port") -RedirectStandardError $tunnelLog -RedirectStandardOutput (Join-Path $PSScriptRoot "tunnel.out.log") -WindowStyle Hidden -PassThru
    Set-Content -Path $tunnelPid -Value $process.Id
    for ($i = 0; $i -lt 40 -and -not $publicUrl; $i++) {
      Start-Sleep -Seconds 2
      if (Test-Path $tunnelLog) { $match = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($match) { $publicUrl = $match.Matches[0].Value } }
    }
    if (-not $publicUrl) { Write-Warning "Alamat tunnel belum muncul; lihat $tunnelLog." }
    else { Set-EnvValue "CORS_ALLOWED_ORIGINS" "$publicUrl,http://localhost:$Port" }
  }
}

# 4. Jalankan stack (build bila ada perubahan) dan tunggu sampai siap.
& docker @compose up -d --build
for ($i = 0; $i -lt 60; $i++) {
  try { $r = Invoke-WebRequest -Uri "http://localhost:$Port/api/products" -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch { }
  Start-Sleep -Seconds 3
}
if (-not $ready) { throw "Server belum siap. Lihat log: docker compose --env-file deploy\.env.production -f deploy\docker-compose.prod.yml logs backend" }

# 5. Akun admin UAT dan nilai awal Pengaturan Platform (sekali saja).
if (-not (Test-Path $credFile)) {
  $adminEmail = "admin.uat@kucur.example"
  $adminPassword = New-Secret 12
  & docker @compose exec -T -e "ADMIN_EMAIL=$adminEmail" -e "ADMIN_PASSWORD=$adminPassword" -e "ADMIN_NAME=Admin UAT" backend npm run admin:create
  if ($LASTEXITCODE -ne 0) { throw "Gagal membuat akun admin." }
  Set-Content -Path $credFile -Value @("Admin UAT (jangan dibagikan, jangan di-commit)", "Email: $adminEmail", "Kata sandi: $adminPassword") -Encoding ascii
  & docker @compose exec -T backend node scripts/uatSettings.js
}

Write-Host ""
Write-Host "=== Server UAT siap ==="
Write-Host "Di laptop ini : http://localhost:$Port"
if ($publicUrl) { Write-Host "Untuk peserta : $publicUrl   (bagikan alamat ini; berubah bila tunnel dimulai ulang)" }
Write-Host "Akun admin    : lihat deploy\.uat-credentials.txt"
Write-Host "Hentikan      : powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\stop-uat.ps1"
Write-Host "Laptop harus tetap menyala, terhubung internet, dan tidak sleep selama sesi UAT."
