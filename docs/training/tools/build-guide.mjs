// Menyusun docs/training/panduan-pelatihan-kucur.html + .pdf dari sections/*.html
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("D:/kucur-platform/frontend/package.json");
const { chromium } = require("@playwright/test");
const ROOT = "D:/kucur-platform/docs/training";
const files = (await fs.readdir(`${ROOT}/sections`)).filter((f) => f.endsWith(".html")).sort();
const sections = [];
for (const f of files) sections.push(await fs.readFile(`${ROOT}/sections/${f}`, "utf8"));
const body = sections.join("\n");
const toc = [...body.matchAll(/<section class="role" id="([^"]+)"[^>]*>\s*<h2>([\s\S]*?)<\/h2>/g)].map((m) => `<li><a href="#${m[1]}">${m[2].replace(/<[^>]+>/g, "")}</a></li>`).join("");
const missing = [...body.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const absent = [];
for (const s of missing) { try { await fs.access(`${ROOT}/${s}`); } catch { absent.push(s); } }
if (absent.length) console.log("GAMBAR HILANG:", absent);
const today = "27 Oktober 2026";
const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Panduan Pelatihan Kucur Local Market</title><link rel="stylesheet" href="guide.css"></head><body>
<div class="cover"><p class="lead">Desa Wisata Kucur</p><h1>Panduan Pelatihan<br>Kucur Local Market</h1>
<p class="lead">Untuk pengunjung, pembeli, penjual, kurir, dan admin. Setiap langkah disertai tampilan di laptop dan di HP.</p>
<p class="lead">Versi ${today}</p></div>
<section class="role" id="cara-pakai"><h2>Cara memakai panduan ini</h2>
<p>Pilih bagian sesuai peran Anda. Setiap langkah punya dua gambar: kiri tampilan di laptop, kanan tampilan di HP. Isi dan urutannya sama; di HP beberapa tombol pindah ke menu bawah atau menu titik tiga.</p>
<ul class="toc">${toc}</ul>
<div class="tip">Satu akun bisa memiliki beberapa peran (pembeli sekaligus penjual, misalnya). Pindah peran lewat halaman Akun.</div>
<div class="warn">Halaman Masuk di server percobaan menampilkan kotak akun contoh. Kotak itu hanya ada di server percobaan dan tidak ada di server yang sebenarnya.</div></section>
${body}
</body></html>`;
await fs.writeFile(`${ROOT}/panduan-pelatihan-kucur.html`, html);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto(`file:///${ROOT}/panduan-pelatihan-kucur.html`, { waitUntil: "load" });
await page.waitForFunction(() => [...document.images].every((i) => i.complete));
await page.pdf({ path: `${ROOT}/panduan-pelatihan-kucur.pdf`, format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#666">Panduan Pelatihan Kucur Local Market — <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } });
await browser.close();
const st = await fs.stat(`${ROOT}/panduan-pelatihan-kucur.pdf`);
console.log("PDF", (st.size / 1048576).toFixed(1), "MB");
