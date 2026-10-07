import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Posisi scroll per halaman (disimpan per entri riwayat). Aturan:
// - pindah ke halaman lain (klik tautan/menu) → mulai dari atas;
// - tombol Kembali/Maju → kembali ke posisi terakhir halaman itu;
// - ganti filter/pencarian di halaman yang sama atau tautan jangkar (#) → posisi tidak diubah.
const STORAGE_KEY = "kucur:scroll-positions";
const MAX_ENTRIES = 80;
const read = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } };
const write = (value) => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* penyimpanan tidak tersedia */ } };

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef({ key: location.key, pathname: location.pathname });

  // Browser jangan memulihkan scroll sendiri (halaman dimuat lazy sehingga sering meleset).
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  // Catat posisi scroll halaman yang sedang tampil.
  useEffect(() => {
    let frame = 0;
    const save = () => {
      frame = 0;
      const all = read();
      all[location.key] = Math.round(window.scrollY);
      const keys = Object.keys(all);
      if (keys.length > MAX_ENTRIES) delete all[keys[0]];
      write(all);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(save); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, [location.key]);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { key: location.key, pathname: location.pathname };
    if (before.key === location.key || location.hash) return undefined;
    if (navigationType === "POP") {
      const target = read()[location.key];
      if (typeof target !== "number") return undefined;
      // Isi halaman bisa belum selesai dimuat: coba lagi sebentar sampai posisinya tercapai.
      let tries = 0; let timer = 0;
      const attempt = () => {
        window.scrollTo(0, target);
        if (Math.abs(window.scrollY - target) > 4 && tries < 20) { tries += 1; timer = window.setTimeout(attempt, 60); }
      };
      attempt();
      return () => window.clearTimeout(timer);
    }
    if (before.pathname !== location.pathname) window.scrollTo(0, 0);
    return undefined;
  }, [location, navigationType]);

  return null;
}
