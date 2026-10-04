# Kucur Platform — Handoff (dari chat ChatGPT "Code Kucur")

Dokumen ini merangkum seluruh chat (338 pesan user) supaya sesi baru bisa lanjut tanpa baca ulang. Sumber kebenaran utama tetap kode di repo dan `db_ecommerce.sql`. Bagian bertanda **[VERIFIKASI]** belum pasti, cek ke kode/Steven sebelum dianggap benar.

## 1. Konteks

- Pemilik: Steven Danendra, mahasiswa Sistem Informasi, Universitas Ma Chung (Malang).
- Tugas Akhir lewat program **TTG** (laporan ringan, tapi **wajib publikasi jurnal** sebelum program). Target jurnal: **SINTA 5**.
- Objek: **Desa Wisata Kucur**. Sistem dikelola bersama oleh pengelola desa. Pengguna adalah warga desa dengan literasi digital beragam.
- Judul TA (final): **Pengembangan Platform E-Commerce Terintegrasi untuk Produk Lokal di Desa Wisata Kucur**
  EN: *Development of an Integrated E-Commerce Platform for Local Products in Kucur Tourism Village*
- Metode pengembangan: **Agile** (sebelumnya RAD, sudah diganti).
- Rekan TA lain mengerjakan **SIG** (peta/lokasi, "SIG LENTERA") dan ada pihak **Ticketing**. Integrasi keduanya **tidak lagi masuk scope aktif**.

## 2. Sejarah scope (penting supaya tidak salah arah)

1. Awal: web terintegrasi 3 domain: E-Commerce + Wisata Edukasi + Live In.
2. Wisata edukasi diganti nama jadi "Booking Wisata" (kategori edukasi/non-edukasi). Live In = rumah warga, per kamar per malam.
3. Setelah presentasi ke dosen/stakeholder: **fokus hanya E-Commerce**, dengan ruang berkembang. Tourism dan Live In **dilepas dari runtime** (route frontend dan mount backend dihapus, file lama disimpan sebagai arsip, tidak dihapus).
4. Di luar scope aktif: Tourism, Live In, Pride/leaderboard, SIG, Ticketing, wishlist (sudah dihapus), voucher, follow lapak.

Prinsip UX dari Steven: **SIMPLE > clever, CLEAR > compact, CONSISTENT > decorative**. Jangan terasa seperti dashboard developer.

## 3. Stack dan environment

- Frontend: React 19 + Vite 8, Tailwind (CSS lama dimigrasi), React Router.
- Backend: Node.js + Express 5 (CommonJS), **Prisma ORM 6** (Prisma 7 sengaja dihindari karena ESM), **Socket.IO** untuk chat realtime.
- Database: **MySQL 8.4** di Docker, port dev **3307** (sebelumnya PostgreSQL, sudah dipindah). UUID `CHAR(36)`, waktu `DATETIME(3)`, uang `DECIMAL`.
- Peta/lokasi: Leaflet + OpenStreetMap; jarak via OpenRouteService dengan fallback **Haversine** kalau jaringan gagal. Koordinat Store diisi manual (Steven mencicil saat ke desa).
- Pembayaran: **COD aktif**. **Midtrans** hanya placeholder (belum ada kredensial); tanpa kredensial backend membalas `PAYMENT_PROVIDER_NOT_CONFIGURED`. Transfer manual dihindari (risiko seller nakal).
- Dev: Windows, repo di `D:\kucur-platform` (`frontend/`, `backend/`, `docs/final-documentation/`). Frontend `http://localhost:5173`, backend `http://localhost:3000`. Repo git lokal dibuat 2026-10-04 (branch `main`, commit baseline `dead544 snapshot: feature freeze baseline`, belum ada remote). `core.autocrlf=false`; `.gitignore` root mengecualikan `.env*`, `node_modules`, `uploads`, `.tmp`, `artifacts`, `*.zip`.
- Tooling: coding dilakukan lewat Codex di VS Code; ChatGPT dipakai sebagai perencana dan penulis prompt. Sekarang pindah ke Claude.
- Akun QA (password semua `KucurDev123!`, dipakai e2e): `admin@kucur.test`, `customer@kucur.test`, `merchant.a@kucur.test`, `merchant.b@kucur.test`, `courier@kucur.test`. Kredensial ditaruh di halaman login untuk demo.

## 4. Role

Satu **User** bisa punya banyak role (multi-role via `UserRole`): Customer, Merchant, Courier, Admin.

- **Visitor** (tanpa login): boleh lihat produk, tidak boleh order. Order wajib login.
- **Customer** → bisa mengajukan jadi Merchant (form pengajuan lapak). Approval Admin otomatis menambah role Merchant (idempotent).
- **Merchant**: punya satu atau lebih **Store (lapak)**; ada store switcher. Store aktif hanya bertipe `product`. Daftar → status pending → Admin approve/reject (alasan reject wajib tampil) → baru bisa publish.
- **Courier**: kurir milik desa (bukan JNE dll.), status Available / Out of Office.
- **Admin**: approval, monitoring transaksi/delivery/finance, moderasi review, platform settings. Admin bisa melihat **action history** transaksi (mis. reassign berkali-kali).
- Semua role selain Admin bisa live chat ke Admin (support); Customer bisa chat ke Merchant.

## 5. Aturan bisnis yang sudah dikunci

**Checkout dan order**
- Cart multi-store. Satu checkout dipecah jadi beberapa `CommerceOrder` per Store, dikelompokkan `checkoutGroupId`. Ada `checkoutIdempotencyKey` (unik per customer + key + store).
- Ada **Buy Now** (direct checkout per produk). Produk simple dan varian (SKU); stok customer = gabungan semua varian. Gambar produk dipaksa rasio **1:1** (crop tengah, max 1600×1600).
- Hitung di **backend**, bukan frontend: subtotal, **PPN global %** (snapshot per order), ongkir, tip kurir. Komponen uang disimpan terpisah (jangan digabung satu angka).
- **Ongkir = jarak km dibulatkan ke atas × rate/km** (rate di Admin Settings). Customer bisa kasih tip kurir saat memilih pembayaran.
- Cancel oleh customer hanya sampai status **Processing**; setelah Ready for Pickup tidak bisa.
- Stok: reservasi dan konsumsi di transaksi; ada pencegahan oversell dan concurrent checkout.
- Review hanya dari order selesai, unik per item, merchant bisa reply, admin bisa moderasi. Revenue dihitung saat order selesai.

**COD dan aliran uang**: kurir menalangi harga barang ke merchant saat pickup, lalu menagih customer (barang + ongkir + tip) saat antar.

**Pengiriman (model final = batch harian, bukan round-robin per order)**
- Order masuk sebelum cutoff dikirim **hari itu setelah pukul 17:00**; order sesudah cutoff masuk **batch besok**. Cutoff diberi jarak ±1 jam sebelum 17:00 agar merchant tidak terburu-buru **[VERIFIKASI nilai persisnya di Admin Settings]**.
- Ada **maksimum pengiriman harian**; overflow geser ke batch berikutnya dan customer diberi tahu sejak checkout.
- Kurir menerima assignment dengan **accept window** (default 10 menit, configurable). Kurir wajib menerima kecuali sedang OOO. Kurir yang reject tidak boleh langsung mendapat order yang sama lagi sampai sempat dire-assign ke orang lain. Admin bisa set batas jumlah delivery aktif per kurir.
- Pickup window berisi lokasi ambil dan daftar barang. Merchant mencentang barang di tempat pickup; kalau semua tercentang, kurir bisa klik mulai antar dan status order berubah di merchant dan customer. Order yang tidak siap saat pickup di-roll over ke besok.
- Bukti pengiriman: foto + kontak customer terlihat oleh kurir. Ada rebatch dan histori delivery (`DeliveryBatch`, `DeliveryBatchOrder`).

**Keuangan Merchant (per lapak)**
- **Iuran pokok**: wajib, boleh dicicil (lunas / 3 / 6 kali), pembayaran pertama langsung saat buka lapak, lapak **aktif setelah cicilan pertama**. Telat cicilan → bunga % dari sisa tagihan tiap 7 hari (configurable, compounding atas outstanding saat itu).
- **Biaya admin**: configurable (Rp atau %), muncul tiap transaksi selesai sebagai tagihan, **tidak bisa dicicil**, harus lunas. Cutoff **tanggal 1, grace sampai 12:00**; jika masih outstanding → lapak **suspended**; lunas → aktif lagi. Berlaku untuk semua jenis lapak, dihitung per lapak. Dibayar pemilik lapak (bukan ditambahkan ke customer). Basis hitung yang disarankan: subtotal sebelum PPN, ongkir, tip **[VERIFIKASI apakah sudah dikonfirmasi stakeholder]**. Dana ini untuk menggaji pengelola.
- **Iuran sukarela**: per Merchant/User, kapan saja, nominal bebas, tanpa overdue, tidak pernah menyebabkan suspend.
- Model data: `MerchantFee` (menggabungkan iuran pokok, cicilan, denda, admin fee). `PaymentAttempt` punya target **XOR**: `commerceOrderId` atau `merchantFeeId`.
- Semua angka (PPN, rate/km, fee, bunga, cutoff, limit) harus **configurable di Admin Settings**.

## 6. Database final (20 tabel, 40 FK)

Sumber kebenaran: `D:\Unsorted Downloads\db_ecommerce.sql` (versi dengan perbaikan FK `Conversation` dan `PaymentAttempt` → `ON UPDATE/DELETE RESTRICT`). Jangan tambah tabel baru tanpa persetujuan Steven; schema sudah **freeze** dan sinkron dengan ERD jurnal.

1 User · 2 UserRole · 3 Session · 4 Store · 5 Product · 6 ProductVariant · 7 Cart · 8 CartItem · 9 CommerceOrder · 10 CommerceOrderItem · 11 PaymentAttempt · 12 MerchantFee · 13 CourierProfile · 14 DeliveryBatch · 15 DeliveryBatchOrder · 16 Review · 17 Conversation · 18 Message · 19 Notification · 20 PlatformSettings

Catatan desain: gambar/opsi produk disimpan JSON; reservasi stok di `CommerceOrderItem`; histori memakai kolom JSON (`CommerceOrder.activityHistory`, `CourierProfile.availabilityHistory`, `DeliveryBatchOrder.deliveryHistory`); `Notification` punya `dedupeKey` unik; `Conversation.openKey` unik; Store punya `latitude/longitude` dengan CHECK (keduanya null atau keduanya valid).

## 7. Arsitektur backend

- Ada **final repository** (`backend/repositories/finalPrismaRepository.js`) berisi akses data kanonis ke 20 tabel final. Ada juga router `repositoryReadRouter.js` / `repositoryWriteRouter.js` (mode `legacy|shadow|canary|final`) yang dipakai untuk migrasi bertahap dari repository lama.
- Konfigurasi dev saat ini: `FINAL_REPOSITORY_READ_MODE=final`, `FINAL_REPOSITORY_WRITE_MODE=final`, shadow sync dan legacy mirror **mati**. Tabel legacy (65 tabel lama) sudah beku, tidak dipakai bisnis aktif.
- Alur: Frontend service → shared `apiClient` → Express → Prisma → MySQL. LocalStorage **bukan** sumber data otoritatif (mock lama dibuang/diarsipkan). Identitas user selalu dari bearer session, jangan percaya `userId` dari frontend.
- Chat: Socket.IO di server HTTP yang sama, auth lewat session token, MySQL + REST tetap source of truth.

## 8. Frontend dan aturan UI (WAJIB dijaga di setiap perubahan)

- Gunakan **global container** (`frontend/src/components/ui/PageContainer.jsx`, class `.page-container`, grid responsif 1440px). **Jangan** buat wrapper luar khusus role dan jangan edit per halaman kalau bisa lewat komponen bersama.
- **Admin Settings = DESIGN LOCKED.** Layout/IA/visual sudah disetujui; hanya boleh perbaiki fungsi, validasi, i18n, tema, bug responsif. Bentuknya mengikuti pola Settings Hub gaya Freshdesk Omni-channel (kategori + detail page, pencarian, recent settings).
- Wajib **responsif** (uji 360, 390, 430, 768, 1024, 1366, 1440 px) di setiap prompt, tanpa harus diingatkan lagi.
- Wajib **ID/EN** penuh (tanpa teks campur, tanpa enum mentah di UI) dan **light/dark**. Toggle bahasa dan tema ada di halaman Account (bukan di Home).
- Gaya mobile mengikuti marketplace app: header terracotta bermotif halus khas Kucur, search putih, cart dan notifikasi di header, background abu hangat. Notifikasi dibuka sebagai popup yang bisa discroll (bukan redirect). Referensi visual: Shopee, tapi UI harus terasa orisinal, tidak "AI made".
- Dashboard: kartu bisa diklik sebagai shortcut ke menu (hitungan harus sesuai filter), filter default hari ini + 7 hari / 1 bulan / 1 tahun / custom range.
- Semua role harus punya logout; sembunyikan tombol login/register jika sudah login. Navbar header harus ikut role aktif.

## 9. Status terakhir

- Backend tests 87/87, final repository 22/22, router 21/21, Prisma validate/generate pass, Playwright e2e **53/53** (dicek ulang 2026-10-04), lint dan build pass. Warning bundle Vite >500 kB (±697 kB) non-blocking.
- Integritas DB: 20 tabel, 40 FK, 0 orphan, 0 pelanggaran XOR.
- **Feature freeze diberlakukan**: hanya boleh perbaikan blocking bug; tidak ada fitur baru, perubahan schema, atau refactor besar.
- Polish halaman detail dan modal **selesai** (dicek 2026-10-04): komponen bersama `DetailSection`, `StatusTimeline`, `ActionDialog` di `frontend/src/components/ui/`, dicover `e2e/detail-polish.spec.js`.
- `prisma/seed.js` mayoritas menulis ke tabel **legacy**; runtime membaca tabel final (`Target*`). Fixture e2e yang perlu di-reset harus di-update juga di tabel final.
- **Redesign UI mobile-first (Okt 2026)**: mockup disetujui di https://claude.ai/artifact/MkmtjGdu6UF32f9K9zShmM. Fondasi: font Plus Jakarta Sans, teks dasar 16px, tombol 48px, satu tombol hijau utama, token `--kucur-green-ink` untuk teks hijau, Tailwind `dark:` mengikuti class `.dark` aplikasi, aturan elemen global lama di `@layer base`. Halaman **Customer selesai** (Beranda, Katalog, Detail Produk, Keranjang, Checkout dengan tip kurir, Pesanan, Detail Pesanan, Akun, Notifikasi, Ulasan Saya, Pesan). Merchant selesai (Beranda Lapak + menu bawah HP, Pesanan, Detail Pesanan, Produk + form Tambah/Edit, Keuangan Lapak, Iuran Sukarela, Ulasan, Detail/Buat Lapak). Kurir selesai (menu bawah HP, beranda hari ini, detail batch dengan Telepon/Maps/COD, bukti antar = foto dari HP diunggah ke backend/uploads/proofs, URL absolut di proofPhotoUrl). Admin selesai (menu bawah HP, badge status tidak patah, Batch Pengiriman berjalan vs riwayat, Transaksi dengan tombol Filter di HP, Keuangan ringkas per lapak; Admin Settings tidak diubah). Redesign semua role selesai. Bahasa/tema untuk pengguna login diubah di /settings (e2e helper `setPreferences`). Default bahasa: Indonesia.
- **Database demo terpisah `kucur_demo`** (untuk screenshot jurnal & demo TA; `kucur` tetap untuk e2e). Isi via `prisma/seed-demo.js` (5 lapak aktif + 1 pengajuan pending, 17 produk tanpa foto, ~33 order 4 minggu terakhir lewat service asli, batch harian, ulasan, iuran, chat). Akun sama dengan halaman login (`KucurDev123!`). Perintah backend: `npm run dev:demo` (backend ke kucur_demo) dan `npm run db:demo:reset` (Prisma menolak reset jika dijalankan AI, jadi Steven yang menjalankan).
- PPN diterapkan di checkout (2026-10-04): `taxAmount = round(productTotal × taxPercent%)` per order, snapshot `taxPercentSnapshot`, masuk ke `grandTotal`/tagihan COD; baris PPN tampil di checkout dan detail order Customer/Merchant/Admin. Halaman kurir menampilkan total COD yang harus ditagih.
- COD otomatis lunas saat kurir upload bukti antar: order `paymentStatus=PAID`, `PaymentAttempt` COD `PAID` + `paidAt`, `completedAt` diisi (disetujui Steven 2026-10-04).
- Sisa tugas berurutan:
  1. Selesaikan polish detail page dan modal.
  2. Bersihkan demo data.
  3. Ambil screenshot untuk jurnal.
  4. Render diagram Mermaid (`docs/final-documentation/fig-*.mmd`) jadi SVG/PDF (Mermaid CLI belum terpasang).
  5. Finalisasi jurnal dan sitasi.
  6. Persiapan demo TA.
- Ide masa depan (di luar scope): SMTP/Roundcube untuk notifikasi email, payment gateway Midtrans, kembali ke Tourism/Live In, integrasi SIG.

## 10. Jurnal dan dokumen

- Jurnal harus memakai template kampus (SINTA 5). Referensi **minimal 15** dalam **5 tahun terakhir**, gaya **IEEE**, urut sesuai kemunculan sitasi, lengkap DOI/link yang bisa diunduh (Steven memasukkan ke Mendeley). Cek tidak ada referensi fiktif. Landasan teori boleh merujuk RPJMDes. Referensi dengan penulis Meme Susilowati banyak membahas desa.
- Bagian Testing Result dan Discussion sempat dihapus dari artikel, lalu hasil pengujian disiapkan sebagai tabel ringkasan **[VERIFIKASI struktur artikel terakhir]**.
- **6 figure final**: (1) Agile process, (2) Use case (Visitor, Customer, Merchant, Courier, Admin), (3) Activity diagram checkout → payment → fulfillment → review, (4) System architecture, (5) Delivery/fulfillment (DeliveryBatch), (6) ERD final 20 tabel. File sumber `.mmd` ada di `docs/final-documentation/`.
- Sudah ada PPT presentasi untuk brainstorming TA dan client (sitemap, latar belakang, rumusan masalah, regulasi/RPJMDes, metode Agile). Status akhir PPT **[VERIFIKASI]**.
- Anti-plagiarisme/Turnitin: Steven ingin tulisan natural; jangan menjanjikan lolos Turnitin.

## 11. Cara kerja yang diinginkan Steven

- Jawaban langsung dan praktis, tanpa penjelasan berlebihan. Bahasa santai Indonesia.
- Pecah pekerjaan per modul, bukan melebar. Setiap prompt ke agen coding harus mengingatkan: responsif, global container, ID/EN, light/dark, Admin Settings terkunci.
- Kalau ada ketidakpastian tentang status kode, **cek kodenya langsung** dulu sebelum bertanya atau menebak.
