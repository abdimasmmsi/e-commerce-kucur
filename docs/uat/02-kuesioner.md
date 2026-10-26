# 02. Kuesioner UAT

Kode peserta: P___ (diisi pencatat)  Tanggal: ________

Tidak ada jawaban benar atau salah. Yang dinilai adalah aplikasinya, bukan Anda. Mohon jujur.

## Bagian A. Tentang Anda (opsional, tanpa nama)
- Peran yang dicoba: Pembeli / Penjual / Kurir / Admin
- Rentang usia: < 20 / 20-29 / 30-39 / 40-49 / 50+
- Perangkat yang dipakai: HP Android / iPhone / Laptop / Lainnya
- Pengalaman belanja online: Belum pernah / Jarang / Kadang / Sering
- Pengalaman berjualan online (khusus Penjual): Belum pernah / Pernah / Rutin

## Bagian B. System Usability Scale (SUS)

Skala: **1** = sangat tidak setuju, **2** = tidak setuju, **3** = netral, **4** = setuju, **5** = sangat setuju. Lingkari satu angka.

| No | Pernyataan | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | Saya berpikir akan sering menggunakan aplikasi ini. | 1 | 2 | 3 | 4 | 5 |
| 2 | Saya merasa aplikasi ini terlalu rumit padahal bisa dibuat lebih sederhana. | 1 | 2 | 3 | 4 | 5 |
| 3 | Saya merasa aplikasi ini mudah digunakan. | 1 | 2 | 3 | 4 | 5 |
| 4 | Saya merasa membutuhkan bantuan orang teknis untuk dapat menggunakan aplikasi ini. | 1 | 2 | 3 | 4 | 5 |
| 5 | Saya merasa fitur-fitur dalam aplikasi ini terpadu dengan baik. | 1 | 2 | 3 | 4 | 5 |
| 6 | Saya merasa ada terlalu banyak ketidakkonsistenan dalam aplikasi ini. | 1 | 2 | 3 | 4 | 5 |
| 7 | Saya membayangkan kebanyakan orang akan cepat belajar menggunakan aplikasi ini. | 1 | 2 | 3 | 4 | 5 |
| 8 | Saya merasa aplikasi ini sangat membingungkan untuk digunakan. | 1 | 2 | 3 | 4 | 5 |
| 9 | Saya merasa sangat percaya diri saat menggunakan aplikasi ini. | 1 | 2 | 3 | 4 | 5 |
| 10 | Saya perlu belajar banyak hal terlebih dahulu sebelum bisa menggunakan aplikasi ini. | 1 | 2 | 3 | 4 | 5 |

## Bagian C. Pertanyaan tambahan (skala 1-5, sama seperti di atas)

| No | Pernyataan | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| T1 | Istilah dan tulisan di aplikasi mudah saya pahami. | 1 | 2 | 3 | 4 | 5 |
| T2 | Aplikasi nyaman dipakai di HP (tombol dan tulisan cukup besar). | 1 | 2 | 3 | 4 | 5 |
| T3 | Aplikasi cukup cepat; saya tidak menunggu lama. | 1 | 2 | 3 | 4 | 5 |
| T4 | Saya percaya angka di aplikasi (harga, ongkir, total, tagihan) sudah benar. | 1 | 2 | 3 | 4 | 5 |
| T5 | Saya tahu apa langkah berikutnya di setiap halaman. | 1 | 2 | 3 | 4 | 5 |
| T6 | Saya mau memakai aplikasi ini untuk kegiatan sebenarnya di desa. | 1 | 2 | 3 | 4 | 5 |

## Bagian D. Isian terbuka
- **D1.** Fitur atau bagian mana yang paling berguna bagi Anda?
  ______________________________________________
- **D2.** Bagian mana yang paling membingungkan atau sulit?
  ______________________________________________
- **D3.** Kata atau istilah apa yang tidak Anda mengerti?
  ______________________________________________
- **D4.** Saran agar aplikasi lebih mudah dipakai:
  ______________________________________________

---

## Cara menghitung skor SUS (untuk peneliti)

1. Item **ganjil** (1, 3, 5, 7, 9): skor = jawaban - 1.
2. Item **genap** (2, 4, 6, 8, 10): skor = 5 - jawaban.
3. Jumlahkan 10 skor (rentang 0-40), kalikan **2,5**. Hasil 0-100.
4. Rata-ratakan seluruh responden (per peran dan keseluruhan).

Contoh: jawaban 4,2,4,2,4,2,4,2,4,2 menghasilkan skor ganjil 3x5=15, genap 3x5=15, jumlah 30, x 2,5 = **75**.

Otomatis: `node docs/uat/hitung-sus.mjs berkas.csv`.

## Interpretasi

| Skor SUS | Interpretasi |
|---|---|
| < 51 | Buruk (perlu perbaikan besar) |
| 51 - < 68 | Di bawah rata-rata |
| 68 - 80 | Baik |
| > 80 | Sangat baik |

Ambang 68 adalah rata-rata umum SUS. Skor bukan persentase. Pertanyaan tambahan (T1-T6) dilaporkan sebagai rata-rata terpisah dan tidak dimasukkan ke skor SUS.
