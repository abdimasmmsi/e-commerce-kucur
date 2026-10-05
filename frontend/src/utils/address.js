// Helper alamat pengiriman customer (dipakai form daftar, Alamat Saya, dan checkout).
export const emptyAddress = (defaults = {}) => ({ label: "", recipientName: "", phone: "", address: "", latitude: null, longitude: null, ...defaults });

// Cek di sisi klien sebelum dikirim; backend tetap memvalidasi ulang.
export function addressProblem(address, language) {
  const id = language === "id";
  if (!address.label?.trim()) return id ? "Isi label alamat, misalnya Rumah." : "Enter an address label, for example Home.";
  if (!address.recipientName?.trim()) return id ? "Isi nama penerima." : "Enter the recipient name.";
  if (!/^\+?[0-9][0-9\s-]{7,19}$/.test(address.phone?.trim() ?? "")) return id ? "Isi nomor HP penerima yang valid." : "Enter a valid recipient phone number.";
  if (!address.address?.trim()) return id ? "Isi alamat lengkap." : "Enter the full address.";
  if (!Number.isFinite(Number(address.latitude)) || !Number.isFinite(Number(address.longitude)) || address.latitude === null || address.longitude === null) return id ? "Tandai titik alamat di peta atau tekan Gunakan lokasi saya." : "Mark the address on the map or press Use my location.";
  return "";
}

// Draf checkout (alamat terpilih, tip, metode bayar) disimpan sebentar saat pembeli pindah ke Alamat Saya,
// supaya kembali ke checkout tanpa kehilangan pilihan. Barang tetap aman di keranjang/URL.
const CHECKOUT_DRAFT_KEY = "kucur.checkoutDraft";
export function saveCheckoutDraft(changes) {
  try { sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ ...readCheckoutDraft(), ...changes, savedAt: Date.now() })); } catch { /* penyimpanan tidak tersedia */ }
}
export function readCheckoutDraft() {
  try { return JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY) ?? "null") ?? {}; } catch { return {}; }
}
export function clearCheckoutDraft() {
  try { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); } catch { /* abaikan */ }
}
