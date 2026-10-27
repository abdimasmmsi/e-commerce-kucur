import { useEffect, useRef } from "react";

// Tampilan realtime: halaman memuat ulang datanya sendiri saat ada perubahan dari perangkat/pengguna lain.
// Sumber sinyal: event Socket.IO "data:changed" (lihat chatRealtimeService), tab kembali aktif, dan polling cadangan.
const listeners = new Set();
const POLL_MS = 45000;
const DEBOUNCE_MS = 300;
let timer = null;

export const notifyDataChanged = () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => listeners.forEach((listener) => listener()), DEBOUNCE_MS);
};

/**
 * Panggil `refresh` (fungsi pemuat data) tiap ada perubahan. `refresh` HARUS diam-diam: jangan menampilkan skeleton,
 * jangan menutup dialog atau mengosongkan isian form, dan abaikan galat sementara (data lama tetap tampil).
 * `enabled=false` menahan pembaruan (mis. saat sedang mengisi form yang akan terhapus bila data diganti).
 */
export function useLiveRefresh(refresh, { enabled = true } = {}) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; });
  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => { if (document.visibilityState === "visible") void Promise.resolve(latest.current?.()).catch(() => {}); };
    listeners.add(run);
    const poll = window.setInterval(run, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    return () => { listeners.delete(run); window.clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", run); };
  }, [enabled]);
}
