-- Alamat pengiriman customer (maks 5, satu alamat utama) disimpan di tabel User sebagai JSON.
ALTER TABLE `User`
  ADD COLUMN `addresses` JSON NULL;
