// Uji beban ringan: waktu respons (p50/p95/p99) dan ukuran data per endpoint saat banyak permintaan serentak.
//   node scripts/loadCheck.js            (API default http://localhost:3001 = backend demo, data lebih realistis)
//   CHECK_API=http://localhost:3000 CONCURRENCY=40 REQUESTS=300 node scripts/loadCheck.js
// Hanya membaca (GET). Pengecualian rate limit untuk loopback membuat uji lokal tidak terblokir.
const API = process.env.CHECK_API || "http://localhost:3001";
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const REQUESTS = Number(process.env.REQUESTS || 200);
const SLOW_P95_MS = Number(process.env.SLOW_P95_MS || 600);
const BIG_BYTES = Number(process.env.BIG_BYTES || 300 * 1024);

const call = async (path, token) => {
  const started = performance.now();
  const response = await fetch(API + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const buffer = await response.arrayBuffer();
  return { status: response.status, ms: performance.now() - started, bytes: buffer.byteLength, gzip: response.headers.get("content-encoding") };
};
const login = async (email) => { const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "KucurDev123!" }) }); const j = await r.json(); return j.data?.token ?? j.token; };
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function measure(label, path, token) {
  const times = []; let errors = 0; let bytes = 0; let next = 0;
  const worker = async () => { while (next < REQUESTS) { next += 1; const r = await call(path, token).catch(() => ({ status: 0, ms: 0, bytes: 0 })); if (r.status >= 400 || r.status === 0) errors += 1; else { times.push(r.ms); bytes = r.bytes; } } };
  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - started) / 1000;
  times.sort((a, b) => a - b);
  const row = { label, p50: percentile(times, 50) || 0, p95: percentile(times, 95) || 0, p99: percentile(times, 99) || 0, rps: times.length / seconds, kb: bytes / 1024, errors };
  const flags = [row.p95 > SLOW_P95_MS ? "LAMBAT" : "", bytes > BIG_BYTES ? "DATA BESAR" : "", errors ? `${errors} error` : ""].filter(Boolean).join(", ");
  console.log(`${label.padEnd(34)} p50 ${row.p50.toFixed(0).padStart(4)}ms  p95 ${row.p95.toFixed(0).padStart(4)}ms  p99 ${row.p99.toFixed(0).padStart(4)}ms  ${row.rps.toFixed(0).padStart(4)} req/s  ${row.kb.toFixed(1).padStart(7)} KB  ${flags}`);
  return { ...row, flags };
}

(async () => {
  const tokens = { customer: await login("customer@kucur.test"), merchant: await login("merchant.a@kucur.test"), courier: await login("courier@kucur.test"), admin: await login("admin@kucur.test") };
  const orders = (await (await fetch(`${API}/api/orders`, { headers: { authorization: `Bearer ${tokens.customer}` } })).json()).data;
  const orderId = (orders?.items ?? orders ?? [])[0]?.id;
  const products = (await (await fetch(`${API}/api/products`)).json()).data; const productId = (products?.items ?? products ?? [])[0]?.id;
  console.log(`API ${API}, ${CONCURRENCY} serentak x ${REQUESTS} permintaan per endpoint\n`);
  const targets = [
    ["Katalog produk (publik)", "/api/products", null],
    ["Detail produk", `/api/products/${productId}`, null],
    ["Pesanan saya (pembeli)", "/api/orders", tokens.customer],
    ["Detail pesanan", `/api/orders/${orderId}`, tokens.customer],
    ["Keranjang", "/api/cart", tokens.customer],
    ["Notifikasi", "/api/notifications", tokens.customer],
    ["Jumlah notifikasi belum dibaca", "/api/notifications/unread-count", tokens.customer],
    ["Percakapan", "/api/conversations", tokens.customer],
    ["Pesanan semua (admin)", "/api/orders?scope=admin", tokens.admin],
    ["Keuangan admin", "/api/admin/finance", tokens.admin],
    ["Draf jadwal pengiriman (admin)", "/api/admin/delivery/drafts", tokens.admin],
    ["Pengguna (admin)", "/api/users", tokens.admin],
    ["Pengaturan platform", "/api/settings", tokens.admin],
  ];
  const results = [];
  for (const [label, path, token] of targets) results.push(await measure(label, path, token));
  const bad = results.filter((row) => row.flags);
  console.log(bad.length ? `\n${bad.length} endpoint perlu perhatian: ${bad.map((row) => `${row.label} [${row.flags}]`).join("; ")}` : "\nSemua endpoint cepat dan ringan pada beban ini.");
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
