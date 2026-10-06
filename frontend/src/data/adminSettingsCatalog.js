export const settingsCategories = [
  { key: "recent", title: "Recent", description: "Pengaturan yang terakhir dibuka." },
  { key: "merchant", title: "Penjual & Lapak", description: "Aktivasi lapak, iuran pokok, cicilan, dan keterlambatan." },
  { key: "finance", title: "Keuangan & Pajak", description: "Biaya admin platform, PPN, dan iuran sukarela penjual." },
  { key: "payment", title: "Pembayaran", description: "Metode pembayaran dan kesiapan penyedia." },
  { key: "delivery", title: "Pengiriman", description: "Tarif, batas pesan, jam berangkat kurir, dan kapasitas pengiriman." },
  { key: "integrations", title: "Integrasi", description: "Status integrasi eksternal platform." },
  { key: "system", title: "Sistem", description: "Kontak pengelola desa untuk bantuan pengguna." },
];

export const settingsCatalog = [
  { key: "initial-fee", category: "merchant", title: "Iuran Pokok Lapak", description: "Nominal pembukaan yang berlaku independen untuk setiap lapak.", route: "/admin/settings/merchant/initial-fee", keywords: "iuran biaya awal aktivasi" },
  { key: "installments", category: "merchant", title: "Skema Cicilan", description: "Pembayaran penuh, 3 bulan, atau 6 bulan.", route: "/admin/settings/merchant/installments", keywords: "cicilan bunga keterlambatan aktivasi" },
  { key: "admin-fee", category: "finance", title: "Biaya Admin Platform", description: "Kewajiban pemilik lapak berupa persentase atau nominal tetap.", route: "/admin/settings/finance/admin-fee", keywords: "biaya admin batas bayar cutoff masa tenggang grace" },
  { key: "tax", category: "finance", title: "PPN", description: "Tarif PPN global untuk transaksi platform.", route: "/admin/settings/finance/tax", keywords: "pajak ppn" },
  { key: "contribution", category: "finance", title: "Iuran Sukarela", description: "Iuran opsional per penjual tanpa jatuh tempo.", route: "/admin/settings/finance/contribution", keywords: "iuran sukarela penjual merchant" },
  { key: "payment-methods", category: "payment", title: "Metode Pembayaran", description: "COD operasional; Midtrans menunggu kredensial nyata.", route: "/admin/settings/payment", keywords: "cod midtrans pembayaran" },
  { key: "delivery", category: "delivery", title: "Operasional Pengiriman", description: "Tarif per km, batas pesan, jam berangkat kurir, kapasitas harian, dan jarak maksimum.", route: "/admin/settings/delivery", keywords: "pengiriman kurir tarif batas pesan cutoff berangkat dispatch jarak maksimum" },
  { key: "integrations", category: "integrations", title: "Status Integrasi", description: "Status Midtrans dan layanan eksternal tanpa menampilkan kunci rahasia.", route: "/admin/settings/integrations", keywords: "midtrans integrasi" },
  { key: "system", category: "system", title: "Kontak Pengelola", description: "Nama dan nomor WhatsApp pengelola yang tampil di halaman Akun.", route: "/admin/settings/system", keywords: "sistem kontak pengelola whatsapp telepon bantuan" },
];
