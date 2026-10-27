# Panduan Bicara Sempro (khusus untuk Steven, jangan dibagikan)

Dokumen ini isinya apa yang harus kamu ucapkan, cara menjelaskan alur sistem, arti semua singkatan yang muncul, dan jawaban untuk pertanyaan yang mungkin ditanyakan penguji. Deck: https://claude.ai/artifact/Janh4YSDJV1MgcTCXDjSvQ (23 slide).

Aturan emas: **jangan klaim fitur yang belum ada** (lihat bagian 7). Kalau tidak tahu, jawab "itu di luar cakupan proposal ini, saya catat sebagai pengembangan lanjutan". Jawaban jujur selalu lebih aman daripada jawaban yang salah.

---

## 1. Pola presentasi (sekitar 12-15 menit)

| Bagian | Slide | Waktu | Catatan |
|---|---|---|---|
| Pembuka | 1 | 0,5 mnt | Salam, nama, judul |
| Pendahuluan | 2-3 | 2 mnt | Latar belakang, rumusan, tujuan, batasan |
| Tinjauan pustaka | 4-6 | 2 mnt | Jangan baca tabel, sebut celahnya saja |
| Metodologi | 7-9 | 1,5 mnt | Agile, objek, fitur |
| Rancangan sistem | 10-21 | 5 mnt | Arsitektur, basis data, sitemap, use case, workflow, wireframe |
| Pengujian + penutup | 22-23 | 1 mnt | Apa yang sudah diuji dan rencana berikutnya |

Slide yang boleh dilewati cepat kalau waktu mepet: 6 (landasan teori), 11 dan 13 (kelompok tabel dan keputusan desain), 19-21 (wireframe). Slide yang wajib kamu kuasai: 2, 5, 10, 12, 16, 17 (workflow).

Satu kalimat inti (hafalkan): **"Platform ini membuat produk warga Desa Kucur bisa dipesan lewat HP, diantar oleh kurir desa, dan dipantau pengelola desa dalam satu sistem, bukan sekadar etalase online."**

---

## 2. Naskah per slide

1. **Cover.** "Selamat pagi Bapak/Ibu penguji. Saya Steven Danendra, NIM 322310018, Sistem Informasi. Proposal saya berjudul Pengembangan Platform E-Commerce Terintegrasi untuk Produk Lokal di Desa Wisata Kucur."
2. **Latar belakang.** "Desa Kucur punya produk pertanian dan industri rumah tangga. Digitalisasi sebelumnya sudah ada, yaitu pemetaan, layanan BUMDes, dan promosi. Tetapi RPJMDes mencatat usaha kecil belum menjangkau pasar luas. Jadi masalahnya bukan desa belum digital, melainkan belum ada alur transaksi: pesan, bayar, antar, dan pantau."
3. **Pendahuluan.** Bacakan tiga rumusan sekilas, lalu batasan: "Fokus e-commerce. Pembayaran yang aktif hanya COD. Booking wisata, Live In, SIG, dan ticketing di luar cakupan."
4. **Pembatas.** Langsung lewat.
5. **Penelitian terdahulu.** "Penelitian di Kucur berfokus pada informasi, pemetaan, dan promosi. Penelitian e-commerce UMKM umumnya satu toko atau memakai marketplace yang sudah ada. Celahnya: belum ada platform desa dengan banyak lapak, kurir desa, dan keuangan lapak dalam satu alur. Itu yang saya isi."
6. **Landasan teori.** "Ada sepuluh topik. Yang paling berkaitan dengan rancangan: Agile, arsitektur klien-server, basis data relasional, dan integritas transaksi." (jangan dibacakan semua)
7. **Jenis dan tahapan.** "Penelitian pengembangan sistem dengan Agile. Empat aktivitas diulang tiap iterasi: Product Backlog, Perencanaan dan Desain, Pengembangan dan Integrasi, Pengujian dan Review. Tahap 1 sampai 5 sudah berjalan. Uji penerimaan pengguna desa adalah tahap berikutnya."
8. **Objek dan sumber data.** "Data berasal dari literatur, RPJMDes, dan diskusi kebutuhan. Data uji adalah data demo, bukan data pribadi warga."
9. **Fitur utama.** "Lima peran. Pembeli memesan, penjual memproses, kurir mengantar, admin menyetujui dan memantau." Sebut dua fitur khas saja: pengiriman batch harian dan keuangan lapak.
10. **Arsitektur.** "Tiga lapisan. Pengguna memakai peramban atau HP. Backend menjalankan aturan bisnis: ongkir, PPN, dan stok dihitung di server supaya tidak bisa dimanipulasi dari layar. Data di MySQL. Layanan luar hanya untuk peta, jarak, dan notifikasi. Midtrans masih rencana."
11. **Kelompok tabel.** "Dua puluh tabel dalam enam kelompok. Yang inti: CommerceOrder untuk pesanan, MerchantFee untuk keuangan lapak, DeliveryBatch untuk pengiriman."
12. **ERD.** Cara baca: kotak = tabel, PK = kunci utama, FK = kunci asing, garis = relasi. "User jadi pusat karena semua peran adalah akun." Jangan menelusuri semua garis.
13. **Keputusan desain.** Pilih dua: snapshot harga (riwayat tidak berubah saat harga diubah) dan reservasi stok atomik (tidak ada oversell).
14. **Sitemap.** "Halaman utama tiap peran. Satu akun bisa punya beberapa peran."
15. **Use case.** "Pengunjung hanya melihat. Pembeli belanja dan menilai. Penjual mengelola lapak dan keuangannya. Kurir mengantar. Admin menyetujui dan memantau."
16. **Workflow 1 (pemesanan).** Lihat bagian 3 di bawah.
17. **Workflow 2 (pengiriman).** Lihat bagian 3 di bawah.
18-21. **Wireframe.** "Dirancang HP dulu karena warga memakai ponsel. Di laptop fiturnya sama, tata letaknya lebih lebar. Di HP tampilan diringkas, bukan fiturnya dikurangi."
22. **Pengujian.** "Sudah dijalankan: ratusan tes otomatis, skenario end-to-end per peran, pemeriksaan keamanan endpoint, uji rebutan stok, dan uji beban. Yang direncanakan: uji penerimaan oleh pengguna desa."
23. **Penutup.** "Terima kasih. Mohon masukan dari Bapak/Ibu."

---

## 3. Alur sistem (untuk menjelaskan workflow dan menjawab "bagaimana cara kerjanya")

### 3.1 Dari pesan sampai ulasan
1. **Pengunjung** boleh melihat produk. Untuk memesan wajib masuk (login).
2. **Pembeli** memilih produk, memasukkan ke keranjang (boleh dari banyak lapak) atau memakai Beli Sekarang.
3. **Checkout**: pembeli memilih alamat (maks 5 alamat tersimpan, titik peta wajib), cara bayar COD, dan boleh memberi tip kurir.
4. **Server menghitung**: subtotal, PPN (persentase global, disimpan sebagai snapshot di pesanan), ongkir (jarak dalam km dibulatkan ke atas; 5 km pertama tarif tetap, sesudahnya dikali tarif per km), tip. Semua dihitung di backend.
5. **Stok dikunci** dengan pembaruan atomik (`stok >= jumlah`). Kalau dua pembeli berebut stok terakhir, satu berhasil, satu mendapat pesan stok berubah.
6. Satu checkout **dipecah menjadi satu pesanan per lapak**, dikelompokkan dengan satu `checkoutGroupId`. Ada kunci idempotensi supaya klik dua kali tidak membuat pesanan ganda.
7. **Penjual** mendapat notifikasi, menerima pesanan (Menunggu menjadi Diterima), menekan Mulai kemas (Dikemas), lalu Siap diambil.
8. **Pembeli** hanya bisa membatalkan saat Menunggu atau Diterima. Setelah Mulai kemas tidak bisa. Penjual dan admin masih bisa membatalkan dengan alasan wajib; stok dikembalikan dan pembeli diberi tahu.
9. **Batas pesan**: pesanan yang masuk sebelum batas diproses untuk pengiriman hari itu; sesudahnya masuk batch besok. Ada maksimum pengiriman harian.
10. **Draf batch**: sistem menyusun draf (pesanan siap kirim dibagi ke kurir yang tidak cuti dan masih punya kapasitas, dikelompokkan per lapak). **Admin memeriksa, boleh memindah pesanan, lalu menyetujui.** Tidak ada persetujuan otomatis.
11. **Kurir** melihat batch yang sudah disetujui lalu memulainya. Di lapak, **penjual mencentang barang yang diserahkan**. Kalau semua tercentang, kurir bisa mulai antar. Pesanan yang tidak siap digeser ke besok.
12. **Kurir mengantar dan menagih COD** (harga barang + ongkir + tip + PPN), lalu **mengunggah foto bukti**. Saat bukti diunggah, pesanan otomatis lunas dan selesai.
13. Kalau **gagal antar**: admin bisa menjadwalkan ulang besok atau membatalkan (alasan wajib, stok kembali).
14. **Ulasan**: hanya dari pesanan selesai, satu ulasan per barang, penjual bisa membalas, admin bisa memoderasi.

### 3.2 Uang di sistem
- **Pembeli membayar** harga barang + PPN + ongkir + tip, tunai ke kurir (COD).
- **Biaya admin** (saat ini 5% dari subtotal sebelum PPN, bisa diatur) **dibebankan ke penjual**, bukan pembeli. Tagihan dibuat otomatis tiap pesanan selesai dan dikelompokkan per bulan. Batas bayar tanggal 7 bulan berikutnya pukul 12.00 WIB (tanggalnya diatur di Pengaturan Platform). Kalau masih ada tunggakan, lapak ditangguhkan otomatis dan aktif lagi setelah lunas. Dana ini untuk menggaji pengelola.
- **Iuran pokok**: wajib saat membuka lapak, boleh dicicil (lunas, 3 kali, atau 6 kali). Lapak aktif setelah cicilan pertama dikonfirmasi. Terlambat dikenai denda persentase dari sisa tagihan tiap 7 hari.
- **Iuran sukarela**: kapan saja, nominal bebas, tidak pernah menyebabkan lapak ditangguhkan.
- **Admin mengonfirmasi** pembayaran yang diajukan penjual, atau (fitur baru) **menandai sudah ditarik langsung** untuk biaya admin yang dibayar tunai di luar sistem.
- Semua angka (PPN, tarif per km, biaya admin, bunga, batas) ada di **Pengaturan Platform**, tidak ditanam di kode.

### 3.3 Hal yang dilakukan sistem sendiri (tanpa diminta)
- Menangguhkan lapak yang telat membayar biaya admin dan mengaktifkannya lagi setelah lunas (job tiap jam).
- Menghitung denda cicilan tiap 7 hari.
- Mengirim pengingat tagihan otomatis mulai 3 hari sebelum batas bayar (maksimal sekali sehari per lapak).
- Mengingatkan penjual kalau pesanan menunggu lebih dari 6 jam.
- Membersihkan sesi login yang sudah kedaluwarsa.
- Mengirim notifikasi (di dalam aplikasi dan push) untuk setiap perubahan status.

---

## 4. Glosarium: singkatan dan istilah yang dipakai

**Umum / akademik**
- **TA / TTG**: Tugas Akhir / Teknologi Tepat Guna (program tugas akhirmu).
- **UMKM**: Usaha Mikro, Kecil, dan Menengah.
- **BUMDes**: Badan Usaha Milik Desa.
- **RPJMDes**: Rencana Pembangunan Jangka Menengah Desa (dokumen perencanaan desa).
- **SIG**: Sistem Informasi Geografis (pemetaan; dikerjakan rekanmu, di luar cakupan).
- **UAT**: User Acceptance Test, uji penerimaan oleh calon pengguna.
- **SUS**: System Usability Scale, kuesioner baku 10 pertanyaan untuk mengukur kemudahan penggunaan.

**Metode**
- **Agile**: pengembangan bertahap dalam iterasi pendek, kebutuhan boleh berubah sambil jalan.
- **Product Backlog**: daftar kebutuhan yang diurutkan prioritas.
- **Iterasi**: satu putaran kerja (rencana, desain, bangun, uji, review).
- **Black-box testing**: menguji dari luar (input dan hasil) tanpa melihat kode.
- **Unit test**: menguji potongan kecil kode. **Integration test**: menguji beberapa bagian bekerja bersama. **End-to-end (E2E)**: menguji alur utuh lewat browser seperti pengguna (dipakai: Playwright).

**Teknologi**
- **Frontend / Backend**: tampilan yang dilihat pengguna / program di server yang menjalankan aturan dan menyimpan data.
- **React**: pustaka untuk membangun tampilan dari komponen. **Vite**: alat untuk menjalankan dan membangun proyek frontend. **Tailwind CSS**: pustaka gaya (CSS) berbasis kelas.
- **Node.js**: lingkungan menjalankan JavaScript di server. **Express**: kerangka kerja web untuk Node.js.
- **API**: pintu komunikasi antara frontend dan backend. **REST**: gaya API berbasis alamat URL dan metode HTTP (GET ambil, POST buat, PATCH ubah, DELETE hapus). **JSON**: format data teks yang dipertukarkan.
- **Socket.IO / WebSocket**: komunikasi dua arah real-time, dipakai untuk chat.
- **ORM / Prisma**: lapisan yang membuat tabel database bisa diakses seperti objek di kode. Prisma 6 dipilih karena versi 7 berbasis ESM yang tidak cocok dengan kode ini.
- **MySQL**: basis data relasional. **Docker**: menjalankan MySQL di wadah terisolasi untuk pengembangan.
- **PWA**: aplikasi web yang bisa dipasang di layar utama HP. **Web Push / VAPID**: notifikasi dari server ke browser; VAPID adalah pasangan kunci yang mengidentifikasi server pengirim.
- **Leaflet / OpenStreetMap**: peta interaktif dan datanya. **OpenRouteService**: layanan menghitung jarak rute. **Haversine**: rumus jarak garis lurus antara dua titik koordinat, dipakai sebagai cadangan.
- **Midtrans**: payment gateway (pembayaran online); baru disiapkan, belum aktif.
- **i18n**: dukungan banyak bahasa (di sini Indonesia dan Inggris). **Responsive**: tampilan menyesuaikan ukuran layar. **Mobile-first**: dirancang untuk HP dulu. **WCAG AA**: standar aksesibilitas (kontras warna, ukuran sentuh).

**Basis data**
- **Tabel, baris, kolom**: struktur dasar data.
- **PK (Primary Key)**: pengenal unik tiap baris. **FK (Foreign Key)**: kolom yang menunjuk PK tabel lain. **UK (Unique Key)**: nilainya tidak boleh sama.
- **ERD**: diagram relasi antar tabel. **Crow's foot**: notasi garis; kaki tiga = banyak, dua garis = satu.
- **Relasi 1 ke N**: satu baris di tabel A punya banyak baris di tabel B (satu pesanan punya banyak barang).
- **UUID / CHAR(36)**: pengenal acak 36 karakter, sulit ditebak. **DECIMAL**: tipe angka tepat untuk uang (hindari kesalahan pembulatan). **DATETIME(3)**: waktu dengan ketelitian milidetik.
- **CHECK constraint**: aturan yang dijaga database sendiri (contoh: pembayaran menunjuk pesanan atau tagihan, tidak keduanya).
- **RESTRICT**: data tidak boleh dihapus kalau masih dipakai tabel lain.
- **Snapshot**: salinan nilai saat kejadian (harga, PPN) supaya riwayat tidak berubah.
- **Atomik / transaksi**: serangkaian langkah yang berhasil semua atau batal semua.
- **Oversell**: stok terjual melebihi yang ada. **Race condition**: dua proses berebut data yang sama pada saat bersamaan.
- **Idempotensi / idempotency key**: permintaan yang sama dikirim dua kali hanya diproses sekali.

**Keamanan**
- **Autentikasi / otorisasi**: membuktikan siapa kamu / menentukan apa yang boleh kamu lakukan. **RBAC**: akses berdasarkan peran.
- **Bearer token / sesi**: bukti login yang dikirim di setiap permintaan; identitas selalu diambil dari sesi di server, tidak dipercaya dari kiriman frontend.
- **Hash kata sandi (scrypt)**: kata sandi disimpan sebagai sidik jari satu arah, bukan teks asli.
- **Rate limit**: membatasi jumlah permintaan per waktu (anti brute-force dan spam).
- **CORS**: aturan asal mana yang boleh memanggil API. **CSRF**: serangan memanfaatkan cookie login; tidak berlaku karena sistem memakai bearer token, bukan cookie.
- **IDOR**: mengakses data orang lain dengan menebak ID; diuji dan ditutup.
- **SQL injection / XSS**: penyisipan perintah ke database / skrip ke halaman; dicegah lewat ORM dan penyaringan input.
- **p95 latency**: waktu respons yang dilewati hanya 5% permintaan paling lambat (ukuran kecepatan yang adil).

**Istilah bisnis di aplikasi**
- **Lapak**: toko milik penjual. **COD**: Cash on Delivery, bayar tunai saat barang diantar. **PPN**: Pajak Pertambahan Nilai (persentase global yang diatur admin).
- **Batch**: kelompok pesanan yang diantar satu kurir dalam sehari. **Batas pesan (cutoff)**: batas waktu pesanan masih masuk pengiriman hari itu.
- **Iuran pokok / biaya admin / iuran sukarela**: tiga jenis uang yang dibayar penjual ke pengelola (lihat 3.2).
- **Ditangguhkan (suspended)**: lapak sementara tidak bisa menerima pesanan karena tunggakan.

---

## 5. Alasan pilihan teknologi (kalau ditanya "kenapa pakai X?")

- **React + Vite**: komponen bisa dipakai ulang di lima peran; banyak referensi; build cepat.
- **Node.js + Express**: satu bahasa (JavaScript) di frontend dan backend; ringan untuk skala desa; cocok untuk chat real-time.
- **MySQL**: relasional, kuat untuk transaksi (pesanan, stok, keuangan harus konsisten); umum dipakai dan mudah dihosting.
- **Prisma**: skema jelas, migrasi terkelola, mengurangi risiko SQL injection.
- **Socket.IO**: chat pembeli, penjual, dan admin real-time.
- **Agile**: kebutuhan berubah dari diskusi dengan pengelola desa, jadi tidak cocok dengan model yang menetapkan semua di awal.
- **COD + kurir desa**: warga terbiasa bayar tunai; kurir desa menjaga uang tetap di desa; pembayaran online memerlukan akun merchant dan kredensial yang belum ada.

---

## 6. Pertanyaan penguji yang mungkin muncul dan jawabannya

1. **Kenapa tidak pakai Tokopedia/Shopee saja?**
   Marketplace besar tidak mengenal logistik desa, tidak memberi pengelola desa kendali dan data, dan menarik komisi keluar desa. Platform ini mengatur pengiriman oleh kurir desa dan memberi pengelola pemantauan transaksi serta sumber dana pengelolaan lewat biaya admin.
2. **Apa kebaruan (novelty) penelitian ini?**
   Satu alur desa yang menyatukan banyak lapak, stok yang terjaga, pengiriman batch harian oleh kurir desa, keuangan lapak, peran terpisah, dan chat. Dari literatur yang saya tinjau, kombinasi ini belum ditemukan.
3. **Kenapa hanya COD?**
   Sesuai kebiasaan warga dan menghindari transfer manual yang rawan penjual nakal. Midtrans sudah disiapkan sebagai rencana, tetapi butuh kredensial merchant yang belum ada.
4. **Bagaimana kalau dua pembeli membeli stok terakhir bersamaan?**
   Pengurangan stok memakai pembaruan atomik dengan syarat stok cukup di dalam transaksi database. Satu berhasil, yang lain mendapat pesan stok berubah. Saya uji dengan banyak pembeli serentak: jumlah pesanan yang lolos sama dengan stok, stok tidak pernah negatif.
5. **Bagaimana ongkir dihitung?**
   Jarak dari lapak ke alamat dalam km dibulatkan ke atas, dikali tarif per km yang diatur admin. Jarak dari OpenRouteService; kalau jaringan gagal dipakai rumus Haversine.
6. **Kenapa perhitungan dilakukan di backend?**
   Karena layar pengguna bisa dimanipulasi. Harga, PPN, ongkir, stok, dan hak akses harus diputuskan server.
7. **Bagaimana keamanan sistem?**
   Kata sandi di-hash (scrypt), akses berdasarkan peran, identitas dari sesi server, pembatasan percobaan login dan permintaan, validasi input, dan pemeriksaan otomatis lebih dari seratus endpoint untuk kebocoran data dan akses ke data orang lain. Ada juga header keamanan dan pembaruan dependensi.
8. **Bagaimana kalau server mati atau data hilang?**
   Ada skrip backup dan verifikasi backup. Untuk produksi, backup terjadwal dan hosting perlu disiapkan saat serah terima.
9. **Apakah sistem sudah diuji pengguna sebenarnya?**
   Belum. Yang sudah: tes otomatis, E2E, keamanan, beban. Uji penerimaan pengguna desa adalah tahap berikutnya dengan kuesioner kegunaan.
10. **Berapa lama waktu muat dan berapa pengguna yang kuat?**
    Pada uji beban dengan 25 permintaan serentak, 95 persen respons di bawah sekitar 350 ms pada data demo. Skala desa jauh di bawah itu; untuk skala besar perlu uji ulang dan penyesuaian.
11. **Kenapa 20 tabel?**
    Dirancang cukup untuk seluruh alur dengan relasi yang rapi. Beberapa data tambahan memakai kolom JSON (riwayat, alamat) supaya skema tetap ramping.
12. **Bagaimana biaya admin dan siapa yang membayar?**
    Dibebankan ke penjual, bukan pembeli, sebesar persentase dari subtotal sebelum PPN. Tagihan dikelompokkan per bulan, batas bayar tanggal 7 bulan berikutnya pukul 12.00 WIB, lapak ditangguhkan bila menunggak. Dana ini untuk menggaji pengelola.
13. **Kenapa PPN dikenakan?**
    Persentase global diatur admin dan disimpan sebagai snapshot di tiap pesanan; bisa diatur ke 0 bila pengelola memutuskan lain. Penetapan kebijakan pajaknya mengikuti arahan pengelola.
14. **Bagaimana kalau kurir tidak bisa mengantar?**
    Kurir bisa mengajukan cuti yang harus disetujui admin; cuti yang disetujui memblokir penugasan. Kalau pengantaran gagal, admin menjadwalkan ulang atau membatalkan dengan alasan dan stok dikembalikan.
15. **Bagaimana kalau pembeli menolak barang atau barang rusak?**
    Saat ini ditangani lewat pengiriman gagal dan chat; alur retur dan komplain formal belum ada, dicatat sebagai pengembangan lanjutan.
16. **Siapa mengelola sistem setelah selesai?**
    Pengelola desa lewat peran admin; semua angka bisa diatur di Pengaturan Platform tanpa mengubah kode. Hosting dan serah terima disiapkan di akhir.
17. **Kenapa wireframe dulu HP?**
    Pengguna desa umumnya memakai ponsel. Prinsipnya: tampilan HP meringkas, bukan mengurangi fitur.
18. **Bagaimana menjamin pengguna dengan literasi digital rendah bisa memakai?**
    Antarmuka sederhana, istilah Indonesia, status pesanan jelas, chatbot FAQ lokal, dan rencana uji kegunaan dengan pengguna desa.
19. **Apa batasan penelitian ini?**
    Fokus e-commerce; pembayaran online belum aktif; pengujian memakai data demo; uji penerimaan pengguna belum dilakukan; integrasi SIG dan ticketing di luar cakupan.
20. **Kenapa data demo, bukan data asli?**
    Untuk melindungi data pribadi warga selama pengembangan dan pengujian.
21. **Apa bedanya penelitianmu dengan penelitian [5] dan [7]?**
    Lihat slide 5: penelitian tersebut berfokus pada promosi atau memakai aplikasi marketplace yang sudah ada; penelitian ini membangun platform transaksi desa sendiri dengan pengiriman dan keuangan lapak.
22. **Kenapa Agile, bukan Waterfall?**
    Kebutuhan berkembang dari diskusi dengan pemangku kepentingan dan temuan saat implementasi, jadi iterasi lebih aman daripada menetapkan semuanya di awal.
23. **Apa yang akan dikembangkan berikutnya?**
    Pembayaran online (Midtrans), notifikasi email, retur dan komplain, rekonsiliasi uang COD kurir, dan integrasi dengan SIG bila rekan TA sudah siap.

---

## 7. Jangan diklaim (belum ada di sistem)

- Kurir **menerima atau menolak** penugasan dengan batas waktu (tidak ada; kurir hanya melihat batch yang disetujui admin lalu memulai).
- **Pembayaran online** (Midtrans) aktif.
- **Uji penerimaan pengguna** sudah dilakukan.
- Rekonsiliasi **uang COD kurir** (talangan ke penjual, hak kurir, setoran PPN) tercatat di sistem. Kurir menalangi harga barang adalah **aturan operasional**, tidak dicatat sistem.
- **Retur/komplain formal**, pembatalan otomatis pesanan yang tidak dijawab penjual (hanya diingatkan).
- Email, Redis, penyimpanan awan (Cloudinary/S3), hosting nginx (ada di gambar lama jurnal, tidak ada di sistem).
- Gambar lama di jurnal (activity diagram dengan transfer manual, arsitektur dengan Redis dan email, Agile tujuh tahap) **tidak sesuai** sistem. Kalau penguji membandingkan dengan jurnal, jelaskan bahwa gambar di slide adalah versi yang disesuaikan dengan sistem sebenarnya.

---

## 8. Skenario demo singkat (3-5 menit, kalau diminta)

Pakai `https://localhost:5175` (database demo). Akun kata sandi `KucurDev123!`.
1. **Pembeli** (`customer@kucur.test`): buka Beranda, pilih produk, lihat detail (harga coret, bagikan), masukkan keranjang, Checkout: tunjukkan alamat, ongkir, PPN, tip, COD. Buat pesanan.
2. **Penjual** (`merchant.a@kucur.test`): Pesanan, terima, Mulai kemas, tandai siap diambil. Tunjukkan Keuangan Lapak (biaya admin per bulan).
3. **Admin** (`admin@kucur.test`): Jadwal Pengiriman, periksa draf batch, setujui. Tunjukkan Keuangan (konfirmasi pembayaran, rekap biaya admin, tandai sudah ditarik) dan Analitik.
4. **Kurir** (`courier@kucur.test`): lihat batch, mulai, antar, unggah foto bukti.
5. Kembali ke **pembeli**: pesanan selesai, beri ulasan.

Siapkan cadangan: tangkapan layar tiap langkah, kalau jaringan atau server bermasalah.

---

## 9. Checklist hari-H

- [ ] Docker Desktop dan MySQL menyala; backend demo (3001) dan frontend (5175) jalan.
- [ ] `npm run db:demo:backup` sebelum demo supaya data bisa dikembalikan.
- [ ] Deck dibuka dan diuji di laptop presentasi; cek logo, nomor halaman, dan diagram.
- [ ] Nama penguji di cover benar: Rudy Setiawan (ketua), Muhammad Nurwegiono (penguji I), Meme Susilowati (penguji II).
- [ ] Jurnal, daftar pustaka, dan dokumen proposal tertulis tersedia untuk dibuka bila ditanya.
- [ ] Baca ulang bagian 7: tidak ada klaim yang belum ada di sistem.
