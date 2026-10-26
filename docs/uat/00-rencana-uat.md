# 00. Rencana UAT Platform Kucur

## 1. Tujuan
1. Memastikan alur utama platform (belanja, jual, antar, kelola) bisa dipakai oleh calon pengguna sebenarnya.
2. Mengukur kemudahan penggunaan dengan kuesioner SUS (System Usability Scale).
3. Menemukan kesalahan dan bagian yang membingungkan, lalu mencatatnya untuk perbaikan.

## 2. Ruang lingkup
**Diuji:** daftar/masuk, alamat, cari produk, keranjang, checkout COD dengan tip kurir, lacak/batalkan pesanan, ulasan, chat penjual (Pembeli); ajukan lapak, tambah produk, proses pesanan, Keuangan Lapak, balas ulasan (Penjual); jadwal, ambil barang, antar + foto bukti, cuti (Kurir); persetujuan lapak, draf Jadwal Pengiriman, pantau transaksi, keuangan, Analitik, tambah kurir (Admin).

**Tidak diuji:** pembayaran online (hanya COD yang aktif), kurir menerima/menolak penugasan (tidak ada), retur/komplain, hapus akun, email, uji beban/keamanan teknis (sudah diuji terpisah secara otomatis).

## 3. Peserta
Usulan total **16-20 orang**.

| Peran | Target | Alasan |
|---|---|---|
| Pembeli | 6-8 | Peran paling banyak dipakai; alur terpanjang |
| Penjual | 4-5 | Pelaku usaha desa; alur lapak dan keuangan |
| Kurir | 2-3 | Jumlah kurir desa memang sedikit |
| Admin/pengelola | 2 | Pengelola desa; alur paling kompleks |

Alasan: SUS biasanya butuh minimal 10-12 responden agar skor rata-rata cukup stabil; untuk temuan kegunaan, 5 orang per peran sudah menemukan sebagian besar masalah utama. Jumlah kecil per peran berarti hasil per peran bersifat indikatif, bukan statistik. Jika peserta kurang, utamakan Pembeli dan Penjual, dan tetap minimal 1 orang per peran.

Peserta: warga/pelaku usaha desa, pengelola desa, dan mahasiswa. Usahakan campuran literasi digital rendah-tinggi.

## 4. Lingkungan uji
- **URL:** [URL-UAT] (HTTPS, dibuka lewat HP atau laptop).
- **Data:** data uji buatan, bukan data asli warga. Peserta diminta tidak memasukkan data pribadi sungguhan (nama, alamat, nomor HP) selain yang diperlukan; pakai nama/alamat fiktif atau yang disediakan.
- **Akun:** akun uji dibuat fasilitator: [AKUN-PEMBELI-n], [AKUN-PENJUAL-n], [AKUN-KURIR-n], [AKUN-ADMIN-n]; kata sandi dikirim lewat pesan pribadi, tidak ditulis di dokumen ini. Pembeli boleh mendaftar sendiri (tugas 1).
- **Perangkat:** HP Android/iPhone milik peserta (utama) dan laptop (Admin). Peramban terbaru. Perlu sinyal/Wi-Fi stabil.
- Pembayaran hanya COD; tidak ada uang sungguhan yang berpindah.

## 5. Jadwal 1 minggu (usulan)
| Hari | Tanggal (usulan) | Kegiatan |
|---|---|---|
| H-7 s.d. H-1 | 26 Okt - 1 Nov | Persiapan: deploy, akun, data awal, uji mandiri, undangan |
| Hari 1 (Senin) | 2 Nov | Sesi Admin + Penjual: setujui lapak, siapkan produk |
| Hari 2 | 3 Nov | Sesi Pembeli (buat pesanan) |
| Hari 3 | 4 Nov | Sesi Penjual (proses pesanan), Admin (draf jadwal) |
| Hari 4 | 5 Nov | Sesi Kurir (ambil + antar), Pembeli (ulasan) |
| Hari 5 | 6 Nov | Sesi cadangan/susulan, pengumpulan kuesioner |
| Hari 6-7 | 7-8 Nov | Olah data (SUS, tugas, bug), tindak lanjut awal |

Karena tugas saling bergantung (lihat `01-skenario-tugas.md`), urutan hari tidak boleh dibalik. Tanggal bisa digeser; yang penting urutannya.

## 6. Kriteria keberhasilan
| Ukuran | Target |
|---|---|
| Skor SUS rata-rata keseluruhan | >= 68 |
| Keberhasilan tugas (berhasil sendiri / total) | >= 80%. Dibantu dihitung terpisah, bukan berhasil |
| Temuan severity **Kritis** yang belum dibereskan | 0 |

Skor SUS per peran dilaporkan juga, tetapi hanya sebagai gambaran karena jumlahnya kecil.

## 7. Peran tim
| Peran | Orang | Tugas |
|---|---|---|
| Fasilitator + pengembang | Steven | Menjelaskan, menyiapkan akun/data, memantau server, memperbaiki bug mendesak |
| Pencatat | [Nama] | Mengisi lembar pengamatan (`03`), waktu, kesalahan |
| Pendamping peserta | [Nama] | Membantu hal teknis dasar (sinyal, lupa sandi). Tidak menunjukkan cara mengerjakan tugas |
| Dosen/pengamat | [opsional] | Mengamati |

Aturan pendamping: bila peserta macet, tunggu dulu ±2 menit, beri petunjuk umum, catat sebagai "dibantu".

## 8. Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Server mati/lambat saat sesi | Backup sebelum sesi, pantau, nomor darurat, sesi diulang bila perlu (lihat `05`) |
| Peserta bingung dengan UAT | Petunjuk 1 halaman, undangan WhatsApp, pendamping, contoh tugas |
| Sinyal lemah | Sesi di tempat dengan Wi-Fi, atau jadwalkan ulang |
| Data pribadi masuk ke sistem | Anjurkan data fiktif, anonimisasi (kode P01, P02), hapus akun uji sesudahnya |
| Tugas tertahan karena tugas peran lain belum jalan | Fasilitator menyiapkan data awal cadangan |
| Peserta menilai takut salah/sungkan | Jelaskan: yang diuji sistemnya, bukan peserta |

## 9. Etika dan data pribadi
- Partisipasi sukarela dengan persetujuan tertulis/centang (`04`).
- Kuesioner dan catatan memakai kode peserta (P01, dst.), tanpa nama lengkap.
- Data yang dicatat: peran, rentang usia, perangkat, hasil tugas, jawaban kuesioner. Tidak mencatat: lokasi sungguhan, kata sandi, data keuangan pribadi.
- Akun dan data uji dihapus/diatur ulang setelah UAT selesai; berkas rekaman layar (bila ada) hanya dengan izin dan dihapus setelah analisis.
- Prinsip umum UU Pelindungan Data Pribadi (UU PDP) dijadikan pedoman; dokumen ini bukan nasihat hukum.
