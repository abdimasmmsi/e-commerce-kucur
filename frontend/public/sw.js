// Service worker ringan: aplikasi tetap terbuka cepat di sinyal lemah.
// File build (/assets) di-cache; halaman diambil dari jaringan dulu, cadangan dari cache. API tidak pernah di-cache.
const CACHE = "kucur-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/uploads")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put("/", copy)); return response; }).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; })));
  }
});

// Notifikasi push dari server (judul, isi, url). Klik membuka/memfokuskan aplikasi di halaman tujuan.
self.addEventListener("push", (event) => {
  let data;
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Kucur", { body: data.body || "", tag: data.tag, icon: "/pwa-192.png", badge: "/pwa-192.png", data: { url: data.url || "/" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.startsWith(self.location.origin));
    if (open) return open.focus().then((client) => (client && "navigate" in client ? client.navigate(target) : client));
    return self.clients.openWindow(target);
  }));
});
