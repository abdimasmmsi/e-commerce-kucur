import { StrictMode } from "react";

// Tap ganda di HP memicu dua navigasi ke halaman yang sama, sehingga tombol Back harus ditekan dua kali.
// Navigasi ke URL yang sedang dibuka diganti (replace), bukan ditambah ke riwayat.
const nativePushState = window.history.pushState.bind(window.history);
window.history.pushState = (state, title, url) => {
  const target = url == null ? null : new URL(url, window.location.href);
  if (target && target.pathname === window.location.pathname && target.search === window.location.search && target.hash === window.location.hash) {
    window.history.replaceState(state, title, url);
    return;
  }
  nativePushState(state, title, url);
  markNavigation();
};
// Tap kedua dari tap ganda bisa jatuh ke tombol di halaman baru. Yang diabaikan hanya klik di titik yang sama
// dengan klik yang barusan memicu pindah halaman, dalam waktu singkat (pola tap ganda); klik lain tetap jalan.
let lastNavigationAt = 0;
let lastClick = { x: -1, y: -1, at: 0 };
let navigationClick = null;
function markNavigation() { lastNavigationAt = Date.now(); navigationClick = Date.now() - lastClick.at < 1000 ? lastClick : null; }
window.addEventListener("popstate", markNavigation);
// Begitu user mengetik/mengisi form, itu bukan tap ganda lagi.
document.addEventListener("input", () => { navigationClick = null; }, true);
document.addEventListener("click", (event) => {
  const now = Date.now();
  const sameSpot = navigationClick && Math.hypot(event.clientX - navigationClick.x, event.clientY - navigationClick.y) < 40;
  if (sameSpot && now - lastNavigationAt < 350 && event.target instanceof Element && event.target.closest("a, button, [role='button']")) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  lastClick = { x: event.clientX, y: event.clientY, at: now };
}, true);
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { StoreProvider } from "./context/StoreContext.jsx";
import { SystemSettingsProvider } from "./context/SystemSettingsContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import "./styles/global.css";
import "./styles/kucur-redesign.css";
import "./styles/design-system.css";
import "./styles/form-system.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PreferencesProvider>
    <AuthProvider>
      <SystemSettingsProvider>
        <StoreProvider>
          <NotificationProvider>
            <ChatProvider>
              <App />
            </ChatProvider>
          </NotificationProvider>
        </StoreProvider>
      </SystemSettingsProvider>
    </AuthProvider>
    </PreferencesProvider>
  </StrictMode>
);

// PWA: service worker hanya di build produksi supaya pengujian dev tidak tertahan cache lama.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}
