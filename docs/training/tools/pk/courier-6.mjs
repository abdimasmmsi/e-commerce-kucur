import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const B = "/courier/batches/62dc5508-3fe8-4a53-8cfe-45dca435cd7a";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "courier@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
m.on("response", async (r) => { if (r.request().method() !== "GET" && /\/api\//.test(r.url())) { const t = await r.text().catch(() => ""); console.log("  >>", r.request().method(), new URL(r.url()).pathname, r.status(), r.status() >= 400 ? t.slice(0, 150) : ""); } });
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "kurir", name, vk); await audit(p, `${name}-${vk}`); } };
await go(m, B); await go(d, B);
// ambil ulang sebelum foto: scroll ke tombol Foto
for (const p of [m, d]) { await p.getByText(/Serahkan barang, tagih uang/).scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120)); }
await snap("sedang-diantar-foto");
for (const p of [m, d]) { await p.locator("input[type=file]").setInputFiles("D:/kucur-platform/docs/training/tools/pk/bukti-contoh.jpg"); await p.waitForTimeout(1500); await p.getByRole("button", { name: /Selesaikan dengan Bukti/ }).scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 250)); }
await snap("bukti-foto-dipilih");
await m.getByRole("button", { name: /Selesaikan dengan Bukti/ }).click(); await settle(m, 2500);
console.log("url", m.url(), m.errors.splice(0));
await go(m, B); await go(d, B);
await snap("batch-selesai");
await go(m, "/courier/history"); await go(d, "/courier/history"); await snap("riwayat-setelah");
await go(m, "/courier"); await go(d, "/courier"); await snap("beranda-setelah");
await b.close();
