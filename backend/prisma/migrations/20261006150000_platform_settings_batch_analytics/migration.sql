-- Pengingat persetujuan draf batch (menit sebelum dispatch, diatur Admin) dan laporan Analytics buatan Admin.
-- Disetujui Steven 2026-10-06. Tetap 20 tabel.
ALTER TABLE `PlatformSettings`
  ADD COLUMN `batchReminderMinutes` INT NOT NULL DEFAULT 60,
  ADD COLUMN `analyticsReports` JSON NULL;
