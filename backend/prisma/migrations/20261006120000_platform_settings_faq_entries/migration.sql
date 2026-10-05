-- FAQ chatbot yang dikelola Admin (tambah/ubah/sembunyikan) disimpan sebagai JSON di PlatformSettings (disetujui Steven 2026-10-06).
ALTER TABLE `PlatformSettings`
  ADD COLUMN `faqEntries` JSON NULL;
