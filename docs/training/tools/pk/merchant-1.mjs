// Penjual bagian 1: halaman baca-saja, HP + laptop. Simpan ke shots/penjual/.
import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const S = "832ac337-9e6f-4640-847c-e4421fee2243";
const b = await openBrowser();
const ctx = {};
for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "merchant.a@kucur.test");
async function both(name, route, prep) {
  for (const vk of ["m", "d"]) {
    const page = ctx[vk].page;
    if (route) await go(page, route);
    if (prep) await prep(page, vk);
    await settle(page, 500);
    await shot(page, "penjual", name, vk);
    await audit(page, `${name}-${vk}`);
  }
  for (const vk of ["m", "d"]) { const e = ctx[vk].page.errors.splice(0); if (e.length) console.log("  errors", name, vk, e); }
}
await both("beranda", "/merchant");
await both("lapak-saya", "/merchant/stores");
await both("detail-lapak", `/merchant/stores/${S}`);
await both("buat-lapak", "/merchant/stores/new");
await both("keuangan-lapak", `/merchant/stores/${S}/finance`);
await both("produk", `/merchant/stores/${S}/products`);
await both("stok", `/merchant/stores/${S}/stock`);
await both("pesanan", `/merchant/stores/${S}/orders`);
await both("ambil-barang", "/merchant/pickup");
await both("ulasan", "/merchant/reviews");
await both("iuran-sukarela", "/merchant/finance");
await both("pesan", "/messages");
await both("profil", "/profile");
await b.close();
