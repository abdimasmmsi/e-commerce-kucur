# 01. Skenario Tugas UAT

Cara pakai: bacakan tugas satu per satu. Peserta mengerjakan sendiri; pencatat menandai hasil: **S** = berhasil sendiri, **B** = dibantu, **G** = gagal. Batas waktu adalah perkiraan wajar; jika terlewat, catat dan lanjutkan.

Nama menu mengikuti aplikasi. Di HP, menu ada di bagian bawah layar.

## Urutan sesi dan ketergantungan

| Urutan | Sesi | Syarat | Disiapkan oleh |
|---|---|---|---|
| 1 | Penjual: ajukan lapak (J1) | Akun ada | Steven (akun) |
| 2 | Admin: setujui lapak (A1) | J1 selesai | Steven |
| 3 | Penjual: bayar cicilan pertama (J2), Admin konfirmasi (A4), Penjual tambah produk (J3) | Lapak disetujui | Steven/Admin |
| 4 | Pembeli: P1-P5, P8 | Ada produk aktif dengan stok | Steven (produk cadangan jika Penjual belum selesai) |
| 5 | Penjual: proses pesanan (J4), lihat keuangan (J5) | Pesanan Pembeli sudah masuk | Pembeli sesi 4 |
| 6 | Admin: draf Jadwal Pengiriman (A2) | Ada pesanan Siap diambil kurir | Penjual sesi 5 |
| 7 | Kurir: K1-K5 | Jadwal sudah disetujui Admin | Admin sesi 6 |
| 8 | Pembeli: ulasan (P7); Penjual: balas ulasan (J6); Admin: A3, A5, A6 | Pesanan sudah Selesai | Kurir sesi 7 |

Tugas P1, P2, P3, P4, P6, P8 tidak bergantung pada peran lain. Pesanan yang masuk sesudah batas pesan masuk jadwal besok; Steven menyesuaikan batas pesan di Pengaturan Platform agar alur bisa selesai dalam satu hari, atau sesi Kurir dilakukan hari berikutnya.

**Data awal yang disiapkan Steven:**
- Minimal 3 produk aktif dengan stok di satu lapak cadangan (untuk Pembeli bila Penjual belum selesai).
- Akun Kurir (dibuat Admin), akun Admin, akun Penjual/Pembeli sesuai jumlah peserta.
- Tarif ongkir, PPN, biaya admin terisi di Pengaturan Platform; koordinat lapak terisi.
- Satu pesanan cadangan yang sudah Selesai untuk menguji ulasan bila alur belum sampai.

---

## PERAN PEMBELI

### P1. Daftar dan masuk (5 menit)
- **Tujuan:** membuat akun dan masuk.
- **Langkah:** buka [URL-UAT], tekan **Masuk**, pilih **Daftar**, isi nama, email, nomor HP, kata sandi, lalu alamat utama (tandai titik di peta atau **Gunakan lokasi saya**). Setelah itu keluar dan masuk lagi.
- **Hasil diharapkan:** akun jadi, bisa masuk kembali, nama tampil di Akun.
- Hasil: S / B / G

### P2. Atur alamat (4 menit)
- **Langkah:** **Akun > Alamat Saya**, tekan **+ Tambah alamat**, isi penerima dan alamat, tandai titik peta, simpan, lalu jadikan utama.
- **Hasil diharapkan:** alamat baru tersimpan dengan titik peta dan tanda Utama.
- Hasil: S / B / G

### P3. Cari dan lihat produk (5 menit)
- **Langkah:** dari Beranda atau **Produk**, cari satu barang lewat kolom cari, buka detail, lihat harga, stok, ulasan, dan nama lapak.
- **Hasil diharapkan:** peserta menemukan produk yang diminta dan bisa menyebut harga serta lapaknya.
- Hasil: S / B / G

### P4. Masukkan ke keranjang (4 menit)
- **Langkah:** pada dua produk tekan **+ Keranjang** (pilih varian bila ada), buka Keranjang, ubah jumlah, lihat total.
- **Hasil diharapkan:** keranjang berisi 2 produk dengan jumlah yang diinginkan.
- Hasil: S / B / G

### P5. Checkout COD dengan tip (8 menit)
- **Langkah:** **Lanjut ke Checkout**, pilih alamat, lihat ongkir dan PPN, pilih tip kurir (mis. Rp2.000), cara bayar COD, lalu **Buat Pesanan**.
- **Hasil diharapkan:** pesanan terbentuk (satu per lapak). Peserta bisa menyebut total yang dibayar tunai.
- Hasil: S / B / G

### P6. Lacak dan batalkan pesanan (6 menit)
- **Langkah:** **Pesanan Saya**, tab **Berjalan**, buka satu pesanan dan baca statusnya. Untuk pesanan latihan yang masih **Menunggu**: **Batalkan pesanan** dan tulis alasan. Gunakan pesanan terpisah dari yang akan diproses Penjual.
- **Hasil diharapkan:** peserta memahami status; pesanan latihan menjadi Dibatalkan.
- Hasil: S / B / G

### P7. Beri ulasan (5 menit), setelah pesanan Selesai
- **Langkah:** **Pesanan Saya > Selesai**, buka pesanan, **Beri ulasan**, pilih bintang, tulis komentar, simpan.
- **Hasil diharapkan:** ulasan tersimpan dan tampil di **Ulasan Saya**.
- Hasil: S / B / G

### P8. Chat penjual (4 menit)
- **Langkah:** di halaman produk tekan **Chat**, kirim satu pertanyaan, lihat percakapan di ikon chat.
- **Hasil diharapkan:** pesan terkirim dan percakapan tersimpan.
- Hasil: S / B / G

---

## PERAN PENJUAL

### J1. Ajukan lapak (10 menit)
- **Langkah:** masuk sebagai Pembeli, **Akun > Buka Lapak**, isi data lapak, tandai lokasi di peta, kirim pengajuan.
- **Hasil diharapkan:** status **Menunggu peninjauan**. Admin menyetujui (lihat A1).
- Hasil: S / B / G

### J2. Bayar cicilan pertama iuran pokok (5 menit), setelah disetujui
- **Langkah:** **Menu > Keuangan Lapak**, pilih cara bayar (Lunas sekali / Cicil 3 kali / Cicil 6 kali), tekan **Bayar**. Uang diserahkan ke pengelola, lalu Admin mengonfirmasi.
- **Hasil diharapkan:** status menunggu konfirmasi, kemudian lapak aktif.
- Hasil: S / B / G

### J3. Tambah produk (10 menit)
- **Langkah:** **Produk > + Tambah Produk**, isi nama, kategori, harga, stok, deskripsi, foto, simpan sebagai **Aktif**.
- **Hasil diharapkan:** produk tampil di katalog.
- Hasil: S / B / G

### J4. Proses pesanan sampai siap diambil (8 menit)
- **Langkah:** **Pesanan**, tab **Baru**, **Konfirmasi pesanan**, **Mulai kemas**, lalu **Siap diambil kurir**.
- **Hasil diharapkan:** status berubah sampai Siap diambil kurir; pembeli mendapat notifikasi.
- Hasil: S / B / G

### J5. Lihat Keuangan Lapak dan biaya admin (6 menit)
- **Langkah:** **Menu > Keuangan Lapak**, lihat bagian **Perlu dibayar**, biaya admin per bulan, dan tanggal batas bayar.
- **Hasil diharapkan:** peserta bisa menyebut berapa yang harus dibayar dan kapan batasnya.
- Hasil: S / B / G

### J6. Balas ulasan (4 menit), setelah ada ulasan
- **Langkah:** **Menu > Ulasan**, filter **Belum dibalas**, **Balas ulasan**, simpan.
- **Hasil diharapkan:** balasan tampil di ulasan.
- Hasil: S / B / G

Opsional bila sempat: saat kurir datang, centang barang di **Ambil Barang Hari Ini**.

---

## PERAN KURIR

### K1. Masuk (4 menit)
- **Langkah:** masuk dengan akun dari Admin (kata sandi awal diberikan fasilitator), ganti kata sandi bila diminta.
- **Hasil diharapkan:** masuk ke Beranda Kurir.
- Hasil: S / B / G

### K2. Lihat jadwal (5 menit)
- **Langkah:** **Beranda** atau **Jadwal Pengiriman**, buka jadwal hari ini, lihat lapak, daftar barang, dan tujuan.
- **Hasil diharapkan:** peserta bisa menyebut berapa pesanan dan ke mana saja.
- Hasil: S / B / G

### K3. Ambil barang (8 menit)
- **Langkah:** **Mulai pengiriman**, di lapak cek barang dan tekan **Konfirmasi Ambil Barang** (setelah penjual mencentang), lalu **Mulai Antar**.
- **Hasil diharapkan:** status pesanan menjadi Diantar.
- Hasil: S / B / G

### K4. Antar dan unggah bukti foto (8 menit)
- **Langkah:** di tujuan lihat total COD, boleh coba **Telepon** atau **Maps**, foto barang yang diterima, tekan **Foto & selesaikan**.
- **Hasil diharapkan:** pesanan Selesai, pembayaran Sudah dibayar.
- Hasil: S / B / G

### K5. Ajukan cuti (5 menit)
- **Langkah:** **Menu > Cuti**, isi tanggal dan alasan, **Kirim pengajuan**.
- **Hasil diharapkan:** status **Menunggu Admin**.
- Hasil: S / B / G

---

## PERAN ADMIN

### A1. Setujui lapak (6 menit)
- **Langkah:** **Persetujuan Lapak**, buka pengajuan, periksa data, tekan **Setujui Lapak** (atau **Tolak** dengan alasan).
- **Hasil diharapkan:** penjual mendapat notifikasi; lapak aktif setelah cicilan pertama dikonfirmasi (A4).
- Hasil: S / B / G

### A2. Periksa dan setujui draf Jadwal Pengiriman (10 menit)
- **Langkah:** **Jadwal Pengiriman**, bagian **Draf jadwal otomatis**, periksa pesanan per kurir, pindahkan satu pesanan bila perlu (pilihan **Kurir**), tekan **Setujui**.
- **Hasil diharapkan:** jadwal muncul di halaman kurir.
- Hasil: S / B / G

### A3. Pantau transaksi (6 menit)
- **Langkah:** **Transaksi**, cari pesanan, **Lihat detail**, baca status, kurir, bukti pengiriman, dan Aktivitas.
- **Hasil diharapkan:** peserta bisa menjelaskan posisi satu pesanan.
- Hasil: S / B / G

### A4. Konfirmasi pembayaran dan tandai biaya admin ditarik (8 menit)
- **Langkah:** **Keuangan**, buka satu lapak, konfirmasi pembayaran yang diajukan penjual, atau tekan **Tandai sudah ditarik** pada biaya admin bulan tertentu dan isi cara serta catatan.
- **Hasil diharapkan:** tagihan menjadi lunas; penjual mendapat notifikasi.
- Hasil: S / B / G

### A5. Lihat Analitik (6 menit)
- **Langkah:** **Menu > Analitik & Laporan**, pilih satu laporan, ubah periode, baca Sorotan, ganti tampilan Grafik/Tabel.
- **Hasil diharapkan:** peserta bisa menyebut lapak atau produk teratas.
- Hasil: S / B / G

### A6. Tambah kurir (6 menit)
- **Langkah:** **Menu > Kurir**, **+ Tambah kurir**, isi nama (fiktif), email, WhatsApp, kapasitas, **Buat akun**.
- **Hasil diharapkan:** akun kurir dibuat dengan kata sandi awal.
- Hasil: S / B / G

Opsional: setujui atau tolak pengajuan cuti kurir di **Menu > Kurir**, bagian Pengajuan cuti, setelah K5.

---

## Ringkasan penilaian

Keberhasilan tugas = jumlah **S** dibagi jumlah tugas yang dicoba. Hitung per tugas dan per peran di `06-template-laporan-hasil.md`.
