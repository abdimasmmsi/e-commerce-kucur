-- Fitur ala marketplace (disetujui Steven 2026-10-06). Tetap 20 tabel.
-- Harga coret, pengingat stok, statistik dilihat (produk); langganan notifikasi push & riwayat jelajah (pengguna).
ALTER TABLE `Product`
  ADD COLUMN `compareAtPrice` DECIMAL(18, 2) NULL,
  ADD COLUMN `restockWatchers` JSON NULL,
  ADD COLUMN `viewStats` JSON NULL;
ALTER TABLE `ProductVariant`
  ADD COLUMN `compareAtPrice` DECIMAL(18, 2) NULL;
ALTER TABLE `User`
  ADD COLUMN `pushSubscriptions` JSON NULL,
  ADD COLUMN `browsingHistory` JSON NULL;
