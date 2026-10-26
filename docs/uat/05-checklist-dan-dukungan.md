# 05. Checklist dan Dukungan

## A. Checklist persiapan

### H-7 sampai H-5
- [ ] Putuskan jumlah peserta per peran dan jadwal sesi; tentukan pencatat dan pendamping.
- [ ] Siapkan server dan alamat HTTPS [URL-UAT] (deploy). Catat tempat dan tanggal deploy.
- [ ] Atur NODE_ENV produksi, CORS untuk [URL-UAT], dan periksa peringatan produksi di log backend.
- [ ] Buat database UAT terpisah dari data demo/e2e. Isi data awal (lihat `01-skenario-tugas.md`).
- [ ] Atur Pengaturan Platform: ongkir per km, PPN, biaya admin, batas pesan dan jam berangkat (sesuaikan agar alur selesai dalam sehari), batas pengiriman.

### H-4 sampai H-2
- [ ] Buat akun uji (Admin, Kurir via Tambah kurir, Penjual, Pembeli cadangan). Kata sandi dikirim lewat pesan pribadi, jangan di dokumen bersama.
- [ ] Ganti kata sandi bawaan; akun @kucur.test **tidak** dipakai di server UAT.
- [ ] Uji mandiri **semua alur** (P1-P8, J1-J6, K1-K5, A1-A6) di HP asli dan laptop. Catat dan perbaiki bug Kritis/Tinggi.
- [ ] Uji di Android dan iPhone bila ada; uji unggah foto bukti dari kamera HP.
- [ ] Cetak: persetujuan (`04`), lembar pengamatan (`03`), kuesioner (`02`), atau siapkan formulir digital.
- [ ] Buat grup WhatsApp dukungan; kirim undangan (templat di bawah).

### H-1
- [ ] Backup database (`npm run db:demo:backup` untuk demo; untuk UAT lakukan setara pada database UAT) dan simpan salinan di luar server.
- [ ] Verifikasi backup dapat dibaca (mis. `node scripts/verifyBackup.js` untuk demo).
- [ ] Pastikan job otomatis berjalan (tagihan, draf jadwal) dan jam server benar (WIB).
- [ ] Siapkan pemantauan: buka log backend dan halaman uptime; siapa yang mengawasi.
- [ ] Kirim pengingat ke peserta.

### Hari sesi
- [ ] Server jalan; buka [URL-UAT] dari HP sendiri.
- [ ] Data awal cukup (produk, stok, kurir tidak cuti).
- [ ] Peserta menandatangani persetujuan sebelum mulai.
- [ ] Pencatat siap dengan lembar pengamatan.
- [ ] Setelah sesi: simpan lembar, kumpulkan kuesioner, catat bug.

### Sesudah UAT
- [ ] Masukkan SUS ke CSV dan jalankan `node docs/uat/hitung-sus.mjs`.
- [ ] Rekap bug dan tugas; isi `06-template-laporan-hasil.md`.
- [ ] Hapus atau reset akun dan data uji; hapus rekaman layar bila ada.
- [ ] Kirim ucapan terima kasih dan ringkasan hasil ke peserta.

## B. Kontak darurat

| Peran | Nama | Kontak |
|---|---|---|
| Fasilitator / pengembang | Steven | [NO-WA] |
| Cadangan teknis | [Nama] | [NO-WA] |
| Pendamping lapangan | [Nama] | [NO-WA] |
| Pengelola hosting | [Nama / penyedia] | [Kontak] |

## C. Pesan undangan WhatsApp (siap salin)

```
Selamat [pagi/siang], Bapak/Ibu [nama].

Saya Steven, mahasiswa Universitas Ma Chung. Saya mengundang Bapak/Ibu mencoba aplikasi belanja dan jual produk Desa Kucur. Ini uji coba untuk tugas akhir, hanya sekitar 30-45 menit, sukarela, dan memakai data contoh (bukan transaksi sungguhan).

Waktu: [hari, tanggal, jam]
Cara ikut:
1. Siapkan HP dengan sinyal/Wi-Fi yang baik.
2. Buka alamat: [URL-UAT]
3. Peran Bapak/Ibu: [Pembeli/Penjual/Kurir/Admin]
4. Akun dan kata sandi akan saya kirim terpisah lewat pesan pribadi.
5. Kami akan memberi daftar tugas sederhana. Bapak/Ibu tidak dinilai; yang dinilai aplikasinya.

Kalau ada kendala, tulis di grup ini atau hubungi saya: [NO-WA].
Terima kasih banyak atas bantuannya.
```

## D. FAQ peserta

| Pertanyaan | Jawaban |
|---|---|
| Saya lupa kata sandi. | Hubungi fasilitator di grup/WA; kata sandi akun uji akan diatur ulang. Jangan memakai kata sandi penting milik Anda. |
| Sinyal saya lemah / halaman tidak mau terbuka. | Pindah ke tempat dengan sinyal lebih baik atau Wi-Fi, muat ulang halaman, lalu kabari fasilitator bila tetap gagal. |
| Saya takut salah tekan. | Aman. Ini data uji. Salah tekan tidak merugikan siapa pun. |
| Apakah uang saya terpakai? | Tidak. Pembayaran hanya COD dan hanya latihan; tidak ada uang yang dibayar. |
| Apakah data saya disimpan? | Hanya data akun uji dan jawaban tanpa nama; dihapus setelah UAT (lihat lembar persetujuan). |
| Saya bingung harus ngapain. | Baca tugas satu per satu. Boleh bertanya ke pendamping; kami akan mencatatnya sebagai masukan. |
| Alamat apa yang saya isi? | Pakai alamat/titik peta contoh dari fasilitator, atau data fiktif. |
| Foto bukti tidak bisa diunggah (Kurir). | Izinkan akses kamera di peramban, coba lagi, dan kabari fasilitator. |
| Halaman menampilkan tulisan error. | Foto layarnya (tanpa data pribadi) dan kirim ke grup. |

## E. Rencana saat ada gangguan

| Gangguan | Siapa | Langkah | Respons |
|---|---|---|---|
| Server/situs tidak bisa dibuka | Steven | Cek server dan log; restart layanan; bila gagal pulihkan dari backup; kabari grup | Kabari peserta <= 5 menit; pulih <= 30 menit, bila tidak sesi diundur |
| Aplikasi lambat / error sebagian | Steven | Cek log, beban, koneksi database; minta peserta tunggu; catat sebagai bug | <= 10 menit |
| Data uji rusak / stok habis / tidak ada pesanan untuk tugas berikutnya | Steven | Buat data cadangan (produk, pesanan Selesai) atau reset data uji | <= 15 menit |
| Peserta tidak bisa masuk | Pendamping | Cek akun; atur ulang kata sandi; buat akun cadangan | <= 5 menit |
| Peserta sinyal buruk | Pendamping | Pindah ke Wi-Fi atau jadwalkan ulang | Saat itu juga |
| Bug Kritis ditemukan di tengah sesi | Steven | Catat (`03`), cari jalan memutar untuk peserta, perbaiki setelah sesi, uji ulang | Catat langsung; perbaikan sebelum sesi berikutnya |
| Data pribadi sungguhan masuk sistem | Steven | Hapus/ubah data tersebut, ingatkan peserta, catat kejadian | Segera |
