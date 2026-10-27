import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const S = "832ac337-9e6f-4640-847c-e4421fee2243";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "merchant.a@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "penjual", name, vk); await audit(p, `${name}-${vk}`); const e = p.errors.splice(0); if (e.length) console.log("  errors", name, vk, e); } };
const each = async (fn) => { for (const vk of ["m", "d"]) await fn(ctx[vk].page, vk); };
// Aktifkan / Nonaktifkan produk contoh
await each((p) => go(p, `/merchant/stores/${S}/products`));
await each(async (p) => { await p.getByText("Contoh Produk Pelatihan").first().scrollIntoViewIfNeeded(); });
await snap("produk-status-nonaktif");
await m.getByRole("button", { name: "Aktifkan", exact: true }).click(); await settle(m, 1000);
await go(d, `/merchant/stores/${S}/products`);
await each(async (p) => { await p.getByText("Contoh Produk Pelatihan").first().scrollIntoViewIfNeeded(); });
await snap("produk-status-aktif");
await m.getByRole("button", { name: "Nonaktifkan" }).last().click(); await settle(m, 1000);
// edit
await each(async (p) => { await go(p, `/merchant/stores/${S}/products`); });
const editHref = await m.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter((h) => /products\/.+\/edit/.test(h)));
console.log("edit hrefs", editHref);
const newEdit = editHref[editHref.length - 1];
await each((p) => go(p, newEdit));
await snap("produk-edit");
// stok
await each((p) => go(p, `/merchant/stores/${S}/stock`));
await each(async (p) => { await p.getByText("Contoh Produk Pelatihan").first().click(); await p.waitForTimeout(400); });
await snap("stok-pilih");
await m.locator("input[type=number]").first().fill("35");
await m.getByRole("button", { name: /Simpan/ }).last().click(); await settle(m, 1000); console.log("stok saved", m.errors.splice(0));
await shot(m, "penjual", "stok-tersimpan", "m");
await go(d, `/merchant/stores/${S}/stock`); await d.getByText("Contoh Produk Pelatihan").first().click(); await shot(d, "penjual", "stok-tersimpan", "d");
await b.close();
