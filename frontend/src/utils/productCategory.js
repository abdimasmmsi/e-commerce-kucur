// Ikon & warna kategori ditebak dari nama kategori yang diisi merchant.
// Dipakai untuk tombol kategori di Beranda dan placeholder gambar produk tanpa foto.
const categoryStyles = [
  { match: /minum|kopi|susu|teh|jamu|yogurt/i, tint: "bg-amber-100 dark:bg-amber-950/60", path: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3" },
  { match: /tani|kebun|sayur|buah|jamur|madu|gula/i, tint: "bg-[var(--kucur-green-soft)]", path: "M5 19c0-8 5-14 15-15-1 10-7 15-15 15Zm0 0 8-8" },
  { match: /kerajinan|anyam|bambu|suvenir|craft/i, tint: "bg-sky-100 dark:bg-sky-950/60", path: "M3 10h18l-2 10H5L3 10Zm4 0 3-6m7 6-3-6M3 14h18M8 10v10m4-10v10m4-10v10" },
  { match: /makan|keripik|camilan|ringan|kue|snack/i, tint: "bg-orange-100 dark:bg-orange-950/60", path: "M6 3h12l-1 4 1 4-1 4 1 6H6l1-6-1-4 1-4-1-4Zm4 6.5c1.3-1 2.7-1 4 0M10 13c1.3 1 2.7 1 4 0" },
];
const fallbackCategory = { tint: "bg-[var(--kucur-surface-elevated)]", path: "M6 8.5h12l-1 10.5H7L6 8.5ZM9 9V7a3 3 0 0 1 6 0v2" };

export const categoryStyle = (name) => categoryStyles.find((style) => style.match.test(String(name ?? ""))) ?? fallbackCategory;
