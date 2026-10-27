-- Tarif ongkir bertingkat (permintaan Steven 2026-10-27): 5 km pertama tarif tetap, sisanya per km. Tetap 20 tabel.
-- deliveryBaseFee = tarif untuk 5 km pertama; deliveryRatePerKm (sudah ada) = tarif per km setelah 5 km pertama.
ALTER TABLE `PlatformSettings`
  ADD COLUMN `deliveryBaseFee` DECIMAL(18, 2) NOT NULL DEFAULT 6000.00;
ALTER TABLE `PlatformSettings`
  ADD CONSTRAINT `PlatformSettings_deliveryBaseFee_check` CHECK (`deliveryBaseFee` >= 0);
