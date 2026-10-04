export const settingsCategories = [
  { key: "recent", title: "Recent", description: "Pengaturan yang terakhir dibuka." },
  { key: "merchant", title: "Merchant & Lapak", description: "Aktivasi lapak, iuran pokok, cicilan, dan keterlambatan." },
  { key: "finance", title: "Keuangan & Pajak", description: "Biaya admin platform, PPN, dan kontribusi Merchant." },
  { key: "payment", title: "Pembayaran", description: "Metode pembayaran dan kesiapan penyedia." },
  { key: "delivery", title: "Pengiriman", description: "Tarif, cutoff, dispatch, dan kapasitas pengiriman." },
  { key: "notifications", title: "Notifikasi", description: "Konfigurasi notifikasi global platform." },
  { key: "integrations", title: "Integrasi", description: "Status integrasi eksternal platform." },
  { key: "system", title: "Sistem", description: "Pengaturan global sistem yang tersedia." },
];

export const settingsCatalog = [
  { key: "initial-fee", category: "merchant", title: "Iuran Pokok Lapak", description: "Nominal pembukaan yang berlaku independen untuk setiap lapak.", route: "/admin/settings/merchant/initial-fee", keywords: "iuran biaya awal aktivasi" },
  { key: "installments", category: "merchant", title: "Skema Cicilan", description: "Pembayaran penuh, 3 bulan, atau 6 bulan.", route: "/admin/settings/merchant/installments", keywords: "cicilan bunga keterlambatan aktivasi" },
  { key: "admin-fee", category: "finance", title: "Biaya Admin Platform", description: "Kewajiban pemilik lapak berupa persentase atau nominal tetap.", route: "/admin/settings/finance/admin-fee", keywords: "biaya admin cutoff grace" },
  { key: "tax", category: "finance", title: "PPN", description: "Tarif PPN global untuk transaksi platform.", route: "/admin/settings/finance/tax", keywords: "pajak ppn" },
  { key: "contribution", category: "finance", title: "Iuran Sukarela", description: "Kontribusi opsional per Merchant User tanpa jatuh tempo.", route: "/admin/settings/finance/contribution", keywords: "iuran sukarela merchant" },
  { key: "payment-methods", category: "payment", title: "Metode Pembayaran", description: "COD operasional; Midtrans menunggu kredensial nyata.", route: "/admin/settings/payment", keywords: "cod midtrans pembayaran" },
  { key: "delivery", category: "delivery", title: "Operasional Pengiriman", description: "Tarif per km, cutoff, dispatch, dan kapasitas harian.", route: "/admin/settings/delivery", keywords: "pengiriman kurir tarif cutoff dispatch" },
  { key: "notifications", category: "notifications", title: "Notifikasi Global", description: "Belum ada pengaturan global yang tersedia.", route: "/admin/settings/notifications", keywords: "notifikasi" },
  { key: "lentera", category: "integrations", title: "SIG LENTERA", description: "Menunggu kontrak API resmi dan autentikasi.", route: "/admin/settings/integrations/lentera", keywords: "lentera sig api integrasi" },
  { key: "integrations", category: "integrations", title: "Status Integrasi", description: "Status Midtrans dan layanan eksternal tanpa menampilkan secret.", route: "/admin/settings/integrations", keywords: "midtrans integrasi" },
  { key: "system", category: "system", title: "Sistem", description: "Belum ada pengaturan sistem global tambahan.", route: "/admin/settings/system", keywords: "sistem" },
];
