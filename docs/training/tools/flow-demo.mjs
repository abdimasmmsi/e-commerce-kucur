// Halaman akun Pembeli demo (customer@kucur.test): lacak, selesai, ulasan, alamat, notifikasi, pengaturan, ajukan penjual, chatbot.
import fs from "node:fs/promises";
import { launch, ctx, login, BASE, ROOT } from "./pb-lib.mjs";
const vk = process.argv[2] ?? "m";
const OUT = `${ROOT}/shots/pembeli`;
const b = await launch(); const c = await ctx(b, vk); const p = await c.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 150)));
p.on("response", (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
const snap = async (n) => { await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/${n}-${vk}.png` }); console.log("shot", n, vk); };
const idle = () => p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
await login(p, "customer@kucur.test");
await p.goto(`${BASE}/orders`); await idle(); await snap("20-pesanan-berjalan");
await p.getByRole("tab", { name: /^Selesai/ }).click(); await p.waitForTimeout(600); await snap("21-pesanan-selesai");
await p.goto(`${BASE}/orders`); await idle();
const href = await p.locator("a[href^='/orders/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
const ready = href.find((h) => h.includes("fba33642")); console.log("ready link", ready);
if (ready) { await p.goto(`${BASE}${ready}`); await idle(); await snap("22-lacak-status"); }
await p.goto(`${BASE}/orders/ad042e16-ac91-410b-8a91-9ab35ba21d9f`); await idle();
await p.getByText("Sudah diulas").first().scrollIntoViewIfNeeded(); await snap("23-pesanan-sudah-diulas");
await p.goto(`${BASE}/my-reviews`); await idle(); await snap("24-ulasan-saya");
await p.goto(`${BASE}/addresses`); await idle(); await snap("25-alamat-saya");
const add = p.getByRole("button", { name: /Tambah alamat/i }).first(); if (await add.count()) { await add.click(); await p.waitForTimeout(900); await snap("26-tambah-alamat"); }
await p.goto(`${BASE}/notifications`); await idle(); await snap("27-notifikasi");
await p.goto(`${BASE}/messages`); await idle(); await snap("28-pesan");
await p.goto(`${BASE}/profile`); await idle(); await snap("29-akun");
await p.goto(`${BASE}/settings`); await idle(); await snap("30-pengaturan");
await p.goto(`${BASE}/merchant/apply`); await idle(); await snap("31-ajukan-penjual");
await p.goto(`${BASE}/`); await idle();
await p.getByRole("button", { name: /Bantuan Kucur|bantuan|FAQ/i }).last().click(); await p.waitForTimeout(800);
await p.getByPlaceholder(/Tulis pertanyaan/).fill("bagaimana cara batal pesanan"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500); await snap("32-chatbot-batal");
console.log("errors", errs); await b.close();
