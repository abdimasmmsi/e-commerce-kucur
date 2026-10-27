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

## Data contoh dan kondisi awal (baseline)
Setelah `start-uat.ps1`, isi server dengan 3 lapak contoh dan 11 produk, lalu simpan kondisi awalnya:
```
powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\seed-uat.ps1
```
- Lapak dibuat lewat alur asli (pengajuan, persetujuan admin, Iuran Pokok lunas), tanpa akun `@kucur.test`. Tiga akun pemilik lapak contoh memakai satu kata sandi acak (`UAT_SAMPLE_PASSWORD` di `deploy\.env.production`), tercatat di `deploy\.uat-sample-accounts.txt` (tidak masuk git), dan **ditampilkan di halaman Masuk** lewat build web (`UAT_ACCOUNTS_JSON` -> `VITE_UAT_ACCOUNTS`). Akun admin tidak pernah ditampilkan karena alamat tunnel bersifat publik. Skrip aman dijalankan ulang (kata sandi pemilik yang sudah ada diselaraskan, lalu web dibangun ulang).
- Seed juga membuat akun kurir contoh (`kurir.uat@kucur.example`), akun pembeli contoh (`pembeli.contoh@kucur.example`), dan 3 pesanan COD (satu per lapak contoh) berstatus siap diambil, supaya sesi kurir bisa dicoba tanpa menunggu sesi pembeli. Akun kurir dan pembeli ini **tidak tampil di halaman Masuk**; kata sandinya dicatat di `deploy\.uat-sample-accounts.txt` dan dibagikan hanya ke penguji peran itu. Alur kurir: Admin membuka **Jadwal Pengiriman** (draf jadwal) dan menyetujui draf, kurir masuk dan memulai jadwal, penjual mencentang barang siap di tempat ambil, kurir mengambil dan mengantar, lalu unggah foto bukti antar.
- Snapshot `baseline` disimpan di `deploy\backups-uat\baseline.sql` dan tidak ditimpa bila seed dijalankan lagi (paksa dengan `-ForceSnapshot`, jangan dilakukan setelah ada data peserta).
- Snapshot baseline sudah memuat kondisi di atas (akun kurir/pembeli contoh dan 3 pesanan siap diambil).
- Kembalikan ke kondisi awal kapan saja (antar hari sesi atau setelah UAT): `powershell -ExecutionPolicy Bypass -File deploy\laptop-uat\snapshot-uat.ps1 -Restore`. Ini menghapus akun peserta, pesanan, dan ulasan sejak baseline; foto unggahan tidak ikut dipulihkan.
- Simpan snapshot lain (mis. sebelum sesi): `snapshot-uat.ps1 -Name sebelum-sesi-kurir`, lalu pulihkan dengan `-Restore -Name sebelum-sesi-kurir`.

## Selama UAT
- Laptop harus menyala, terhubung internet, dicolok listrik, dan tidak sleep. Jangan restart Windows saat sesi.
- Pantau: `docker compose --env-file deploy\.env.production -f deploy\docker-compose.prod.yml logs -f backend`.
- Backup sebelum dan sesudah tiap hari sesi (lihat `deploy/README.md`, bagian backup; di Windows jalankan lewat Git Bash dengan `MSYS_NO_PATHCONV=1`).
- **Admin harus standby selama sesi.** Penjual baru tidak bisa tampil ke pembeli sebelum (a) lapaknya disetujui di **Persetujuan Lapak** dan (b) cicilan pertama Iuran Pokok dikonfirmasi di **Keuangan**. Draf Jadwal Pengiriman juga harus disetujui Admin sebelum kurir bisa mulai.
- Caddy mempercayai header proxy privat (`trusted_proxies private_ranges`), jadi IP asli peserta terbaca di belakang Cloudflare Tunnel (batas percobaan login dihitung per IP) dan alamat unggahan memakai https.
- Sebelum sesi: pulihkan baseline (`snapshot-uat.ps1 -Restore`). Setelah tiap hari sesi: backup dulu, lalu pulihkan baseline bila ingin mengulang dari awal.
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
