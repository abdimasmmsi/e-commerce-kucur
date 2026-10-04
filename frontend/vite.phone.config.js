// Uji coba di HP asli lewat Wi-Fi yang sama: `npm run dev:phone`.
// HTTPS (sertifikat lokal) diperlukan agar browser HP mengizinkan GPS di checkout.
// API, foto upload, dan chat diteruskan ke backend sehingga HP cukup membuka satu alamat.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

const backend = globalThis.process?.env.PHONE_BACKEND_URL ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  // Panggil API di alamat yang sama dengan halaman (diteruskan oleh proxy di bawah).
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/") },
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/uploads": { target: backend, changeOrigin: true },
      "/health": { target: backend, changeOrigin: true },
      "/socket.io": { target: backend, changeOrigin: true, ws: true },
    },
  },
});
