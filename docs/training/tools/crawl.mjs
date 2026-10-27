// Audit + screenshot semua halaman tiap peran di HP (390x844) dan laptop (1366x800).
//   node docs/training/tools/crawl.mjs [role,...]   (server demo: https://localhost:5175)
// Hasil: docs/training/shots/<peran>/<nama>-<m|d>.png dan docs/training/audit/<peran>.json
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
const require = createRequire("D:/kucur-platform/frontend/package.json");
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE ?? "https://localhost:5175";
const ROOT = "D:/kucur-platform/docs/training";
const PASSWORD = "KucurDev123!";
const ACCOUNTS = { visitor: null, customer: "customer@kucur.test", merchant: "merchant.a@kucur.test", courier: "courier@kucur.test", admin: "admin@kucur.test" };
const VIEWPORTS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 },
};

// follow: regex href yang diikuti dari halaman daftar (untuk halaman detail)
const ROUTES = {
  visitor: [
    ["beranda", "/"], ["katalog", "/products"], ["detail-produk", "/products", { follow: /\/products\/[^/?#]+$/ }],
    ["halaman-lapak", "/products", { follow: /\/stores\/[^/?#]+$/, via: /\/products\/[^/?#]+$/ }],
    ["masuk", "/login"], ["daftar", "/register"], ["privasi", "/privacy"],
  ],
  customer: [
    ["beranda", "/"], ["katalog", "/products"], ["detail-produk", "/products", { follow: /\/products\/[^/?#]+$/ }],
    ["keranjang", "/cart"], ["pesanan", "/orders"], ["detail-pesanan", "/orders", { follow: /\/orders\/[^/?#]+$/ }],
    ["notifikasi", "/notifications"], ["ulasan-saya", "/my-reviews"], ["pesan", "/messages"], ["alamat", "/addresses"],
    ["profil", "/profile"], ["pengaturan", "/settings"], ["ajukan-lapak", "/merchant/apply"],
  ],
  merchant: [
    ["beranda", "/merchant"], ["lapak", "/merchant/stores"], ["detail-lapak", "/merchant/stores", { follow: /\/merchant\/stores\/[^/?#]+$/ }],
    ["buat-lapak", "/merchant/stores/new"], ["pesanan", "/merchant/orders"], ["ulasan", "/merchant/reviews"], ["keuangan", "/merchant/finance"],
    ["ambil-barang", "/merchant/pickup"], ["pesan", "/messages"], ["profil", "/profile"], ["pengaturan", "/settings"],
  ],
  courier: [
    ["beranda", "/courier"], ["penugasan", "/courier/assignments"], ["jadwal", "/courier/batches"], ["detail-jadwal", "/courier/batches", { follow: /\/courier\/batches\/[^/?#]+$/ }],
    ["pengantaran-aktif", "/courier/active-deliveries"], ["riwayat", "/courier/history"], ["cuti", "/courier/availability"], ["pengaturan", "/courier/settings"],
    ["pesan", "/messages"], ["profil", "/profile"],
  ],
  admin: [
    ["beranda", "/admin"], ["persetujuan-lapak", "/admin/merchant-approval"], ["detail-persetujuan", "/admin/merchant-approval", { follow: /\/admin\/merchant-approval\/[^/?#]+$/ }],
    ["pengguna", "/admin/users"], ["kurir", "/admin/couriers"], ["detail-kurir", "/admin/couriers", { follow: /\/admin\/couriers\/[^/?#]+$/ }],
    ["transaksi", "/admin/transactions"], ["produk", "/admin/products"], ["jadwal-pengiriman", "/admin/delivery-batches"],
    ["ulasan", "/admin/reviews"], ["keuangan", "/admin/finance"], ["detail-keuangan", "/admin/finance", { follow: /\/admin\/finance\/[^/?#]+$/ }],
    ["analitik", "/admin/analytics"], ["faq", "/admin/faq"], ["chat-bantuan", "/admin/support-chats"], ["notifikasi", "/admin/notifications"],
    ["pengaturan-platform", "/admin/settings"], ["profil", "/profile"],
  ],
};

const only = process.argv[2]?.split(",");
const roles = Object.keys(ROUTES).filter((r) => !only || only.includes(r));

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password|Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Login|Masuk/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20000 });
  await page.locator("main").first().waitFor();
  // Bahasa Indonesia + tema terang untuk akun ini (disimpan di akun, jadi hanya berubah bila belum).
  const html = page.locator("html");
  if ((await html.getAttribute("lang")) !== "id" || (await html.getAttribute("data-theme")) !== "light") {
    await page.goto(`${BASE}/settings`);
    const rows = page.locator(".account-preference-row");
    const change = async (trigger) => { await Promise.all([page.waitForResponse((r) => r.url().includes("/api/users/me/preferences") && r.request().method() === "PATCH"), trigger.click()]); await page.waitForTimeout(600); };
    if ((await html.getAttribute("lang")) !== "id") await change(rows.getByRole("button", { name: "ID", exact: true }));
    if ((await html.getAttribute("data-theme")) !== "light") await change(rows.getByRole("button", { name: /Mode terang|Light mode/i }));
  }
}

const probe = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"; };
  const sel = (el) => (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.name || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const doc = document.documentElement;
  const small = [];
  document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]").forEach((el) => {
    if (!vis(el)) return;
    if (el.tagName === "INPUT" && /checkbox|radio/.test(el.type) && el.closest("label")) return;
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight * 6) return;
    // tautan di dalam kalimat dikecualikan
    if (el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline") return;
    if (Math.min(r.width, r.height) < 36) small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${sel(el)}`);
  });
  const text = document.body.innerText;
  const raw = [...new Set(text.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g) ?? [])];
  const bad = [...new Set(text.match(/\b(undefined|NaN|\[object Object\]|null)\b/g) ?? [])];
  const imgs = [...document.images].filter((i) => vis(i) && i.complete && i.naturalWidth === 0).map((i) => i.currentSrc.slice(-60));
  const tiny = [...document.querySelectorAll("body *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(el) && parseFloat(getComputedStyle(el).fontSize) < 12).length;
  const overflowing = [...document.querySelectorAll("body *")].filter((el) => vis(el) && el.getBoundingClientRect().right > doc.clientWidth + 2 && !el.closest("[class*=overflow-x], table, pre, [data-scroll]") && getComputedStyle(el).position !== "fixed" && !(el.closest("div") && (() => { let p = el.parentElement; while (p) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; p = p.parentElement; } return false; })())).slice(0, 4).map((el) => `${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`);
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, small: small.slice(0, 12), smallCount: small.length, raw, bad, imgs, tiny, overflowing, title: document.title, h1: (document.querySelector("h1")?.innerText ?? "").slice(0, 60) };
};

const browser = await chromium.launch({ channel: "chrome", args: ["--ignore-certificate-errors"] });
for (const role of roles) {
  const report = {};
  for (const [vk, vp] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...vp, locale: "id-ID", ignoreHTTPSErrors: true, geolocation: { latitude: -7.9551, longitude: 112.5489 }, permissions: ["geolocation"] });
    await context.addInitScript(() => { try { sessionStorage.setItem("kucur:batch-reminder-snooze", String(Date.now() + 86400000)); } catch { /* */ } });
    const page = await context.newPage();
    let current = "login";
    const diag = {};
    const note = (k, v) => { (diag[current] ??= { console: [], api: [], page: [] })[k].push(v); };
    page.on("console", (m) => { if (m.type() === "error") note("console", m.text().slice(0, 200)); });
    page.on("pageerror", (e) => note("page", String(e.message).slice(0, 200)));
    page.on("response", (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) note("api", `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
    try { if (ACCOUNTS[role]) await login(page, ACCOUNTS[role]); } catch (e) { console.log(role, vk, "LOGIN GAGAL", e.message); await context.close(); continue; }
    await fs.mkdir(`${ROOT}/shots/${role}`, { recursive: true });
    for (const [name, route, opt] of ROUTES[role]) {
      current = name;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await page.locator("main, .page-container, form").first().waitFor({ timeout: 15000 }).catch(() => {});
        if (opt?.follow) {
          if (opt.via) {
            const first = await page.locator("a[href]").evaluateAll((as, src) => as.map((a) => a.getAttribute("href")).find((h) => new RegExp(src).test(h)), opt.via.source);
            if (first) { await page.goto(`${BASE}${first}`, { waitUntil: "domcontentloaded" }); }
          }
          await page.waitForTimeout(1200);
          const href = await page.locator("a[href]").evaluateAll((as, src) => as.map((a) => a.getAttribute("href")).find((h) => h && new RegExp(src).test(h)), opt.follow.source);
          if (!href) { report[`${name}-${vk}`] = { skipped: "tidak ada tautan detail" }; continue; }
          await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
          await page.locator("main, .page-container").first().waitFor({ timeout: 15000 }).catch(() => {});
        }
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(700);
        const result = await page.evaluate(probe);
        result.url = page.url().replace(BASE, "");
        result.overflowX = result.scrollWidth > result.clientWidth + 2;
        await page.screenshot({ path: `${ROOT}/shots/${role}/${name}-${vk}.png` });
        report[`${name}-${vk}`] = { ...result, diag: diag[name] };
      } catch (e) { report[`${name}-${vk}`] = { error: e.message.slice(0, 200) }; }
    }
    await context.close();
  }
  await fs.mkdir(`${ROOT}/audit`, { recursive: true });
  await fs.writeFile(`${ROOT}/audit/${role}.json`, JSON.stringify(report, null, 2));
  // ringkasan
  for (const [k, v] of Object.entries(report)) {
    const issues = [];
    if (v.error) issues.push(`ERROR ${v.error}`);
    if (v.skipped) issues.push(`SKIP ${v.skipped}`);
    if (v.overflowX) issues.push(`overflow-x ${v.scrollWidth}>${v.clientWidth}`);
    if (v.raw?.length) issues.push(`enum:${v.raw.join(",")}`);
    if (v.bad?.length) issues.push(`teks:${v.bad.join(",")}`);
    if (v.imgs?.length) issues.push(`gambar-rusak:${v.imgs.length}`);
    if (v.smallCount && k.endsWith("-m")) issues.push(`target-kecil:${v.smallCount}`);
    if (v.diag?.console?.length) issues.push(`console:${v.diag.console.length}`);
    if (v.diag?.api?.length) issues.push(`api:${[...new Set(v.diag.api)].join("|")}`);
    if (v.diag?.page?.length) issues.push(`pageerror:${v.diag.page.length}`);
    if (v.overflowing?.length) issues.push(`melebar:${v.overflowing.length}`);
    console.log(`${role}/${k} ${v.url ?? ""} ${issues.length ? "!! " + issues.join(" ; ") : "ok"}`);
  }
}
await browser.close();
