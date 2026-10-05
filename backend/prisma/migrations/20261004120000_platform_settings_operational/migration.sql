-- Pengaturan operasional tambahan pada tabel PlatformSettings yang sudah ada (tanpa tabel baru):
-- skema cicilan aktif, jarak antar maksimum, dan kontak pengelola desa.
ALTER TABLE `PlatformSettings`
  ADD COLUMN `installmentFullEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `installment3MonthsEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `installment6MonthsEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `maxDeliveryDistanceKm` DECIMAL(6, 2) NULL,
  ADD COLUMN `adminContactName` VARCHAR(120) NULL,
  ADD COLUMN `adminContactPhone` VARCHAR(30) NULL;
