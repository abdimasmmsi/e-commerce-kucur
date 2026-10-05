// Uji coba di HP asli lewat Wi-Fi yang sama: `npm run dev:phone`.
// HTTPS (sertifikat lokal) diperlukan agar browser HP mengizinkan GPS di checkout.
// API, foto upload, dan chat diteruskan ke backend sehingga HP cukup membuka satu alamat.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

const backend = globalThis.process?.env.PHONE_BACKEND_URL ?? "http://localhost:3001";

// Proxy yang sama dipakai mode dev (npm run dev:phone) dan mode build (npm run phone).
const proxy = {
  // Kirim IP HP asli ke backend (X-Forwarded-For) supaya batas percobaan login dihitung per perangkat.
  // Hanya header ini; X-Forwarded-Proto tidak dikirim agar URL foto upload tetap http.
  "/api": { target: backend, changeOrigin: true, configure: (server) => server.on("proxyReq", (proxyReq, req) => proxyReq.setHeader("X-Forwarded-For", req.socket.remoteAddress ?? "")) },
  "/uploads": { target: backend, changeOrigin: true },
  "/health": { target: backend, changeOrigin: true },
  "/socket.io": { target: backend, changeOrigin: true, ws: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  // Panggil API di alamat yang sama dengan halaman (diteruskan oleh proxy di bawah).
  // Mode HP/demo: akun demo tetap ditampilkan di halaman Masuk walaupun memakai build produksi.
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/"), "import.meta.env.VITE_SHOW_DEMO_ACCOUNTS": JSON.stringify("true") },
  // Mode build untuk HP: satu bundel terkompresi (jauh lebih cepat di Wi-Fi daripada mode dev) + service worker PWA.
  build: { outDir: "dist-phone" },
  server: { host: true, port: 5175, strictPort: true, proxy },
  preview: { host: true, port: 5175, strictPort: true, proxy },
});
