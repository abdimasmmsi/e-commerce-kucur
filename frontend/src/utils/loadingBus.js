// Hitung permintaan API yang sedang berjalan: dipakai bar loading tipis saat pindah halaman
// dan spinner otomatis pada tombol yang memicu permintaan (utils/actionBusy.js).
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener(pending));
export const requestStarted = () => { pending += 1; emit(); };
export const requestFinished = () => { pending = Math.max(0, pending - 1); emit(); };
export const pendingRequests = () => pending;
export const subscribePending = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
