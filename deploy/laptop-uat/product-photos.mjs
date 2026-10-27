// Foto contoh sederhana untuk produk lapak contoh UAT (gambar dibuat dari emoji + nama produk, bukan foto asli).
//   node deploy/laptop-uat/product-photos.mjs [http://localhost:8080]
// Masuk sebagai pemilik tiap lapak contoh (kata sandi dari deploy/.env.production), unggah gambar lewat API,
// lalu pasang sebagai foto utama produk. Aman dijalankan ulang (menimpa foto produk contoh). Setelah itu simpan ulang
// baseline: snapshot-uat.ps1 (foto berupa file di folder uploads dan tidak ikut dump database).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("D:/kucur-platform/frontend/package.json");
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] ?? "http://localhost:8080";
const env = Object.fromEntries(fs.readFileSync("D:/kucur-platform/deploy/.env.production", "utf8").split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => [line.split("=")[0], line.slice(line.indexOf("=") + 1).trim()]));
const PASSWORD = env.UAT_SAMPLE_PASSWORD;
if (!PASSWORD) throw new Error("UAT_SAMPLE_PASSWORD tidak ada di deploy/.env.production (jalankan seed-uat.ps1 dulu).");

const OWNERS = ["lapak.keripik@kucur.example", "lapak.kopi@kucur.example", "lapak.bambu@kucur.example"];
// nama produk -> [emoji, warna latar atas, warna latar bawah]
const LOOKS = [
  [/pisang/i, "🍌", "#fff3c4", "#f6d365"], [/singkong/i, "🌶️", "#ffe0d6", "#f4a58a"], [/tempe/i, "🍟", "#f3e6c8", "#d9b97a"],
  [/rengginang/i, "🍘", "#fde9d0", "#eab676"], [/gula aren/i, "🟫", "#efe1d2", "#b98a5e"], [/madu/i, "🍯", "#fff0c2", "#f0b429"],
  [/biji|sangrai/i, "🫘", "#e9ddd3", "#9c6b4a"], [/kopi/i, "☕", "#efe3d8", "#a9775a"], [/besek/i, "🧺", "#f0e6cf", "#c9a96b"],
  [/lampu/i, "💡", "#fff6d6", "#f2c94c"], [/tampah/i, "🌾", "#f1ead2", "#c8b26a"],
];
const look = (name) => LOOKS.find(([pattern]) => pattern.test(name)) ?? [null, "🛍️", "#e8f1ea", "#9bc4a5"];

const html = (name, emoji, top, bottom) => `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="width:800px;height:800px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:linear-gradient(160deg,${top},${bottom});font-family:'Segoe UI','Plus Jakarta Sans',Arial,sans-serif">
<div style="font-size:300px;line-height:1;filter:drop-shadow(0 14px 18px #0003)">${emoji}</div>
<div style="max-width:660px;text-align:center;font-size:46px;font-weight:800;color:#1f2d24;line-height:1.2">${name}</div>
<div style="font-size:22px;color:#1f2d24b0;font-weight:600">Foto contoh</div></div>`;

const api = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json.data ?? json;
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
let done = 0;
for (const email of OWNERS) {
  const session = await api("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  const token = session.token ?? session.session?.token ?? session.accessToken;
  const stores = await api("/api/stores", { token });
  const mine = (Array.isArray(stores) ? stores : stores.items ?? []).filter((store) => store.merchantUserId === (session.user?.id ?? store.merchantUserId));
  for (const store of mine) {
    const products = await api(`/api/products?storeId=${store.id}&includeInactive=true`, { token }).catch(() => api("/api/products", { token }));
    for (const product of (Array.isArray(products) ? products : products.items ?? []).filter((item) => item.storeId === store.id)) {
      const [, emoji, top, bottom] = look(product.name);
      await page.setContent(html(product.name, emoji, top, bottom));
      const png = await page.screenshot({ type: "png" });
      const uploaded = await api("/api/stores/images", { method: "POST", token, body: { dataUrl: `data:image/png;base64,${png.toString("base64")}` } });
      await api(`/api/products/${product.id}`, { method: "PATCH", token, body: { images: [{ url: uploaded.path ?? uploaded.url, isPrimary: true }] } });
      done += 1;
      console.log("foto dipasang:", product.name);
    }
  }
}
await browser.close();
console.log(`Selesai: ${done} produk diberi foto contoh.`);
