import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "courier@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
m.on("response", async (r) => { if (r.request().method() !== "GET" && /\/api\//.test(r.url())) console.log("  >>", r.request().method(), new URL(r.url()).pathname, r.status()); });
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "kurir", name, vk); await audit(p, `${name}-${vk}`); } };
await go(m, "/courier"); await go(d, "/courier");
await m.getByRole("button", { name: /^Menu$/ }).click(); await m.waitForTimeout(500);
await shot(m, "kurir", "menu", "m"); await shot(d, "kurir", "menu", "d");
await go(m, "/courier/availability"); await go(d, "/courier/availability");
const fmt = (days) => { const x = new Date(Date.now() + days * 86400000); x.setMinutes(0); const pad = (n) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T08:00`; };
// kirim kosong dulu (validasi): tombol harus nonaktif atau muncul pesan
console.log("submit disabled?", await m.getByRole("button", { name: /Kirim pengajuan/ }).isDisabled());
await snap("cuti-form-kosong");
for (const p of [m, d]) { const dt = p.locator("input[type=datetime-local]"); await dt.nth(0).fill(fmt(20)); await dt.nth(1).fill(fmt(22)); await p.locator("textarea").fill("Acara keluarga di luar kota."); }
await snap("cuti-form-terisi");
await m.getByRole("button", { name: /Kirim pengajuan/ }).click(); await settle(m, 1500);
await go(d, "/courier/availability");
await snap("cuti-menunggu");
console.log("buttons", await m.getByRole("button").allInnerTexts());
// batalkan pengajuan supaya data admin tidak berantakan
await m.getByRole("button", { name: /Batalkan/ }).first().click().catch((e) => console.log("cancel", e.message.slice(0, 80))); await settle(m, 1200);
console.log(m.errors);
await b.close();
