import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const S = "832ac337-9e6f-4640-847c-e4421fee2243";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "merchant.a@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "penjual", name, vk); await audit(p, `${name}-${vk}`); const e = p.errors.splice(0); if (e.length) console.log("  errors", name, vk, e); } };
const each = async (fn) => { for (const vk of ["m", "d"]) await fn(ctx[vk].page, vk); };
// Ambil barang
await each((p) => go(p, "/merchant/pickup"));
// (ambil-barang-sebelum sudah diambil sebelum konfirmasi)
await each((p) => go(p, "/merchant/pickup"));
await snap("ambil-barang-sesudah");
// Chat
await each((p) => go(p, "/messages"));
await snap("pesan-daftar");
const conv = m.locator("a[href*='/messages/']").first();
console.log("conv count", await conv.count());
if (await conv.count()) {
  const href = await conv.getAttribute("href");
  await each((p) => go(p, href));
  await snap("pesan-percakapan");
  await m.getByRole("textbox").last().fill("Selamat siang Bu, masih ada. Silakan dipesan ya, besok pagi dikirim.");
  await m.getByRole("button", { name: /Kirim/ }).last().click(); await settle(m, 1000);
  await go(d, href); await shot(d, "penjual", "pesan-terkirim", "d"); await shot(m, "penjual", "pesan-terkirim", "m");
}
// Ulasan: dialog balas
await each((p) => go(p, "/merchant/reviews"));
await each(async (p) => { await p.getByRole("button", { name: /Edit balasan|Balas ulasan/ }).first().click(); await p.waitForTimeout(500); });
await snap("ulasan-balas");
await each(async (p) => { await p.keyboard.press("Escape"); });
// Sukarela
await each((p) => go(p, "/merchant/finance"));
await each(async (p) => { await p.getByRole("button", { name: /Rp 25.000/ }).first().click(); await p.waitForTimeout(300); });
await snap("iuran-sukarela-pilih");
// switcher
await each((p) => go(p, "/merchant"));
await m.getByRole("button", { name: /^Menu$/ }).click(); await m.waitForTimeout(500);
await shot(m, "penjual", "ganti-lapak", "m");
await shot(d, "penjual", "ganti-lapak", "d");
console.log("options", await d.locator("aside select option, select").first().locator("option").allInnerTexts());
// buat lapak validasi
await each((p) => go(p, "/merchant/stores/new"));
await m.getByRole("button", { name: /Ajukan Lapak/ }).click(); await m.waitForTimeout(500);
await d.getByRole("button", { name: /Ajukan Lapak/ }).click(); await d.waitForTimeout(500);
await snap("buat-lapak-validasi");
await each(async (p) => { await p.getByText(/Foto lapak/).first().scrollIntoViewIfNeeded(); });
await snap("buat-lapak-foto");
await each(async (p) => { await p.locator(".leaflet-container").first().scrollIntoViewIfNeeded().catch(() => {}); });
await snap("buat-lapak-peta");
await b.close();
