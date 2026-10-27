// Panduan Admin: menjalankan alur nyata di server demo dan memotret laptop (-d) + HP (-m).
//   node docs/training/tools/admin-guide.mjs [langkah,langkah]   (tanpa argumen = semua)
// Hasil: docs/training/shots/admin/<nama>-d.png dan -m.png. Aksi yang mengubah data hanya dijalankan di sesi HP.
import { open, go, settle, ROOT } from "./lib.mjs";
import fs from "node:fs/promises";
const API = "http://localhost:3001/api";
const OUT = `${ROOT}/shots/admin`;
await fs.mkdir(OUT, { recursive: true });
const api = async (method, p, body, token) => { const r = await fetch(API + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${method} ${p} ${r.status} ${JSON.stringify(j).slice(0, 200)}`); return j.data ?? j; };
const loginApi = async (email, password = "KucurDev123!") => (await api("POST", "/auth/login", { email, password })).token;
const AT = await loginApi("admin@kucur.test");
const only = process.argv[2]?.split(",");
const D = await open("d"), M = await open("m");
const P = { d: D.page, m: M.page };
const snap = async (name, prep) => { for (const vk of ["d", "m"]) { const p = P[vk]; if (prep) await prep(p, vk); await settle(p, 500); await p.screenshot({ path: `${OUT}/${name}-${vk}.png` }); } };
const center = async (loc) => { await loc.first().evaluate((el) => el.scrollIntoView({ block: "center" })); await new Promise((r) => setTimeout(r, 350)); };
const S = async (id, fn) => { if (only && !only.includes(id)) return; try { await fn(); console.log("OK   ", id); } catch (e) { console.log("GAGAL", id, e.message.split("\n").slice(0, 3).join(" ")); } };
const ids = Object.fromEntries((await api("GET", "/stores/applications", null, AT)).map((s) => [s.name, s.id]));

// 1. Beranda
await S("beranda", async () => snap("beranda", (p) => go(p, "/admin")));
// 2. Persetujuan lapak
await S("persetujuan", async () => {
  await snap("persetujuan-daftar", (p) => go(p, "/admin/merchant-approval"));
  await snap("persetujuan-detail", async (p) => { await go(p, `/admin/merchant-approval/${ids["Rempeyek Bu Tinah"]}`); });
  await snap("persetujuan-tindakan", async (p) => { await center(p.getByRole("button", { name: "Setujui Lapak" })); });
  // Tolak: dialog kosong -> tombol tidak aktif / pesan; lalu isi alasan
  await snap("persetujuan-tolak-dialog", async (p) => { await go(p, `/admin/merchant-approval/${ids["Tahu Bakso Pak Joko"]}`); await p.getByRole("button", { name: "Tolak Pengajuan" }).click(); await settle(p, 500); });
  const m = P.m;
  await m.getByRole("dialog").or(m.locator("[role=alertdialog], .kucur-dialog-in")).first().locator("textarea").fill("Foto produk dan alamat usaha belum jelas. Silakan ajukan lagi setelah dilengkapi.");
  await m.getByRole("button", { name: "Konfirmasi Penolakan" }).click(); await settle(m, 1200);
  await P.d.keyboard.press("Escape");
  await snap("persetujuan-ditolak", async (p) => { await go(p, `/admin/merchant-approval/${ids["Tahu Bakso Pak Joko"]}`); });
  // Setujui Tinah (aksi di HP)
  await go(m, `/admin/merchant-approval/${ids["Rempeyek Bu Tinah"]}`);
  await m.getByRole("button", { name: "Setujui Lapak" }).click(); await settle(m, 800);
  const confirm = m.getByRole("button", { name: /^(Setujui|Ya|Konfirmasi)/ }); if (await confirm.count()) { console.log("dialog setujui:", await confirm.allInnerTexts()); }
  await snap("persetujuan-disetujui", async (p) => { await go(p, `/admin/merchant-approval/${ids["Rempeyek Bu Tinah"]}`); });
});


// 3. Keuangan
await S("keuangan", async () => {
  await snap("keuangan-ringkas", (p) => go(p, "/admin/finance"));
  await snap("keuangan-konfirmasi", async (p) => { await center(p.getByText("Pembayaran menunggu konfirmasi").first()); });
  await snap("keuangan-tagihan-lapak", async (p) => { await center(p.getByText("Tagihan per lapak").first()); });
  await snap("keuangan-rekap", async (p) => { await center(p.getByText("Rekap biaya admin per bulan").first()); });
  // Konfirmasi cicilan pertama Rempeyek Bu Tinah (HP)
  const m = P.m; await go(m, "/admin/finance");
  const row = m.locator("#finance-confirmations").locator("xpath=ancestor::section").locator("li").filter({ hasText: "Rempeyek" }).first();
  console.log("tombol:", (await row.getByRole("button").allInnerTexts()).join(" | "));
  await row.getByRole("button", { name: /Konfirmasi/ }).first().click(); await settle(m, 1500);
  await snap("keuangan-terkonfirmasi", async (p) => { await go(p, "/admin/finance"); await center(p.getByText("Pembayaran menunggu konfirmasi").first()); });
});
await S("keuangan-rincian", async () => {
  await snap("keuangan-rincian", (p) => go(p, "/admin/finance/" + ids["Jamur Tiram Sumber Kucur"]));
  await snap("keuangan-biaya-admin", async (p) => { await center(p.getByText("Biaya admin per bulan").first()); await p.evaluate(() => window.scrollBy(0, 120)); });
});

// 4. Jadwal Pengiriman
await S("jadwal", async () => {
  await snap("jadwal-draf", (p) => go(p, "/admin/delivery-batches"));
  await snap("jadwal-draf-kurir", async (p) => { await center(p.getByText("sisa kapasitas").first()); });
  await snap("jadwal-setujui", async (p) => { await center(p.getByRole("button", { name: /^Setujui \d+ pesanan/ })); });
  await snap("jadwal-gagal", async (p) => { await center(p.getByRole("button", { name: "Jadwalkan ulang besok" })); });
  await snap("jadwal-konfirmasi", async (p) => { await go(p, "/admin/delivery-batches"); await p.getByRole("button", { name: /^Setujui \d+ pesanan/ }).click(); await settle(p, 500); });
  await P.m.locator(".kucur-dialog-in").getByRole("button", { name: /^Setujui \d+/ }).click(); await settle(P.m, 2500);
  await P.d.keyboard.press("Escape");
});

await S("jadwal-hasil", async () => {
  await snap("jadwal-disetujui", async (p) => { await go(p, "/admin/delivery-batches"); await center(p.locator(".batch-date-group").first()); await p.evaluate(() => window.scrollBy(0, -90)); });
});

// 5. Kurir
await S("kurir", async () => {
  await snap("kurir-daftar", (p) => go(p, "/admin/couriers"));
  const fillForm = async (p) => { await go(p, "/admin/couriers"); await p.getByRole("button", { name: /Tambah kurir/ }).click(); await settle(p, 500);
    const d = p.locator(".kucur-dialog-in").first();
    await d.getByLabel("Nama lengkap").fill("Kurir Pelatihan"); await d.getByLabel("Email").fill("kurir.pelatihan@kucur.test"); await d.getByLabel("Nomor WhatsApp").fill("081230004001"); };
  await snap("kurir-tambah", fillForm);
  const m = P.m;
  await m.locator(".kucur-dialog-in").first().getByRole("button", { name: "Buat akun" }).click(); await settle(m, 1500);
  await snap("kurir-akun-dibuat", async (p) => { if (p === P.d) { await P.d.keyboard.press("Escape"); await go(p, "/admin/couriers"); } });
});
await S("cuti", async () => {
  const ct = await loginApi("kurir.pelatihan@kucur.test", "KurirKucur123!");
  const start = new Date(Date.now() + 86400000).toISOString(), end = new Date(Date.now() + 4 * 86400000).toISOString();
  await api("POST", "/courier/availability", { startAt: start, endAt: end, reason: "Pulang kampung, acara keluarga" }, ct);
  await snap("kurir-cuti-menunggu", async (p) => { await go(p, "/admin/couriers"); await center(p.getByText("Pengajuan cuti").first()); await p.evaluate(() => window.scrollBy(0, -20)); });
  const m = P.m; console.log("cuti tombol:", (await m.locator("main").getByRole("button").allInnerTexts()).slice(0, 14).join(" | "));
});

await S("cuti-putusan", async () => {
  await snap("kurir-cuti-tolak", async (p) => { await go(p, "/admin/couriers"); await p.getByRole("button", { name: "Tolak", exact: true }).first().click(); await settle(p, 600); });
  console.log("dialog tolak:", await P.m.locator(".kucur-dialog-in, [role=dialog]").first().innerText().catch(() => "-"));
  for (const p of [P.d, P.m]) await p.getByRole("button", { name: /^(Kembali|Batal)/ }).first().click().catch(() => p.keyboard.press("Escape"));
  await settle(P.m, 500);
  await P.m.getByRole("button", { name: "Setujui", exact: true }).first().click(); await settle(P.m, 1500);
  await snap("kurir-cuti-disetujui", async (p) => { await go(p, "/admin/couriers"); await P.d.evaluate(() => 0); const t = p.getByRole("button", { name: /Riwayat/ }).first(); await t.click(); await settle(p, 500); });
});

await S("cuti-riwayat", async () => {
  await snap("kurir-cuti-setujui", async (p) => { await go(p, "/admin/couriers"); await p.getByRole("button", { name: "Setujui", exact: true }).first().click(); await settle(p, 600); });
  await P.m.locator(".kucur-dialog-in").getByRole("button", { name: "Setujui", exact: true }).click(); await settle(P.m, 1500);
  await P.d.keyboard.press("Escape");
  await snap("kurir-cuti-disetujui", async (p) => { await go(p, "/admin/couriers"); await p.getByRole("tab", { name: /Riwayat/ }).or(p.getByText("Riwayat", { exact: true })).first().click(); await settle(p, 600); });
});

// 6. Transaksi
await S("transaksi", async () => {
  await snap("transaksi-daftar", (p) => go(p, "/admin/transactions"));
  await snap("transaksi-filter", async (p, vk) => { await go(p, "/admin/transactions"); if (vk === "m") { await p.getByRole("button", { name: "Filter" }).click().catch(() => {}); await settle(p, 500); } });
  await snap("transaksi-detail", (p) => go(p, "/admin/orders/fba33642-26be-4d85-9dec-f5f6a3627804"));
  await snap("transaksi-detail-pembayaran", async (p) => { await center(p.getByText("Ringkasan Pembayaran").first()); });
});
// 7. Ulasan
await S("ulasan", async () => {
  await snap("ulasan-daftar", (p) => go(p, "/admin/reviews"));
  console.log("ulasan btn:", (await P.m.locator("main").getByRole("button").allInnerTexts()).slice(0, 6).join(" | "));
});

await S("ulasan-moderasi", async () => {
  await snap("ulasan-sembunyikan", async (p) => { await go(p, "/admin/reviews"); await p.getByRole("button", { name: "Sembunyikan ulasan" }).first().click(); await settle(p, 500); await p.locator("textarea:visible").first().fill("Mengandung kata kasar yang melanggar aturan komunitas."); });
  const m = P.m; await m.getByRole("button", { name: "Konfirmasi sembunyikan" }).click(); await settle(m, 1500);
  await P.d.keyboard.press("Escape");
  await snap("ulasan-disembunyikan", async (p) => { await go(p, "/admin/reviews"); await p.locator("select").first().selectOption({ label: "Disembunyikan" }); await settle(p, 800); });
  // pulihkan supaya data demo utuh
  const btn = m.getByRole("button", { name: /Tampilkan ulasan/ }).first(); await btn.click(); await settle(m, 1500);
  const dlgBtn = m.getByRole("button", { name: /Konfirmasi/ }); if (await dlgBtn.count()) { await dlgBtn.first().click(); await settle(m, 1200); }
  await go(m, "/admin/reviews"); console.log("ulasan dipulihkan, tombol sembunyikan:", await m.getByRole("button", { name: "Sembunyikan ulasan" }).count());
});

// 8. FAQ Chatbot
await S("faq", async () => {
  await snap("faq-daftar", (p) => go(p, "/admin/faq"));
  await snap("faq-coba", async (p) => { await go(p, "/admin/faq"); const box = p.getByPlaceholder(/Contoh: gimana cara batal/); await box.fill("jam buka pasar kucur"); await settle(p, 900); await center(box); });
  await snap("faq-tambah", async (p) => {
    await go(p, "/admin/faq"); await p.getByRole("button", { name: /Tambah FAQ/ }).click(); await settle(p, 600);
    await p.getByLabel("Pertanyaan (Indonesia)").fill("Jam berapa pasar desa buka?");
    await p.getByLabel("Pertanyaan (Inggris)").fill("What time does the village market open?");
    await p.getByLabel("Jawaban (Indonesia)").fill("Pasar desa buka setiap Minggu pukul 06.00 sampai 10.00.");
    await p.getByLabel("Jawaban (Inggris)").fill("The village market opens every Sunday from 06:00 to 10:00.");
    await p.getByRole("checkbox", { name: "Pembeli" }).check(); await p.getByRole("checkbox", { name: "Pengunjung" }).check();
    await p.getByLabel(/Kata kunci tambahan/).fill("jam buka, pasar, minggu");
  });
  const m = P.m;
  const save = m.getByRole("button", { name: /^Simpan/ }).last(); console.log("tombol simpan:", await save.innerText());
  await save.click(); await settle(m, 1500);
  await P.d.keyboard.press("Escape");
  await snap("faq-hasil-coba", async (p) => { await go(p, "/admin/faq"); const box = p.getByPlaceholder(/Contoh: gimana cara batal/); await box.fill("jam buka pasar desa"); await settle(p, 1000); await center(box); });
});

await S("faq-hapus", async () => {
  const m = P.m; await go(m, "/admin/faq"); await m.getByPlaceholder("Cari pertanyaan").fill("pasar desa"); await settle(m, 700);
  console.log("faq item tombol:", (await m.locator("main li, main article").filter({ hasText: "pasar desa buka" }).first().getByRole("button").allInnerTexts()).join(" | "));
  await m.locator("main li, main article").filter({ hasText: "pasar desa buka" }).first().getByRole("button", { name: /Hapus/ }).first().click(); await settle(m, 700);
  console.log("dialog:", await m.locator(".kucur-dialog-in").first().innerText());
  await m.locator(".kucur-dialog-in").first().getByRole("button", { name: /Hapus/ }).last().click(); await settle(m, 1500);
});

// 9. Analitik
await S("analitik", async () => {
  await snap("analitik-ringkasan", (p) => go(p, "/admin/analytics"));
  await snap("analitik-grafik", async (p) => { await center(p.getByText("Sorotan").first()); await p.evaluate(() => window.scrollBy(0, 330)); });
  await snap("analitik-laporan-lain", async (p) => { await go(p, "/admin/analytics"); await p.getByRole("button", { name: /Pengiriman & Kurir/ }).or(p.getByRole("tab", { name: /Pengiriman & Kurir/ })).first().click(); await settle(p, 1200); });
  await snap("analitik-ekspor", async (p) => { await go(p, "/admin/analytics"); await p.getByRole("button", { name: "Ekspor", exact: true }).click(); await settle(p, 600); });
  console.log("ekspor menu:", (await P.m.locator("[role=menu] button, [role=menuitem], [role=dialog] button, .kucur-dialog-in button").allInnerTexts()).join(" | "));
});
await S("analitik-edit", async () => {
  await snap("analitik-ubah", async (p) => { await go(p, "/admin/analytics"); await p.getByRole("button", { name: "Ubah laporan" }).click(); await settle(p, 900); });
  console.log("edit tombol:", (await P.m.locator("main button:visible").allInnerTexts()).slice(0, 25).join(" | "));
});

// 10. Pengaturan Platform (lihat saja)
await S("pengaturan", async () => {
  await snap("pengaturan-awal", (p) => go(p, "/admin/settings"));
  console.log("kategori:", await P.m.locator("select").first().locator("option").allInnerTexts());
  console.log("laptop kategori:", (await P.d.locator("main a, main button").allInnerTexts()).slice(0, 30).join(" | "));
});
// 11. Chat bantuan, notifikasi, pengguna, produk, profil
await S("chat", async () => {
  await snap("chat-daftar", (p) => go(p, "/admin/support-chats"));
});
await S("notifikasi", async () => { await snap("notifikasi-admin", (p) => go(p, "/admin/notifications")); });
await S("pengguna", async () => {
  await snap("pengguna-daftar", (p) => go(p, "/admin/users"));
  console.log("pengguna tombol:", (await P.m.locator("main button:visible").allInnerTexts()).slice(0, 12).join(" | "));
});
await S("produk", async () => { await snap("produk-daftar", (p) => go(p, "/admin/products")); });
await S("menu-hp", async () => {
  await snap("menu-hp", async (p, vk) => { await go(p, "/admin"); if (vk === "m") { await p.getByRole("button", { name: "Menu", exact: true }).click(); await settle(p, 700); } });
});

await S("pengaturan-kategori", async () => {
  for (const [slug, label] of [["pengiriman", "Pengiriman"], ["keuangan", "Keuangan & Pajak"], ["penjual", "Penjual & Lapak"], ["sistem", "Sistem"], ["pembayaran", "Pembayaran"], ["integrasi", "Integrasi"]]) {
    await snap(`pengaturan-${slug}`, async (p, vk) => {
      await go(p, "/admin/settings");
      if (vk === "m") await p.locator("select").first().selectOption({ label });
      else await p.locator("main :is(a,button)").filter({ hasText: new RegExp("^" + label.replace("&", "\&")) }).first().click();
      await settle(p, 800);
    });
  }
});

await S("chat-ruang", async () => {
  await snap("chat-ruang", async (p) => { await go(p, "/admin/support-chats"); await p.locator("main a").filter({ hasText: "Wahyu Hidayat" }).first().click(); await settle(p, 1500); });
  console.log("chat url:", P.m.url());
});

await S("tarik", async () => {
  const url = "/admin/finance/" + ids["Jamur Tiram Sumber Kucur"];
  await snap("keuangan-tarik-dialog", async (p) => { await go(p, url); await p.getByRole("button", { name: "Tandai sudah ditarik" }).first().click(); await settle(p, 700); });
  console.log("dialog tarik:", await P.m.locator(".kucur-dialog-in").first().innerText());
});

await S("tarik-konfirmasi", async () => {
  const url = "/admin/finance/" + ids["Jamur Tiram Sumber Kucur"];
  const m = P.m; await go(m, url); await m.getByRole("button", { name: "Tandai sudah ditarik" }).first().click(); await settle(m, 600);
  await m.locator(".kucur-dialog-in").getByPlaceholder(/diterima di balai desa/).fill("Diterima tunai di balai desa");
  await m.locator(".kucur-dialog-in").getByRole("button", { name: "Konfirmasi" }).click(); await settle(m, 1500);
  await snap("keuangan-sudah-ditarik", async (p) => { await go(p, url); await center(p.getByText("Biaya admin per bulan").first()); await p.evaluate(() => window.scrollBy(0, 200)); });
});

// ==FIN==
await D.browser.close(); await M.browser.close(); process.exit(0);
