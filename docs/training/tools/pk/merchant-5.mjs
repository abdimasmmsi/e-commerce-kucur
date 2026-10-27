// simpan produk contoh (nonaktif) lalu ubah, aktifkan, stok.
import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const S = "832ac337-9e6f-4640-847c-e4421fee2243";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "merchant.a@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "penjual", name, vk); await audit(p, `${name}-${vk}`); const e = p.errors.splice(0); if (e.length) console.log("  errors", name, vk, e); } };
const each = async (fn) => { for (const vk of ["m", "d"]) await fn(ctx[vk].page, vk); };
await go(m, `/merchant/stores/${S}/products/add`);
await m.getByLabel(/Nama Produk/).fill("Contoh Produk Pelatihan"); await m.getByLabel(/Kategori/).selectOption({ index: 1 }); await m.getByLabel(/Deskripsi/).fill("Produk contoh untuk panduan pelatihan.");
await m.locator("input[type=number]").first().fill("15000"); await m.locator("input[type=number]").last().fill("20");
await m.setInputFiles("input[type=file]", "D:/kucur-platform/docs/training/tools/pk/foto-contoh.png"); await m.waitForTimeout(1500);
await m.getByLabel(/Status Produk|Status/).last().selectOption({ label: "Tidak Aktif" });
await m.getByRole("button", { name: /^Simpan Produk$/ }).click(); await settle(m, 2000);
console.log("saved ->", m.url(), m.errors.splice(0));
await each((p) => go(p, `/merchant/stores/${S}/products`));
await snap("produk-tersimpan");
// edit produk
const link = m.getByRole("link", { name: /Edit produk/ });
const card = m.locator("article, li, div").filter({ hasText: "Contoh Produk Pelatihan" }).last();
await m.getByText("Contoh Produk Pelatihan").first().scrollIntoViewIfNeeded();
console.log("buttons", await m.getByRole("button", { name: /Aktifkan|Nonaktifkan/ }).allInnerTexts());
await b.close();
