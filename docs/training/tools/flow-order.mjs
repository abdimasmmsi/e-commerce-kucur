// Lanjutan akun baru: daftar pesanan -> detail -> chat penjual -> batalkan.
import fs from "node:fs/promises";
import { launch, ctx, login, BASE, ROOT } from "./pb-lib.mjs";
const vk = process.argv[2] ?? "m";
const acc = JSON.parse(await fs.readFile(`${ROOT}/tools/.accounts.json`, "utf8"));
const OUT = `${ROOT}/shots/pembeli`;
const b = await launch(); const c = await ctx(b, vk); const p = await c.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 150)));
p.on("response", (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
const snap = async (n) => { await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/${n}-${vk}.png` }); console.log("shot", n, vk); };
const idle = () => p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
await login(p, acc[vk].email);
await p.goto(`${BASE}/orders`); await idle(); await snap("10-pesanan-saya");
await p.locator("a[href^='/orders/']").first().click(); await p.waitForURL(/\/orders\/./); await idle(); await snap("11-detail-pesanan-menunggu");
await p.getByRole("button", { name: /Chat penjual/i }).first().click(); await p.waitForTimeout(2500); console.log("chat url", p.url().replace(BASE, ""));
await snap("12-chat-penjual-kosong");
const box = p.locator("textarea, input[type=text]").last();
await box.fill("Halo Pak, kopinya bisa digiling halus ya?");
await snap("13-chat-ketik");
await p.getByRole("button", { name: /Kirim/i }).last().click(); await p.waitForTimeout(1500); await snap("14-chat-terkirim");
await p.goBack(); await idle();
if (!/orders/.test(p.url())) { await p.goto(`${BASE}/orders`); await idle(); await p.locator("a[href^='/orders/']").first().click(); await idle(); }
await p.getByRole("button", { name: /Batalkan pesanan/i }).first().click(); await p.waitForTimeout(900); await snap("15-batal-dialog");
await p.getByPlaceholder(/Jelaskan alasan/).fill("Salah memilih ukuran, mau pesan ulang.");
await snap("16-batal-alasan");
await p.getByRole("alertdialog").getByRole("button", { name: /Batalkan pesanan/ }).click(); await p.waitForTimeout(2500); await idle(); await snap("17-batal-selesai");
await p.goto(`${BASE}/orders`); await idle(); await p.getByRole("tab", { name: /Dibatalkan/ }).click().catch(()=>p.getByText("Dibatalkan").first().click()); await p.waitForTimeout(800); await snap("18-pesanan-dibatalkan");
console.log("errors", errs);
await b.close();
