// Alur Pengunjung + daftar akun baru, per viewport. node flow-visitor.mjs [m|d]
import fs from "node:fs/promises";
import { launch, ctx, BASE, ROOT, PASSWORD } from "./pb-lib.mjs";
const only = process.argv[2] ? [process.argv[2]] : ["m", "d"];
const OUT = `${ROOT}/shots/pengunjung`; await fs.mkdir(OUT, { recursive: true });
const b = await launch();
const log = (...a) => console.log(...a);
for (const vk of only) {
  const c = await ctx(b, vk); const p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 150)));
  p.on("response", (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  const snap = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${n}-${vk}.png` }); log("shot", n, vk); };
  const idle = () => p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await p.goto(`${BASE}/`); await idle(); await snap("01-beranda");
  await p.goto(`${BASE}/products`); await idle(); await snap("02-katalog");
  // cari
  const search = p.getByPlaceholder(/Cari nama, kategori, atau lapak/i).first();
  await search.fill("madu"); await p.waitForTimeout(1200); await idle(); await snap("03-cari-madu");
  // detail produk
  await p.goto(`${BASE}/products`); await idle();
  const href = await p.locator("a[href^='/products/']").first().getAttribute("href");
  await p.goto(`${BASE}${href}`); await idle(); await snap("04-detail-produk");
  // coba beli sebagai pengunjung
  const beli = p.getByRole("button", { name: /Beli Sekarang/i }).first();
  if (await beli.count()) { await beli.click(); await p.waitForTimeout(1500); log("beli-sebagai-pengunjung ->", p.url().replace(BASE, "")); await snap("05-wajib-masuk"); }
  // halaman lapak dari detail produk
  await p.goto(`${BASE}${href}`); await idle();
  const storeLink = p.locator("a[href^='/stores/']").first();
  log("tautan lapak di detail produk:", await storeLink.count(), (await storeLink.count()) ? await storeLink.innerText() : "-");
  if (await storeLink.count()) { await storeLink.scrollIntoViewIfNeeded(); await storeLink.click(); await p.waitForURL(/\/stores\//); await idle(); await snap("06-halaman-lapak"); }
  // masuk
  await p.goto(`${BASE}/login`); await idle(); await snap("07-masuk");
  // chatbot FAQ
  await p.goto(`${BASE}/`); await idle();
  const bot = p.getByRole("button", { name: /bantuan|FAQ|chatbot|asisten/i }).last();
  log("bot button:", await bot.count());
  if (await bot.count()) { await bot.click(); await p.waitForTimeout(900); await snap("08-chatbot-faq"); }
  log("errors", errs); await c.close();
}
await b.close();
