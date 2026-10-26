# UAT dari laptop sendiri

Server UAT berjalan di laptop (Docker), dan Cloudflare Tunnel memberi alamat HTTPS publik tanpa membuka port router. Data UAT terpisah dari database dev (project Docker `kucur-prod`).

## Sekali saja
1. Docker Desktop terpasang (sudah).
2. Pasang tunnel: `winget install Cloudflare.cloudflared`, lalu tutup dan buka lagi terminal.
3. Matikan sleep saat dicolok listrik (Settings > System > Power, atau `powercfg /change standby-timeout-ac 0`) dan atur "tutup layar = tidak melakukan apa-apa".

## Menyalakan
```
powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\start-uat.ps1
```
Skrip akan: menyalakan Docker, membuat `deploy/.env.production` dengan kata sandi acak (sekali), memulai tunnel dan mengambil alamat `https://xxxx.trycloudflare.com`, menjalankan stack, membuat akun admin UAT dan mengisi nilai awal Pengaturan Platform (sekali). Kata sandi admin ada di `deploy/.uat-credentials.txt` (tidak masuk git).

Alamat tunnel **berubah setiap kali tunnel dimulai ulang**. Bagikan alamat ke peserta setelah server stabil dan jangan matikan tunnel selama UAT. Kalau perlu alamat tetap, buat tunnel bernama dengan domain milik sendiri di Cloudflare.

## Selama UAT
- Laptop harus menyala, terhubung internet, dicolok listrik, dan tidak sleep. Jangan restart Windows saat sesi.
- Pantau: `docker compose --env-file deploy\.env.production -f deploy\docker-compose.prod.yml logs -f backend`.
- Backup sebelum dan sesudah tiap hari sesi (lihat `deploy/README.md`, bagian backup; di Windows jalankan lewat Git Bash dengan `MSYS_NO_PATHCONV=1`).
- Admin (kamu) memakai `http://localhost:8080` atau alamat tunnel dengan akun di `deploy/.uat-credentials.txt`.

## Mengecek sebelum peserta masuk
1. Buka alamat tunnel di HP (pakai data seluler, bukan Wi-Fi rumah) dan coba daftar, masuk, dan satu alur belanja.
2. Log backend tidak memuat peringatan `[produksi]` selain soal `localhost` (diizinkan karena kamu memakai admin di laptop).
3. Tidak ada akun `@kucur.test` (database UAT dibuat kosong, jadi aman).

## Menghentikan
```
powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\stop-uat.ps1              # matikan, data tetap
powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\stop-uat.ps1 -DeleteData  # hapus semua data UAT setelah selesai
```

## Risiko yang perlu diterima
Laptop mati atau sleep berarti server mati; internet rumah lambat berarti peserta merasa lambat; alamat tunnel cepat berubah bila tunnel mati; data hanya ada di laptop (backup tetap wajib). Untuk UAT satu minggu dengan sesi terjadwal ini cukup, tetapi bukan untuk produksi.
