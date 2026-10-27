# Checklist cek manual setelah perbaikan (27 Okt 2026)

Server UAT sudah dibuild ulang dengan semua perbaikan. Sebelum mulai: hard refresh browser (Ctrl+F5), di HP tutup tab lalu buka lagi. Tarif ongkir UAT sekarang Rp6.000 untuk 5 km pertama lalu Rp1.500 per km.

## Realtime (pakai dua perangkat)
- [ ] Admin membuka **Kurir**; kurir mengajukan cuti, pengajuan muncul di admin tanpa refresh (maks. ±15 detik).
- [ ] Admin menyetujui cuti; status di halaman Cuti kurir berubah sendiri.
- [ ] Pembeli checkout; penjual yang sedang membuka **Pesanan** melihatnya muncul.
- [ ] Penjual menekan Mulai kemas lalu Siap Diambil; status di halaman pembeli ikut berubah.
- [ ] Saat mengetik alasan batal/tolak, isian tidak hilang walau data diperbarui di belakang.
- [ ] Admin menyetujui lapak baru; halaman **Lapak Saya** penjual berubah sendiri.

## Ongkir
- [ ] Alamat pembeli ±1–5 km dari lapak: ongkir **Rp6.000**.
- [ ] Alamat ±8 km: ongkir **Rp12.000** (6.000 + 3 km × 1.500).
- [ ] Admin mengubah "Tarif 5 km pertama" dan "Tarif per km berikutnya" di Pengaturan Platform → Pengiriman; pesanan baru memakai angka baru, pesanan lama tetap.
- [ ] Jawaban chatbot "bagaimana ongkir dihitung" menyebut angka yang sama dengan Pengaturan Platform.

## Lokasi dan peta
- [ ] Peta di Daftar, Alamat Saya, Buka Lapak, Buat Lapak, dan Detail Lapak terbuka di sekitar Desa Kucur; saat di-scroll tidak menimpa header atau menu bawah.
- [ ] Menandai titik di luar Jawa Timur (atau koordinat manual luar negeri) ditolak dengan pesan "Lokasi di luar area layanan".
- [ ] Checkout → Lokasi saya sekarang: tampil koordinat, akurasi, dan "Menurut peta: nama tempat" (bila peta mengenalinya; bila tidak, nama tidak ditampilkan).
- [ ] Alamat lama dengan koordinat di luar Jatim tidak bisa dipakai checkout (pesan jelas).
- [ ] Di HP: Gunakan Lokasi Saya dengan izin lokasi *tepat* berhasil; lokasi kurang tepat ditolak dengan pesan penyebab.

## Pengiriman dan kurir
- [ ] Penjual menekan **Konfirmasi Siap Diambil**: tidak ada error.
- [ ] Kotak tanggal draf jadwal tidak bisa memilih hari kemarin (ketik manual pun ditolak).
- [ ] Dialog "Setujui draf jadwal?" tampil di tengah layar HP dengan semua tombol.
- [ ] Kurir menekan **Mulai Antar** pada satu pesanan; tombol pesanan lain terkunci sampai yang berjalan selesai atau ditandai gagal.
- [ ] Foto bukti dari kamera HP berhasil diunggah (lewat tunnel).
- [ ] Setelah semua tujuan selesai, kartu jadwal kurir menampilkan petunjuk bahwa Admin akan menutup jadwal.

## Chat
- [ ] Pembeli (bukan pemilik lapak) menekan **Chat Penjual** di detail produk: ruang chat terbuka.
- [ ] Pemilik lapak membuka produk lapaknya sendiri: tampil "Lapak kamu", tidak ada tombol chat yang mati.

## Tampilan HP (cek 360–430 px)
- [ ] Tombol Keluar ada di sidebar/menu laci semua panel (penjual, kurir, admin).
- [ ] "Buka Panel Penjual/Kurir/Admin" di halaman Akun rapi, satu baris.
- [ ] Form Alamat baru: kolom Label alamat sejajar dengan kotak alamat.
- [ ] Tombol × di kolom cari rapi (tidak biru bawaan).
- [ ] Keuangan lapak (admin, rincian per lapak) tampil sebagai kartu di HP dengan semua kolom.
- [ ] Tombol chatbot tidak menutupi tombol aksi di Keranjang, Simpan Produk, Tambah Lapak, dan detail pengantaran.
- [ ] Tombol ID/EN dan tema di header mudah diketuk.

## Foto dan data contoh
- [ ] Katalog menampilkan 11 produk berfoto contoh.
- [ ] Penjual bisa mengedit produk bervarian (mis. Keripik Singkong Balado) tanpa error 500.

## Setelah selesai tes
- [ ] Simpan hasil bila perlu: `snapshot-uat.ps1 -Name hasil-hari-1`.
- [ ] Kembalikan ke kondisi awal: `snapshot-uat.ps1 -Restore`.
