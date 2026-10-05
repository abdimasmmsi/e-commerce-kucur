// Hitung permintaan API yang sedang berjalan, dipakai bar loading tipis di atas layar saat pindah halaman.
let pending = 0;
export const requestStarted = () => { pending += 1; };
export const requestFinished = () => { pending = Math.max(0, pending - 1); };
export const pendingRequests = () => pending;
