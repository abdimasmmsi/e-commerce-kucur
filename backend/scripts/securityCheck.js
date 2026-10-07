// Pemeriksaan keamanan otomatis (bisa diulang sebelum demo/deploy). Backend harus hidup:
//   node scripts/securityCheck.js            (API default http://localhost:3000, DB e2e)
// Mencakup checklist: audit endpoint, admin route aman, IDOR, validasi input, kebocoran output, security headers.
// Aman untuk DB e2e: endpoint admin hanya di-GET dengan token admin; aksi tulis hanya dicoba oleh role yang HARUS ditolak.
const path = require("node:path");
const express = require("express");

// --- 1) Daftar seluruh endpoint: bungkus Router sebelum aplikasi dimuat ---
const proto = express.Router.prototype; // metode route/use ada di prototipe Router (Express 5)
const routeRecords = []; const mounts = [];
const originalRoute = proto.route; const originalUse = proto.use;
proto.route = function route(routePath) { const created = originalRoute.call(this, routePath); routeRecords.push({ router: this, path: routePath, route: created }); return created; };
proto.use = function use(...args) { if (typeof args[0] === "string" && args[1] && Array.isArray(args[1].stack)) mounts.push({ prefix: args[0], router: args[1] }); return originalUse.apply(this, args); };
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const { createApp } = require("../app");
createApp(); // hanya untuk membaca daftar route (tidak listen)
const endpoints = [];
for (const mount of mounts) for (const record of routeRecords.filter((item) => item.router === mount.router)) {
  const full = (mount.prefix + (record.path === "/" ? "" : String(record.path))).replace(/\/+/g, "/");
  for (const method of Object.keys(record.route.methods)) if (record.route.methods[method]) endpoints.push({ method: method.toUpperCase(), path: full });
}
const unique = [...new Map(endpoints.map((e) => [`${e.method} ${e.path}`, e])).values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

if (unique.length < 20) { console.error(`Daftar endpoint hanya ${unique.length}: pemeriksaan tidak valid.`); process.exit(2); }
const API = process.env.CHECK_API || "http://localhost:3000";
const DUMMY = "00000000-0000-4000-8000-0000000000aa";
const fill = (route) => route.replace(/:[A-Za-z]+/g, DUMMY);
const PUBLIC_OK = [/^GET \/$/, /^GET \/api\/products(\/.*)?$/, /^POST \/api\/products\/:productId\/view$/, /^GET \/api\/stores\/:[a-zA-Z]+\/(public|reviews)$/, /^GET \/api\/settings\/(faq|push-key)$/, /^GET \/api\/payments\/providers$/, /^(GET|POST) \/api\/auth\/(email-status|login|register|refresh)$/, /^GET \/api\/products\/:productId\/reviews$/, /^GET \/api\/reviews\/.*$/];
const isPublicAllowed = (e) => PUBLIC_OK.some((re) => re.test(`${e.method} ${e.path}`));

async function http(method, url, token, body, headers = {}) {
  const init = { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  try { const response = await fetch(url, init); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch { /* bukan JSON */ } return { status: response.status, json, text, headers: response.headers }; }
  catch (error) { return { status: 0, json: null, text: String(error), headers: new Headers() }; }
}
const login = async (email) => { const r = await http("POST", `${API}/api/auth/login`, null, { email, password: "KucurDev123!" }); const token = r.json?.data?.token ?? r.json?.token; if (!token) throw new Error(`login ${email} gagal: ${r.status}`); return token; };

let failures = 0; let warnings = 0;
const pass = (text) => console.log(`  LOLOS   ${text}`);
const fail = (text) => { failures += 1; console.log(`  GAGAL   ${text}`); };
const warn = (text) => { warnings += 1; console.log(`  CEK     ${text}`); };
const section = (title) => console.log(`\n== ${title}`);

(async () => {
  const roles = { customer: await login("customer@kucur.test"), merchant: await login("merchant.a@kucur.test"), courier: await login("courier@kucur.test"), admin: await login("admin@kucur.test") };
  console.log(`API ${API} — ${unique.length} endpoint terdeteksi`);

  // --- 8 & 10: audit endpoint + admin route aman ---
  section("Audit endpoint & batas peran (poin 8 dan 10)");
  const skip = (e) => e.path.startsWith("/api/auth/");
  const anonymousOpen = []; const boundary = [];
  for (const endpoint of unique.filter((e) => !skip(e))) {
    const url = API + fill(endpoint.path); const body = endpoint.method === "GET" ? undefined : {};
    const anon = await http(endpoint.method, url, null, body);
    if (anon.status !== 401 && !isPublicAllowed(endpoint)) anonymousOpen.push(`${endpoint.method} ${endpoint.path} → ${anon.status}`);
    const wanted = endpoint.path.startsWith("/api/admin/") ? ["admin"] : endpoint.path.startsWith("/api/courier/") ? ["courier", "admin"] : endpoint.path.startsWith("/api/merchant/") ? ["merchant", "admin"] : null;
    if (wanted) for (const [role, token] of Object.entries(roles)) {
      if (wanted.includes(role)) continue;
      const res = await http(endpoint.method, url, token, body);
      if (![401, 403].includes(res.status)) boundary.push(`${role} ${endpoint.method} ${endpoint.path} → ${res.status}`);
    }
  }
  anonymousOpen.length ? anonymousOpen.forEach((line) => warn(`tanpa login terbuka (pastikan memang publik): ${line}`)) : pass("semua endpoint non-publik menolak pengguna tanpa login (401)");
  boundary.length ? boundary.forEach((line) => fail(`peran salah bisa masuk: ${line}`)) : pass("endpoint /admin, /courier, /merchant menolak peran yang tidak berhak (401/403)");

  // --- 19: security headers ---
  section("Security headers (poin 19)");
  const root = await http("GET", `${API}/`);
  const need = { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'none'" };
  for (const [name, expected] of Object.entries(need)) (root.headers.get(name) || "").includes(expected) ? pass(`${name}: ${root.headers.get(name)}`) : fail(`header ${name} tidak ada`);
  root.headers.get("x-powered-by") ? fail("x-powered-by masih terkirim (membocorkan Express)") : pass("x-powered-by dimatikan");

  // --- 6: validasi input ---
  section("Validasi input (poin 6): harus 4xx, tidak boleh 5xx");
  const bad = [["JSON rusak", "{bad json"], ["array sebagai objek", []], ["string sangat panjang", { email: "a".repeat(300000) }], ["prototype pollution", JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}}}')], ["tipe salah", { email: { $ne: "" }, password: { $gt: "" } }], ["angka negatif/NaN", { quantity: -5, price: "abc", tip: -1e9 }]];
  const targets = [["POST", "/api/auth/login", null], ["POST", "/api/auth/register", null], ["POST", "/api/cart/items", roles.customer], ["POST", "/api/checkout/preview", roles.customer], ["PATCH", "/api/users/me", roles.customer], ["POST", "/api/stores", roles.merchant]];
  let serverErrors = 0;
  for (const [method, route, token] of targets) for (const [label, payload] of bad) {
    const res = await http(method, API + route, token, payload);
    if (res.status >= 500 || res.status === 0) { serverErrors += 1; fail(`${method} ${route} (${label}) → ${res.status}`); }
  }
  if (!serverErrors) pass(`${targets.length * bad.length} kiriman aneh ke ${targets.length} endpoint tidak ada yang membuat server error 5xx`);
  const big = await http("POST", `${API}/api/auth/login`, null, JSON.stringify({ email: "x@y.z", password: "p".repeat(2_000_000) }));
  [400, 413].includes(big.status) ? pass(`body 2 MB ditolak (${big.status})`) : fail(`body 2 MB tidak ditolak (${big.status})`);
  const mass = await http("PATCH", `${API}/api/users/me`, roles.customer, { fullName: "Uji", email: "customer@kucur.test", phone: "08100000002", roles: ["admin"], status: "active" });
  mass.status === 400 ? pass("mass assignment (roles/status via profil) ditolak 400") : fail(`mass assignment tidak ditolak (${mass.status})`);

  // --- 7: validasi output ---
  section("Validasi output (poin 7): tidak ada field rahasia di respons");
  const leakKeys = /passwordHash|"secret|privateKey|pushSubscriptions|sessionToken|refreshToken/i;
  const getRoutes = unique.filter((e) => e.method === "GET" && !skip(e) && !e.path.includes(":")); let leaked = 0; let scanned = 0;
  for (const endpoint of getRoutes) for (const [role, token] of Object.entries(roles)) {
    const res = await http("GET", API + endpoint.path, token); scanned += 1;
    if (leakKeys.test(res.text)) { leaked += 1; fail(`${role} GET ${endpoint.path} memuat field rahasia`); }
  }
  const me = await http("GET", `${API}/api/auth/me`, roles.customer); scanned += 1;
  if (leakKeys.test(me.text)) { leaked += 1; fail("/api/auth/me memuat field rahasia"); }
  if (!leaked) pass(`${scanned} respons (semua GET tanpa parameter x 4 peran + /me) bersih dari passwordHash/token/kunci push`);

  // --- 14: IDOR ---
  section("IDOR (poin 14): pengguna lain tidak boleh menyentuh data milik orang lain");
  const owner = roles.customer;
  const orders = (await http("GET", `${API}/api/orders`, owner)).json?.data; const orderId = (orders?.items ?? orders ?? [])[0]?.id;
  const stranger = await (async () => { // pembeli lain (baru)
    const email = "orang.asing@kucur.test"; // akun tetap, dipakai ulang
    const address = { label: "Rumah", recipientName: "Asing", phone: "081200000001", address: "Jl. Asing 1", latitude: -7.96, longitude: 112.54 };
    const registered = await http("POST", `${API}/api/auth/register`, null, { fullName: "Orang Asing", email, phone: "081200000001", password: "KucurTest123!", confirmPassword: "KucurTest123!", address });
    if (registered.status >= 300 && registered.status !== 409) return null;
    const session = await http("POST", `${API}/api/auth/login`, null, { email, password: "KucurTest123!" }); return session.json?.data?.token ?? session.json?.token;
  })();
  if (!stranger || !orderId) warn("data uji tidak lengkap (pembeli asing/pesanan), IDOR pesanan dilewati");
  else {
    const attempts = [["GET", `/api/orders/${orderId}`, undefined], ["POST", `/api/orders/${orderId}/cancel`, { reason: "iseng" }], ["PATCH", `/api/orders/${orderId}/fulfillment`, { status: "confirmed" }], ["POST", `/api/reviews`, { orderId, rating: 1 }]];
    for (const [method, route, body] of attempts) { const res = await http(method, API + route, stranger, body); [401, 403, 404].includes(res.status) ? pass(`pembeli lain ${method} ${route.replace(orderId, ":id")} → ${res.status}`) : (res.status >= 400 ? warn(`pembeli lain ${method} ${route.replace(orderId, ":id")} → ${res.status} (ditolak, tapi bukan 403/404)`) : fail(`pembeli lain BERHASIL ${method} ${route.replace(orderId, ":id")} (${res.status})`)); }
    const conversations = (await http("GET", `${API}/api/conversations`, owner)).json?.data; const conversationId = (conversations?.items ?? conversations ?? [])[0]?.id;
    if (conversationId) for (const [method, route, body] of [["GET", `/api/conversations/${conversationId}/messages`], ["POST", `/api/conversations/${conversationId}/messages`, { message: "intrusi" }]]) { const res = await http(method, API + route, stranger, body); [401, 403, 404].includes(res.status) ? pass(`pembeli lain ${method} percakapan orang → ${res.status}`) : fail(`pembeli lain tembus ${method} percakapan (${res.status})`); }
    const notifications = (await http("GET", `${API}/api/notifications`, owner)).json?.data; const notificationId = (notifications?.items ?? notifications ?? [])[0]?.id;
    if (notificationId) { const res = await http("PATCH", `${API}/api/notifications/${notificationId}/read`, stranger, {}); [403, 404].includes(res.status) ? pass(`pembeli lain tandai notifikasi orang → ${res.status}`) : fail(`pembeli lain bisa menandai notifikasi orang (${res.status})`); }
    const stores = (await http("GET", `${API}/api/stores`, roles.merchant)).json?.data; const storeId = (stores?.items ?? stores ?? [])[0]?.id;
    if (storeId) for (const [method, route] of [["GET", `/api/stores/${storeId}/finance`], ["GET", `/api/stores/${storeId}/orders`]]) { const res = await http(method, API + route, stranger); [401, 403, 404].includes(res.status) ? pass(`pembeli ${method} ${route.replace(storeId, ":storeId")} → ${res.status}`) : fail(`pembeli tembus ${method} ${route.replace(storeId, ":storeId")} (${res.status})`); }
  }

  console.log(`\nRingkasan: ${failures} GAGAL, ${warnings} perlu dicek manual`);
  process.exit(failures ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
