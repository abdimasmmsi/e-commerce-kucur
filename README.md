# Kucur Local Market

Platform e-commerce untuk produk lokal warga **Desa Wisata Kucur** (Kec. Dau, Kab. Malang). Warga bisa membuka lapak, pembeli memesan dari HP, kurir desa mengantar setiap sore, dan pembayaran dilakukan **tunai saat barang sampai (COD)**. Pengelola desa memantau semuanya dari satu panel admin.

> Tugas Akhir program TTG, Sistem Informasi, Universitas Ma Chung.
> **Pengembangan Platform E-Commerce Terintegrasi untuk Produk Lokal di Desa Wisata Kucur**
> (*Development of an Integrated E-Commerce Platform for Local Products in Kucur Tourism Village*)

---

## Daftar isi

1. [Fitur per peran](#1-fitur-per-peran)
2. [Teknologi](#2-teknologi)
3. [Struktur folder](#3-struktur-folder)
4. [Menjalankan pertama kali](#4-menjalankan-pertama-kali)
5. [Menjalankan sehari-hari](#5-menjalankan-sehari-hari)
6. [Data demo dan uji coba di HP](#6-data-demo-dan-uji-coba-di-hp)
7. [Akun demo](#7-akun-demo)
8. [Pengujian](#8-pengujian)
9. [Aturan bisnis utama](#9-aturan-bisnis-utama)
10. [Chatbot FAQ](#10-chatbot-faq)
11. [Masalah yang sering muncul](#11-masalah-yang-sering-muncul)
12. [Dokumen lain](#12-dokumen-lain)

---

## 1. Fitur per peran

Satu akun bisa punya beberapa peran sekaligus (misalnya pembeli sekaligus penjual).

| Peran | Yang bisa dilakukan |
|---|---|
| **Pengunjung** (belum masuk) | Melihat produk, halaman lapak, rating, dan jumlah terjual; daftar akun; bertanya ke chatbot FAQ. |
| **Pembeli** | Keranjang multi-lapak dan Beli Sekarang; checkout dengan alamat tersimpan (maks. 5) atau GPS; tip kurir; melacak pesanan; membatalkan selama status *Menunggu/Diterima*; ulasan; chat penjual dan admin; notifikasi. |
| **Penjual (merchant)** | Mengajukan dan mengelola satu atau lebih lapak; produk sederhana dan bervarian; stok dengan peringatan menipis; memproses pesanan (Terima → Mulai kemas → Siap diambil kurir); membatalkan dengan alasan; membalas ulasan; iuran pokok, biaya admin, dan iuran sukarela; unduh laporan CSV. |
| **Kurir desa** | Batch pengiriman harian; ambil barang dan bayar harga barang ke penjual; antar, tagih COD, dan foto bukti antar; tandai gagal antar; atur hari libur. |
| **Admin (pengelola desa)** | Menyetujui atau menolak lapak; memantau transaksi, pengiriman, dan kurir; konfirmasi pembayaran merchant; moderasi ulasan; reset kata sandi pengguna; live chat bantuan; semua angka operasional di **Pengaturan**; unduh laporan CSV. |

Fitur pendukung untuk semua peran:
- Bahasa Indonesia dan Inggris.
- Mode terang dan gelap.
- Tampilan mobile-first: menu bawah di HP, bisa dipasang ke layar utama (PWA).
- Notifikasi di setiap langkah penting.
- **Chatbot FAQ** yang berjalan lokal tanpa API.

## 2. Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router, Leaflet + OpenStreetMap |
| Backend | Node.js (diuji di v24), Express 5 (CommonJS), Socket.IO (chat realtime) |
| Database | MySQL 8.4 di Docker, Prisma ORM 6 |
| Jarak & ongkir | OpenRouteService, dengan cadangan rumus Haversine kalau jaringan gagal |
| Pembayaran | COD aktif. Midtrans tersedia sebagai placeholder (belum ada kredensial). |
| Pengujian | `node --test` (backend), Playwright (end-to-end), ESLint |

## 3. Struktur folder

```
kucur-platform/
├── backend/                 API Express + Prisma
│   ├── prisma/              schema.prisma, migrasi, seed (QA & demo)
│   ├── repositories/        akses data (finalPrismaRepository.js = 20 tabel final)
│   ├── services/            logika bisnis (pesanan, pengiriman, keuangan, notifikasi, ...)
│   ├── routes/ controllers/ endpoint REST
│   ├── scripts/demo.js      reset & jalankan database demo
│   └── tests/               test backend
├── frontend/                Aplikasi React
│   ├── src/pages/           halaman per peran (customer, merchant, courier, admin, auth, chat)
│   ├── src/components/      komponen bersama (termasuk FaqBot)
│   ├── src/data/faq.js      isi chatbot FAQ
│   ├── e2e/                 test Playwright
│   └── public/              ikon, manifest PWA, service worker
├── docs/                    dokumen teknis & figure jurnal (Mermaid)
├── docker-compose.yml       MySQL untuk development
└── CLAUDE.md                catatan lengkap keputusan proyek & aturan bisnis
```

## 4. Menjalankan pertama kali

### Prasyarat
- **Git**
- **Node.js** 20 atau lebih baru (proyek diuji dengan v24)
- **Docker Desktop** (untuk MySQL)
- **Google Chrome** (dipakai juga oleh test Playwright)

### Langkah

**1. Ambil kode**
```bash
git clone https://github.com/stevendanendra/kucur.git
cd kucur
```

**2. Siapkan file konfigurasi.** Salin tiga file contoh, lalu ganti isian `CHANGE_ME`/`PASSWORD` dengan nilai milikmu sendiri:

| Salin dari | Menjadi | Isi penting |
|---|---|---|
| `.env.docker.example` | `.env` (di folder utama) | `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` |
| `backend/.env.example` | `backend/.env` | `DATABASE_URL` dan `TEST_DATABASE_URL` (password sama dengan `MYSQL_PASSWORD`), `DEV_SEED_PASSWORD` |
| `frontend/.env.example` | `frontend/.env` | `VITE_OPENROUTESERVICE_API_KEY` (opsional; tanpa key jarak memakai Haversine) |

> File `.env` tidak ikut ter-upload ke GitHub (sudah ada di `.gitignore`). Jangan pernah commit password asli.

**3. Nyalakan database**
```bash
docker compose up -d mysql
```
Saat pertama kali, Docker membuat database `kucur` (utama/e2e), `kucur_test` (test backend), dan `kucur_demo` (demo).

**4. Pasang dependensi**
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

**5. Siapkan isi database**
```bash
cd backend
npx prisma migrate deploy     # buat semua tabel
npx prisma generate           # buat Prisma Client
npm run db:seed               # isi akun & data QA
cd ..
```

**6. Jalankan.** Lihat [bagian 5](#5-menjalankan-sehari-hari).

## 5. Menjalankan sehari-hari

Buka dua terminal:

```bash
# Terminal 1 — backend (http://localhost:3000)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

Buka **http://localhost:5173**. Akun yang bisa dipakai ada di [bagian 7](#7-akun-demo) dan juga tertulis di halaman Masuk.

> **Catatan:** database `kucur` (port 5173) dipakai test otomatis dan sering di-reset, isinya hanya produk QA. Untuk mencoba aplikasi dengan data lengkap, pakai **data demo** di bawah.

## 6. Data demo dan uji coba di HP

Database **`kucur_demo`** berisi data yang realistis: 5 lapak aktif + 1 pengajuan, 17 produk, ±33 pesanan dalam 4 minggu terakhir, batch pengiriman, ulasan, iuran, chat, dan notifikasi. Database ini terpisah dari `kucur`, jadi aman dari test otomatis.

**Mengisi ulang data demo** (misalnya sebelum demo, supaya tanggal pesanan tetap baru):
```bash
cd backend
npm run db:demo:reset
```
> Matikan dulu semua backend yang sedang jalan. Kalau tidak, Prisma gagal dengan error `EPERM` karena file-nya sedang dipakai.

**Menjalankan versi demo dan membukanya dari HP.** HP dan laptop harus satu Wi-Fi atau hotspot.

1. Cari IP laptop: `ipconfig` (Windows), lihat *IPv4 Address*, misalnya `192.168.1.28`.
2. Terminal backend demo (port 3001). Contoh untuk PowerShell, ganti IP-nya:
   ```powershell
   cd backend
   $env:PORT=3001; $env:CORS_ALLOWED_ORIGINS="https://localhost:5175,https://192.168.1.28:5175"; npm run dev:demo
   ```
3. Terminal frontend versi HP (HTTPS, port 5175):
   ```bash
   cd frontend
   npm run dev:phone
   ```
4. Buka **https://192.168.1.28:5175** di HP, atau **https://localhost:5175** di laptop. Saat muncul peringatan sertifikat, pilih *Advanced → Proceed*. HTTPS diperlukan supaya GPS di HP bisa dipakai saat checkout.

> IP laptop bisa berubah kalau pindah jaringan. Kalau HP tidak bisa masuk, cek IP lagi dan jalankan ulang langkah 2 dengan IP baru.

## 7. Akun demo

Semua akun memakai kata sandi **`KucurDev123!`** (atau nilai `DEV_SEED_PASSWORD` di `backend/.env`).

| Peran | Email |
|---|---|
| Admin | `admin@kucur.test` |
| Pembeli | `customer@kucur.test` |
| Penjual (lapak A) | `merchant.a@kucur.test` |
| Penjual (lapak B) | `merchant.b@kucur.test` |
| Kurir | `courier@kucur.test` |

Data demo punya beberapa akun warga tambahan dengan kata sandi yang sama.

> Akun-akun ini **khusus development dan demo**. Jangan dipakai di server produksi.

## 8. Pengujian

```bash
# Backend
cd backend
npm test                       # test unit backend
npm run test:final-repository  # test repository & layanan final (berjalan di dalam transaksi yang di-rollback)

# Frontend
cd frontend
npm run lint                   # encoding, cek data FAQ chatbot, ESLint
npm run build                  # build produksi

# End-to-end (backend :3000 dan frontend :5173 harus menyala)
cd backend && node prisma/validation/prepareFinalModeE2EFixtures.js && cd ..
cd frontend && npx playwright test
```

Status terakhir (Oktober 2026): backend **87/87**, repository final **30/30**, Playwright **67/67**, lint dan build lolos.

> Jalankan `prepareFinalModeE2EFixtures.js` sebelum e2e. Script ini mengembalikan data uji (pengajuan lapak, stok produk QA, bahasa akun QA) ke kondisi awal.

## 9. Aturan bisnis utama

Ringkasan saja. Detail lengkap dan riwayat keputusannya ada di [`CLAUDE.md`](CLAUDE.md).

**Pesanan & pembayaran**
- Satu checkout bisa berisi barang dari beberapa lapak. Sistem memecahnya menjadi satu pesanan per lapak.
- Semua hitungan uang dilakukan di backend: harga produk, **PPN** (persentase global, dicatat per pesanan), **ongkir = jarak (km, dibulatkan ke atas) × tarif per km**, dan tip kurir.
- Pembayaran **COD**. Saat pickup, kurir membayar harga barang ke penjual. Saat antar, kurir menagih total ke pembeli. Pesanan otomatis lunas ketika kurir mengunggah foto bukti antar.

**Pembatalan**
- Pembeli bisa membatalkan saat status **Menunggu** atau **Diterima**.
- Setelah penjual menekan **Mulai kemas**, pembeli tidak bisa membatalkan lagi.
- Penjual atau admin masih bisa membatalkan sampai tahap Dikemas, dengan alasan wajib. Stok dikembalikan dan pembeli mendapat notifikasi.

**Pengiriman (batch harian)**
- Pesanan yang masuk sebelum jam cutoff dikirim hari itu setelah jam berangkat kurir. Pesanan setelah cutoff dikirim besok.
- Ada kuota pengiriman per hari. Kelebihannya digeser ke hari berikutnya.

**Keuangan lapak**
- **Iuran pokok:** dibayar sekali per lapak, boleh lunas atau dicicil 3/6 kali. Telat bayar dikenai bunga per 7 hari.
- **Biaya admin:** muncul setiap pesanan selesai dan harus lunas sebelum tanggal cutoff. Kalau tidak, lapak **ditangguhkan otomatis** dan aktif lagi setelah lunas.
- **Iuran sukarela:** bebas, kapan saja, tanpa sanksi.

Semua angka (PPN, tarif/km, cutoff, jam berangkat, kuota, iuran, biaya admin, bunga, batas jarak, kontak admin) **diatur di Admin → Pengaturan**. Tidak ada yang ditulis mati di kode.

**Database:** 20 tabel final (`User` … `PlatformSettings`), sinkron dengan ERD di jurnal. Schema sudah dibekukan, jadi penambahan tabel perlu persetujuan pemilik proyek.

## 10. Chatbot FAQ

Tombol robot di kanan bawah membuka chatbot bantuan. Chatbot ini berjalan sepenuhnya di browser, tanpa API dan tanpa token.

- **Isi FAQ:** `frontend/src/data/faq.js`. Berisi kamus sinonim/singkatan (`CONCEPTS`), daftar FAQ per peran dengan jawaban ID/EN (`FAQS`), dan topik awal per peran (`STARTER_TOPICS`).
- **Cara kerja:** teks dirapikan (singkatan seperti *gmn*, *gk*), imbuhan dan salah ketik ditoleransi, lalu dicocokkan ke konsep. Bot meminta konfirmasi *"Maksud kamu …?"* dan menjawab dengan langkah-langkah serta tombol pintas. Bahasa jawaban mengikuti bahasa pertanyaan (ID/EN).
- **Angka di jawaban** (cutoff, ongkir, PPN, iuran, dan lainnya) diambil langsung dari Pengaturan admin.
- **Wajib diperbarui setiap kali alur sistem berubah.** Setelah mengedit, jalankan `npm run lint` di frontend. Script `scripts/check-faq.mjs` mengecek bahwa ID/EN lengkap, tautan menuju halaman yang ada, dan setiap pertanyaan FAQ cocok ke dirinya sendiri.

## 11. Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| `EPERM ... query_engine` saat `prisma generate` atau `db:demo:reset` | File Prisma sedang dipakai backend yang menyala. Matikan semua backend dulu, lalu ulangi. |
| `Port 5173/5175/3000 is already in use` | Ada server lama yang masih jalan. Tutup terminalnya atau hentikan proses `node`. |
| HP tidak bisa masuk / error jaringan | IP laptop berubah, atau IP HP belum ada di `CORS_ALLOWED_ORIGINS`. Lihat [bagian 6](#6-data-demo-dan-uji-coba-di-hp). |
| Peringatan "koneksi tidak aman" di HP | Normal untuk sertifikat lokal. Pilih *Advanced → Proceed*. |
| Produk di laptop sedikit, di HP banyak | Laptop di `localhost:5173` memakai database QA (`kucur`). Buka `https://localhost:5175` untuk data demo. |
| Bahasa/tema akun berubah sendiri | Preferensi tersimpan per akun dan ikut saat login. Test otomatis bisa mengubah akun QA di database `kucur`; jalankan `prepareFinalModeE2EFixtures.js` untuk mengembalikannya. |
| `prisma migrate reset` ditolak | Prisma menolak reset yang dijalankan otomatis oleh AI. Jalankan sendiri dari terminal. |

## 12. Dokumen lain

- [`CLAUDE.md`](CLAUDE.md): catatan lengkap proyek, mencakup konteks, riwayat scope, aturan bisnis yang dikunci, status, dan cara kerja.
- [`docs/final-documentation/`](docs/final-documentation/): figure jurnal dalam format Mermaid (Agile, use case, activity, arsitektur, alur pengiriman, ERD 20 tabel).
- [`docs/ecommerce-feature-audit.md`](docs/ecommerce-feature-audit.md), [`docs/final-ecommerce-cutover.md`](docs/final-ecommerce-cutover.md), [`docs/admin-settings-financial-foundation.md`](docs/admin-settings-financial-foundation.md): catatan teknis tahap pengembangan.

---

Repositori privat untuk keperluan Tugas Akhir. © 2026 Steven Danendra, Universitas Ma Chung.
