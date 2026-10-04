// Kode pesanan pendek untuk tampilan (4 karakter terakhir), mis. KUC-DC221C7BAD614FFF -> #4FFF.
// Kode lengkap tetap ditampilkan di halaman detail.
export const shortOrderCode = (code) => {
  const clean = String(code ?? "").replace(/[^a-z0-9]/gi, "");
  return clean ? `#${clean.slice(-4).toUpperCase()}` : "";
};

// Ganti kode pesanan panjang di teks bebas (mis. isi notifikasi) dengan kode pendek.
export const shortenOrderCodes = (text) => String(text ?? "").replace(/#?KUC-[A-Z0-9]{8,}/gi, (code) => shortOrderCode(code));
