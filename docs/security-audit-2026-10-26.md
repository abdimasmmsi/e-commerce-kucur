# Audit Keamanan 26 Oktober 2026 (acuan: security.md)

Tujuan: memastikan sistem aman untuk UAT online ke pengguna sungguhan. Hasil di bawah memakai format G dari security.md.

## 1. Ringkasan relevansi

| Bagian | Status | Alasan singkat |
|---|---|---|
| A. Umum | Relevan | Semua poin berlaku |
| B. Backend/API | Relevan | Express + MySQL |
| B8/B9 Firebase, Supabase | Dilewati | Tidak dipakai |
| C. Android/Play | Dilewati | PWA di browser, bukan APK |
| D. Web | Relevan | Frontend React lewat HTTPS |
| E. Pembayaran | Sebagian | Hanya COD; webhook dan signature menunggu Midtrans diaktifkan |
| I. E-commerce | Relevan | I1-I4, I6, I9-I11, I13-I14, I17. Dilewati: I5 voucher/wallet, I8 flash sale, I15 email (tidak ada) |
| I7 Seller/marketplace | Sebagian | Penjual diverifikasi admin; escrow tidak relevan karena COD |

## 2. Hasil pemeriksaan otomatis hari ini

- Pemindaian rahasia di file terlacak dan riwayat git: **bersih** (hanya placeholder dan contoh di tes). `.env*` tidak pernah masuk git, `.env.example` hanya berisi placeholder.
- `npm run security:check`: 119 endpoint x 4 peran, fuzz, body 2 MB, mass assignment, IDOR, kebocoran data. **0 gagal**.
- Uji rebutan stok serentak dan uji beban lolos (lihat CLAUDE.md, 2026-10-08).
- Upload gambar: hanya JPG/PNG/WebP, tanda tangan file (magic bytes) diperiksa, maksimal 650 KB, nama file UUID acak, tanpa SVG.
- Tidak ada `dangerouslySetInnerHTML`, `innerHTML`, `eval`, atau `new Function` di frontend.
- Login: kata sandi di-hash scrypt, pesan gagal seragam, batas percobaan per IP dan per akun.

## 3. Temuan

### Kritis
Tidak ada.

### Tinggi (sudah diperbaiki hari ini)
1. **DOMPurify <= 3.4.16** (advisory kritis, terbawa jspdf untuk ekspor PDF) -> `frontend/package-lock.json`, naik ke 3.4.17. Alur ekspor memang tidak memakai fitur HTML jspdf, tetapi versi rentan tidak boleh ikut ke produksi.
2. **body-parser 2.0-2.3 (DoS lewat body terkompresi)** -> `backend/package-lock.json`, naik ke 2.4.0.

### Sedang (sudah diperbaiki hari ini)
3. **Selisih waktu login membocorkan email terdaftar** (email tak terdaftar 8 ms, terdaftar 50 ms) -> `backend/services/authService.js`: hash selalu dihitung dengan hash palsu bila akun tidak ada. Sekarang 48-51 ms di kedua kasus.
4. **`trust proxy` hanya `loopback`**: di belakang Caddy/Nginx semua pengguna terlihat satu IP sehingga batas permintaan mengenai semua orang sekaligus -> `backend/app.js` kini membaca `TRUST_PROXY` (compose produksi memakai `uniquelocal`); `backend/config/productionChecks.js` memberi peringatan bila belum diatur.
5. **Tidak ada kebijakan privasi dan persetujuan** (A6, UU PDP) -> halaman `/privacy` (ID/EN), tautan di halaman masuk dan daftar, kotak persetujuan wajib saat daftar.

### Tinggi (masih terbuka)
6. **Admin tanpa 2FA** (B1, I11). Mitigasi untuk UAT: 1-2 akun admin dengan kata sandi acak panjang (`npm run admin:create`, minimal 12 karakter), tidak dibagikan, dan tidak ada akun `@kucur.test`. Sebelum produksi publik: TOTP atau batasi akses admin per IP di Caddy. TOTP butuh kolom baru, jadi perlu persetujuan skema.
7. **Belum ada fitur hapus akun/data** (A6, UU PDP). Mitigasi untuk UAT: akun uji dihapus setelah UAT oleh admin (skrip/DB), sebutkan di lembar persetujuan. Sebelum produksi: fitur hapus atau anonimkan akun.
8. **Backup otomatis belum terpasang di server** (A5). Skrip `deploy/backup.sh` dan `restore.sh` sudah diuji (backup, cek gzip, rotasi, dan pemulihan). Yang harus dikerjakan saat deploy: pasang cron harian dan salin backup ke luar server.

### Sedang (masih terbuka)
9. **Token sesi di `localStorage`** (D2): berbahaya bila ada celah XSS. Tidak ada sink XSS yang ditemukan dan CSP di Caddy membatasi sumber skrip, CSP sudah diuji di Chrome terhadap stack lokal (halaman utama, masuk, daftar, privasi, tile peta OpenStreetMap, font): tidak ada yang diblokir. Yang belum diuji: unggah foto, kamera/GPS di HP, push, ekspor PDF/Excel. Uji manual di HP sebelum UAT.
10. **`GET /api/auth/email-status` mengungkap apakah email terdaftar** (I1). Dibatasi rate limit dan dipakai untuk UX daftar. Opsi bila ingin lebih ketat: hapus endpoint ini di produksi.
11. **Kebijakan kata sandi hanya minimal 8 karakter** (B1). Pertimbangkan minimal 10 dan blokir kata sandi umum.
12. **Belum ada pemantauan dan peringatan** (A4). Pasang pemantau uptime gratis (mis. UptimeRobot) dan biasakan memeriksa `docker compose logs`.
13. **Dependensi tooling**: `prisma` CLI/`deepmerge-ts` (tinggi) dan `uuid` di `exceljs` (sedang). Perbaikannya butuh Prisma 7 (ESM) atau exceljs 3.4.0 (kemunduran); jalurnya bukan permintaan pengguna (CLI hanya saat migrasi, `uuid` hanya pada ekspor Excel). Diterima, pantau.

### Rendah
14. Metadata EXIF (lokasi) pada foto dari kamera belum dipastikan terhapus sebelum disimpan (hanya foto profil diproses lewat canvas). Pertimbangkan re-encode di server.
15. Tidak ada pemindaian rahasia otomatis (gitleaks/trufflehog) dan pre-commit hook. Pemindaian manual hari ini bersih.
16. 2FA pada akun GitHub, hosting, domain, dan email utama adalah tindakan Steven (A3).
17. Midtrans: saat diaktifkan, wajib verifikasi signature webhook, cocokkan nominal dan order_id, dan idempoten (E, I4).

## 4. Pemeriksaan sebelum UAT (wajib dilakukan di server nyata)

1. `NODE_ENV=production`, `CORS_ALLOWED_ORIGINS=https://domain-uat`, `TRUST_PROXY=uniquelocal`. Tidak boleh muncul peringatan `[produksi]` di log saat start.
2. Tidak ada akun `@kucur.test`: `NODE_ENV=production npm run security:passwords` harus bersih.
3. `VITE_SHOW_DEMO_ACCOUNTS` tidak diset (kredensial demo tidak tampil di halaman masuk).
4. Cek header: `curl -sI https://domain-uat` menampilkan HSTS, CSP, nosniff, X-Frame-Options.
5. Buka aplikasi di HP dan laptop: peta (tile OSM), font, unggah foto, kamera dan GPS, notifikasi, ekspor PDF/Excel. Kalau ada yang diblokir, lihat console dan longgarkan CSP di `deploy/Caddyfile`.
6. `npm run security:check` terhadap URL UAT (set `CHECK_API`) lalu jalankan skenario penuh satu putaran sebagai uji mandiri.
7. Backup pertama dan uji restore di server sebelum peserta masuk.
