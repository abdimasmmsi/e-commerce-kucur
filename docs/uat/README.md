# Paket Dokumen UAT Platform Kucur

Uji penerimaan pengguna (UAT) online, mulai sekitar 2 November 2026.

| File | Isi |
|---|---|
| `00-rencana-uat.md` | Tujuan, peserta, jadwal, kriteria berhasil, risiko, etika |
| `01-skenario-tugas.md` | Tugas per peran (Pembeli, Penjual, Kurir, Admin) dan urutan sesi |
| `02-kuesioner.md` | SUS 10 pernyataan + pertanyaan tambahan + cara menghitung skor |
| `03-lembar-pengamatan-dan-bug.md` | Templat catatan pengamat dan laporan bug |
| `04-persetujuan-peserta.md` | Lembar informasi dan persetujuan sukarela |
| `05-checklist-dan-dukungan.md` | Checklist H-7 s.d. sesudah sesi, pesan WhatsApp, FAQ, rencana gangguan |
| `06-template-laporan-hasil.md` | Kerangka bagian hasil UAT untuk laporan/jurnal |
| `hitung-sus.mjs`, `contoh-sus.csv` | Skrip hitung skor SUS dari CSV (data contoh fiktif) |

**Urutan pakai:** (1) baca `00`, putuskan jumlah peserta; (2) lakukan checklist `05` dan siapkan akun/data; (3) saat sesi: peserta membaca `04`, mengerjakan tugas `01` (pengamat mengisi `03`), lalu mengisi `02`; (4) masukkan jawaban SUS ke CSV, jalankan `node docs/uat/hitung-sus.mjs berkas.csv`; (5) isi `06`.
