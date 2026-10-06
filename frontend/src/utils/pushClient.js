import { apiData } from "../services/apiClient";

// Notifikasi push (muncul di HP walau aplikasi tertutup). Butuh HTTPS/localhost + service worker.
export const pushSupported = () => typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toKey = (base64) => {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

// Service worker didaftarkan di main.jsx saat produksi; di mode dev baru didaftarkan saat push dinyalakan.
async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js");
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ? existing.pushManager.getSubscription() : null;
}

// Hasil: "on" | "denied" | "unavailable" (kunci server belum diatur).
export async function enablePush() {
  const key = (await apiData("/api/settings/push-key"))?.publicKey;
  if (!key) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
  await apiData("/api/users/me/push-subscriptions", { method: "POST", body: subscription.toJSON() });
  return "on";
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await apiData("/api/users/me/push-subscriptions", { method: "DELETE", body: { endpoint: subscription.endpoint } }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
