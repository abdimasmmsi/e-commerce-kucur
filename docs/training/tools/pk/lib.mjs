// Pembantu Playwright untuk panduan Penjual & Kurir: login, dua viewport (HP & laptop), screenshot.
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("D:/kucur-platform/frontend/package.json");
export const { chromium } = require("@playwright/test");
export const BASE = process.env.BASE ?? "https://localhost:5175";
export const API = process.env.API ?? "http://localhost:3001";
export const ROOT = "D:/kucur-platform/docs/training";
export const PASSWORD = "KucurDev123!";
export const VP = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 },
};
export async function openBrowser() { return chromium.launch({ channel: "chrome", args: ["--ignore-certificate-errors"] }); }
export async function newCtx(browser, vk, email, extra = {}) {
  const context = await browser.newContext({ ...VP[vk], locale: "id-ID", ignoreHTTPSErrors: true, geolocation: { latitude: -7.9551, longitude: 112.5489 }, permissions: ["geolocation"], ...extra });
  await context.addInitScript(() => { try { sessionStorage.setItem("kucur:batch-reminder-snooze", String(Date.now() + 86400000)); } catch { /* */ } });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) page.errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password|Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: /Login|Masuk/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 });
  await page.locator("main").first().waitFor();
  return { context, page };
}
export async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
export async function go(page, route) { await page.goto(BASE + route, { waitUntil: "domcontentloaded" }); await page.locator("main").first().waitFor({ timeout: 15000 }).catch(() => {}); await settle(page); }
export async function shot(page, role, name, vk) {
  await fs.mkdir(`${ROOT}/shots/${role}`, { recursive: true });
  await page.screenshot({ path: `${ROOT}/shots/${role}/${name}-${vk}.png` });
}
export async function apiLogin(email) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  return (await r.json()).data.token;
}
export async function api(token, path, opt = {}) {
  const r = await fetch(`${API}/api${path}`, { method: opt.method ?? "GET", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, data: j?.data ?? j };
}

// Pemeriksaan cepat per layar: target sentuh kecil, enum mentah, overflow horizontal, tulisan campur Inggris umum.
export async function audit(page, label) {
  const r = await page.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const small = [];
    document.querySelectorAll("button, a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button], [role=tab]").forEach((el) => {
      if (!vis(el)) return; const b = el.getBoundingClientRect(); if (b.top > innerHeight * 8) return;
      if (el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline") return;
      if (el.closest(".leaflet-container")) return;
      if (Math.min(b.width, b.height) < 38) small.push(`${Math.round(b.width)}x${Math.round(b.height)} ${(el.getAttribute("aria-label") || el.innerText || el.placeholder || "").trim().slice(0, 30)}`);
    });
    const text = document.body.innerText;
    const raw = [...new Set(text.match(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g) ?? [])];
    const eng = [...new Set(text.match(/\b(Loading|Submit|Cancel|Save|Delete|Edit|Search|Order|Pending|Completed|Delivered|Dashboard|Customer|Merchant|Pickup|Batch|Cutoff|Settings|Undefined|undefined|NaN|null)\b/g) ?? [])];
    return { overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, small, raw, eng };
  });
  const flags = [];
  if (r.overflowX) flags.push("overflow-x"); if (r.small.length) flags.push("kecil:" + r.small.slice(0, 5).join("; ")); if (r.raw.length) flags.push("enum:" + r.raw.join(",")); if (r.eng.length) flags.push("inggris?:" + r.eng.join(","));
  console.log(`  [audit] ${label} ${flags.length ? "!! " + flags.join(" | ") : "ok"}`);
}
