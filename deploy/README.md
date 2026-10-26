# Deploy Kucur ke VPS (Docker Compose + HTTPS otomatis)

Panduan untuk UAT online dan dasar produksi. Satu VPS menjalankan tiga container:

- `kucur-prod-mysql` : MySQL 8.4 (tidak terbuka ke internet)
- `kucur-prod-backend` : API Express + Socket.IO (tidak terbuka ke internet)
- `kucur-prod-web` : Caddy, menyajikan frontend dan meneruskan `/api`, `/uploads`, `/socket.io` ke backend. Hanya ini yang membuka port 80 dan 443, sertifikat HTTPS (Let's Encrypt) diurus otomatis.

Semua perintah di bawah dijalankan dari **root repo** di server (folder yang berisi `backend/`, `frontend/`, `deploy/`).

## 1. Siapkan VPS dan domain

1. Beli VPS Linux: Ubuntu 22.04 atau 24.04, 2 vCPU, 2 GB RAM, disk 25 GB+ sudah cukup untuk UAT. Pilih region terdekat (Singapura/Jakarta). Saat membuat VPS, pilih login pakai **SSH key** (bukan kata sandi).
2. Beli domain (atau pakai subdomain yang sudah ada), mis. `toko.contoh.id`. Di panel DNS buat **record A**: nama `toko` (atau `@`) menuju **IP publik VPS**. Tunggu beberapa menit sampai aktif: `nslookup toko.contoh.id` harus menampilkan IP VPS. HTTPS gagal terbit kalau DNS belum mengarah.
3. Aktifkan 2FA di akun penyedia VPS dan akun registrar domain.

## 2. Amankan server (sekali saja)

Login: `ssh root@IP-VPS`, lalu:

```bash
apt update && apt -y upgrade
adduser kucur                      # buat user biasa, isi kata sandi kuat
usermod -aG sudo kucur
rsync --archive --chown=kucur:kucur ~/.ssh /home/kucur   # salin SSH key ke user baru
```

Buka terminal kedua, pastikan `ssh kucur@IP-VPS` berhasil, baru lanjut. Lalu nonaktifkan login root dan kata sandi:

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Firewall: hanya 22, 80, 443.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp     # HTTP/3 (opsional)
sudo ufw enable
sudo apt -y install unattended-upgrades   # update keamanan otomatis
```

Catatan: Docker menambah aturan iptables sendiri dan bisa melewati UFW untuk port yang dipublikasikan. Stack ini hanya mempublikasikan 80/443 (dari Caddy), jadi aman. **Jangan** menambah `ports:` pada mysql atau backend.

## 3. Pasang Docker dan ambil kode

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker kucur && newgrp docker
git clone https://github.com/stevendanendra/kucur.git && cd kucur   # repo private: pakai deploy key atau token
```

## 4. Isi konfigurasi rahasia

```bash
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```

Isi minimal: `SITE_ADDRESS` (domain, tanpa `https://`), `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`. Buat kata sandi acak, satu per variabel, **jangan sama**:

```bash
openssl rand -hex 24
```

(Pakai hex, bukan base64, karena kata sandi masuk ke URL database.) `DATABASE_URL` disusun otomatis oleh compose. Simpan kata sandi di pengelola kata sandi, bukan di chat. File `.env.production` sudah di-ignore git; jangan pernah di-commit.

Opsional: kunci Web Push (`npx web-push generate-vapid-keys`), kunci OpenRouteService. Midtrans dibiarkan kosong (COD tetap jalan).

## 5. Jalankan

```bash
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml ps
```

Build pertama beberapa menit. Backend menjalankan `prisma migrate deploy` otomatis saat start (hanya menerapkan migrasi yang sudah ada). Agar perintah lebih pendek:

```bash
alias kc='docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml'
```

## 6. Buat akun Admin pertama

Database baru kosong dan **tidak berisi akun demo**. Buat admin (dan baris Pengaturan Platform) segera setelah start pertama:

```bash
docker exec -e ADMIN_EMAIL='admin@domainkamu.id' -e ADMIN_PASSWORD='ganti-dengan-kata-sandi-12+karakter' -e ADMIN_NAME='Nama Admin' kucur-prod-backend npm run admin:create
```

Kata sandi minimal 12 karakter dan tidak dicetak ke layar. Menjalankannya lagi dengan email yang sama berarti mengganti kata sandi (semua sesi lamanya dicabut). Awali perintah dengan spasi supaya tidak tersimpan di riwayat shell, atau hapus dengan `history -c`.

Setelah login, buka **Pengaturan Platform** dan isi: ongkir per km, PPN, jam batas pesan/pengiriman, biaya admin, iuran pokok, kontak admin, dst. Nilai awal dari skrip sengaja netral (ongkir/km 0, PPN 0%, batas pesan 16:00, kirim 17:00, batas bayar biaya admin tanggal 7). Sebelum Pengaturan Platform ada, log backend menampilkan error `Cannot read properties of null` dari job terjadwal; itu hilang setelah langkah ini.

## 7. Periksa kesehatan

```bash
curl -I https://toko.contoh.id/                     # 200, ada header Strict-Transport-Security
curl https://toko.contoh.id/api/products            # {"data":[]} pada database kosong
docker ps                                           # mysql & backend (healthy), web Up
docker logs --tail 50 kucur-prod-backend
```

Cek juga di browser: halaman Masuk **tidak** menampilkan akun demo, login admin berhasil, chat realtime terhubung, unggah foto produk berfungsi, peta tampil.

## 8. Operasional

Log: `kc logs -f backend` (atau `web`, `mysql`). Restart satu layanan: `kc restart backend`.

**Memperbarui versi**

```bash
bash deploy/backup.sh                 # selalu backup dulu
git pull
kc up -d --build
kc ps
```

Migrasi database baru (kalau ada di versi itu) berjalan otomatis saat backend start. Migrasi hanya maju, jadi backup sebelum update itu penting.

**Rollback**

```bash
git log --oneline -5                  # cari commit/tag yang baik
git checkout <commit-atau-tag>
kc up -d --build
```

Kalau versi baru sudah menjalankan migrasi dan data jadi bermasalah, pulihkan database dari backup sebelum update (bagian 9). Kembali ke `main` terbaru: `git checkout main && git pull`.

## 9. Backup dan restore

Backup database (terkompresi, dicek `gzip -t`, simpan 14 terakhir) ke folder `backups/`:

```bash
bash deploy/backup.sh                       # database saja
BACKUP_UPLOADS=1 bash deploy/backup.sh      # database + foto unggahan (uploads)
```

Jadwal harian jam 02:00 (`crontab -e`, ganti `kucur` sesuai user dan lokasi repo):

```
0 2 * * * BACKUP_UPLOADS=1 /usr/bin/bash /home/kucur/kucur/deploy/backup.sh >> /home/kucur/kucur/backups/backup.log 2>&1
```

Backup yang hanya ada di VPS ikut hilang kalau VPS rusak. Salin `backups/` ke luar server secara berkala, mis. dari laptop: `scp -r kucur@IP-VPS:kucur/backups ./backup-kucur`, atau pakai snapshot VPS dari penyedia.

Restore (menimpa isi database sekarang, meminta konfirmasi, membuat backup pengaman dulu, menghentikan backend sebentar):

```bash
bash deploy/restore.sh backups/db-AAAAMMDD-JJMMDD.sql.gz
bash deploy/restore.sh backups/db-....sql.gz backups/uploads-....tar.gz   # sekaligus uploads
```

Latih restore sekali sebelum hari-H, jangan baru mencoba saat darurat.

## 10. Checklist keamanan produksi

- [ ] Login SSH hanya dengan key; `PermitRootLogin no`; `PasswordAuthentication no`.
- [ ] Firewall hanya 22, 80, 443 (`sudo ufw status`).
- [ ] OS rutin di-update (`sudo apt update && sudo apt upgrade`), `unattended-upgrades` aktif.
- [ ] 2FA aktif di akun penyedia VPS dan registrar domain.
- [ ] `deploy/.env.production` hanya ada di server, izin `chmod 600`, tidak di git; kata sandi MySQL acak dan berbeda.
- [ ] Tidak ada akun `@kucur.test` / `KucurDev123!` / `KurirKucur123!` yang masih dipakai. Buat kurir lewat Admin lalu minta mereka ganti kata sandi awal.
- [ ] Hanya satu admin yang dibuat lewat `admin:create` dengan kata sandi kuat; tambahan admin juga kata sandi kuat.
- [ ] `docker ps` hanya menampilkan port 80/443 untuk `kucur-prod-web`; MySQL dan backend tanpa port publik.
- [ ] Backup harian jalan dan restore sudah pernah dicoba.
- [ ] Log backend tidak menampilkan peringatan `[produksi]` (CORS, TRUST_PROXY, akun @kucur.test).
- [ ] Sebelum menerima pembayaran online: webhook Midtrans wajib verifikasi tanda tangan dan cek ulang status (belum aktif, COD saja).
- [ ] Atur monitoring sederhana (mis. UptimeRobot gratis ke `https://domain/api/products`).

## Opsi darurat tanpa VPS: Cloudflare Tunnel dari laptop

Hanya untuk kondisi terpaksa (VPS belum siap saat UAT). Laptop menjalankan stack yang sama dan Cloudflare menyalurkan HTTPS ke laptop tanpa membuka port router.

1. Pasang Docker Desktop dan `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Isi `deploy/.env.production` dengan `SITE_ADDRESS=localhost`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`, dan `CORS_ALLOWED_ORIGINS=https://alamat-tunnel-nanti` (alamat tunnel baru diketahui di langkah 4; isi lalu `kc up -d` ulang).
3. Jalankan stack seperti bagian 5, lalu buat admin (bagian 6). Jangan memakai database demo/QA.
4. Tunnel cepat (alamat acak `*.trycloudflare.com`, tanpa akun): `cloudflared tunnel --url https://localhost:8443 --no-tls-verify`. Salin alamat `https://....trycloudflare.com` yang muncul ke `CORS_ALLOWED_ORIGINS`. Untuk alamat tetap, pakai tunnel bernama dengan domain di Cloudflare.

Risiko: laptop harus menyala, terhubung internet, dan tidak sleep selama UAT; alamat tunnel cepat berubah tiap dijalankan; kinerja bergantung pada internet laptop; data hanya ada di laptop (backup tetap wajib); dan **jangan tinggalkan akun demo/QA** atau database `kucur_demo`/`kucur` dev di jalur yang terbuka ke publik. Matikan tunnel dan stack setelah UAT selesai.

## Perkiraan biaya

Harga berubah-ubah dan bergantung penyedia, jadi cek langsung di situs masing-masing sebelum membeli.

- VPS 2 vCPU / 2 GB RAM: umumnya sekitar puluhan ribu sampai ratusan ribu rupiah per bulan tergantung penyedia dan region. Ada penyedia lokal (rupiah) dan luar negeri (dolar).
- Domain: biaya tahunan, kisaran bergantung ekstensi (`.id`, `.com`, `.my.id`, dll. berbeda jauh). Cek registrar dan harga perpanjangan, bukan hanya harga tahun pertama.
- Sertifikat HTTPS (Let's Encrypt via Caddy): gratis.
- Opsional: snapshot/backup otomatis dari penyedia VPS biasanya berbayar tambahan; Cloudflare Tunnel gratis untuk penggunaan dasar.

## Catatan teknis

- Frontend dibangun same-origin (`VITE_API_BASE_URL` kosong): browser memanggil `/api` dan `/socket.io` di domain yang sama, tanpa sourcemap dan tanpa `VITE_SHOW_DEMO_ACCOUNTS`.
- Backend memakai `FINAL_REPOSITORY_*=final` dan `FINAL_REPOSITORY_ALLOW_FINAL_IN_PRODUCTION=true` (tanpa yang terakhir, `NODE_ENV=production` menolak mode final). Sudah diatur di compose.
- `TRUST_PROXY=uniquelocal` agar batas permintaan per IP memakai IP pengunjung asli dari Caddy.
- Data tersimpan di volume Docker `kucur-prod_mysql_data`, `kucur-prod_uploads`, `kucur-prod_caddy_data`. `docker compose down` aman; **`down -v` menghapus data**.
- Nama project `kucur-prod` dan nama container berawalan `kucur-prod-` tidak bentrok dengan `kucur-mysql-dev` (port 3307) di laptop dev.
