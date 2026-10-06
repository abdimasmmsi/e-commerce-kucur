import { FAQS } from "../data/faq.js";

// Ekspor/impor FAQ chatbot lewat Excel. Satu baris = satu FAQ. exceljs dimuat hanya saat dipakai.
// Impor MENGGANTI semua perubahan FAQ admin: FAQ bawaan yang tidak ada di file kembali ke versi bawaan.
export const FAQ_COLUMNS = [
  { key: "id", header: "ID", width: 24 },
  { key: "type", header: "Jenis", width: 14 },
  { key: "status", header: "Status", width: 13 },
  { key: "roles", header: "Peran", width: 30 },
  { key: "qId", header: "Pertanyaan (Indonesia)", width: 42 },
  { key: "qEn", header: "Pertanyaan (Inggris)", width: 42 },
  { key: "aId", header: "Jawaban (Indonesia)", width: 60 },
  { key: "aEn", header: "Jawaban (Inggris)", width: 60 },
  { key: "keywords", header: "Kata kunci", width: 26 },
  { key: "link", header: "Tautan", width: 24 },
  { key: "pinned", header: "Topik awal", width: 12 },
];
const ROLE_NAMES = { pengunjung: "visitor", visitor: "visitor", pembeli: "customer", customer: "customer", lapak: "merchant", penjual: "merchant", merchant: "merchant", kurir: "courier", courier: "courier", admin: "admin" };
const ROLE_LABEL = { visitor: "pengunjung", customer: "pembeli", merchant: "lapak", courier: "kurir", admin: "admin" };
export const FAQ_LINKS = [...new Map(FAQS.filter((faq) => faq.link).map((faq) => [faq.link.to, faq.link])).values()];
const BUILTIN = new Map(FAQS.map((faq) => [faq.id, faq]));
const yes = (value) => ["ya", "yes", "y", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
const cellText = (cell) => { const value = cell?.value; if (value == null) return ""; if (typeof value === "object") return String(value.richText ? value.richText.map((part) => part.text).join("") : value.text ?? value.result ?? ""); return String(value); };

const toRow = (faq, entry) => ({
  id: faq.id, type: BUILTIN.has(faq.id) ? "Bawaan" : "Buatan admin", status: entry?.hidden ? "Sembunyi" : "Tampil",
  roles: (faq.roles ?? []).map((role) => ROLE_LABEL[role]).join(", "), qId: faq.q?.id ?? "", qEn: faq.q?.en ?? "",
  aId: (faq.a?.id ?? []).join("\n"), aEn: (faq.a?.en ?? []).join("\n"), keywords: (entry?.keywords ?? faq.keywords ?? []).join(", "),
  link: faq.link?.to ?? "", pinned: entry?.pinned || faq.pinned ? "Ya" : "Tidak",
});

const download = (buffer, filename) => {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const GUIDE = [
  ["Kolom", "Wajib", "Isi yang diterima"],
  ["ID", "Untuk FAQ bawaan", "Jangan ubah ID FAQ bawaan. Untuk FAQ baru boleh dikosongkan (dibuat otomatis) atau diisi huruf kecil/angka/tanda minus, mis. wifi-desa."],
  ["Jenis", "Tidak", "Hanya keterangan (Bawaan / Buatan admin). Diabaikan saat impor."],
  ["Status", "Ya", "Tampil atau Sembunyi."],
  ["Peran", "Ya", "Pisahkan dengan koma: pengunjung, pembeli, lapak, kurir, admin."],
  ["Pertanyaan (Indonesia) / (Inggris)", "Ya", "Maksimal 200 karakter. Kedua bahasa wajib diisi."],
  ["Jawaban (Indonesia) / (Inggris)", "Ya", "Satu langkah per baris (Alt+Enter di Excel), maksimal 8 langkah. **teks** = huruf tebal. Angka dari Admin Settings: {cutoff}, {dispatch}, {rate}, {tax}, {adminFee}, {contact}."],
  ["Kata kunci", "Tidak", "Pisahkan dengan koma, mis. wifi, internet. Membantu chatbot mengenali pertanyaan."],
  ["Tautan", "Tidak", `Halaman tujuan tombol pintasan. Pilihan: ${FAQ_LINKS.map((link) => link.to).join(", ")}`],
  ["Topik awal", "Tidak", "Ya atau Tidak. Ya = tampil di pilihan awal chatbot."],
  [],
  ["Catatan", "", "Impor menggantikan semua perubahan FAQ sebelumnya. FAQ bawaan yang tidak ada di file kembali ke versi bawaan. Hapus baris FAQ buatan admin untuk menghapusnya."],
];

export async function exportFaqExcel({ faqs, entries, template = false }) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook(); book.creator = "Kucur Local Market";
  const sheet = book.addWorksheet("FAQ", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = FAQ_COLUMNS;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173F29" } };
  const entryById = new Map((entries ?? []).map((entry) => [entry.id, entry]));
  const rows = template
    ? [
      { id: "wifi-desa", type: "Buatan admin", status: "Tampil", roles: "pengunjung, pembeli", qId: "Apakah ada wifi di desa?", qEn: "Is there wifi in the village?", aId: "Ada, gratis di **balai desa**.\nKata sandi tanyakan ke petugas.", aEn: "Yes, free at the **village hall**.\nAsk the staff for the password.", keywords: "wifi, internet", link: "", pinned: "Tidak" },
      { ...toRow(FAQS[0]), status: "Sembunyi" },
    ]
    : [...faqs.map((faq) => toRow(faq, entryById.get(faq.id))), ...(entries ?? []).filter((entry) => entry.builtin && entry.hidden && !entry.deletedAt && !faqs.some((faq) => faq.id === entry.id)).map((entry) => ({ ...toRow(BUILTIN.get(entry.id) ?? { id: entry.id }), status: "Sembunyi" }))];
  for (const row of rows) sheet.addRow(row);
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  sheet.dataValidations.add(`C2:C${Math.max(rows.length + 200, 300)}`, { type: "list", allowBlank: false, formulae: ['"Tampil,Sembunyi"'] });
  sheet.dataValidations.add(`K2:K${Math.max(rows.length + 200, 300)}`, { type: "list", allowBlank: true, formulae: ['"Ya,Tidak"'] });
  const guide = book.addWorksheet("Petunjuk");
  guide.columns = [{ width: 30 }, { width: 18 }, { width: 100 }];
  GUIDE.forEach((line) => guide.addRow(line));
  guide.getRow(1).font = { bold: true };
  guide.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  download(await book.xlsx.writeBuffer(), template ? "contoh-impor-faq-kucur.xlsx" : "faq-chatbot-kucur.xlsx");
}

// Baca file → entri FAQ admin + daftar kesalahan per baris + ringkasan.
export async function parseFaqExcel(file) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.getWorksheet("FAQ") ?? book.worksheets[0];
  if (!sheet) return { entries: [], errors: [{ row: 0, message: "Sheet FAQ tidak ditemukan." }], summary: { added: 0, changed: 0, hidden: 0 } };
  const headers = []; sheet.getRow(1).eachCell((cell, column) => { headers[column] = cellText(cell).trim(); });
  const columnOf = Object.fromEntries(FAQ_COLUMNS.map((column) => [column.key, headers.indexOf(column.header)]));
  const missing = FAQ_COLUMNS.filter((column) => !["type"].includes(column.key) && columnOf[column.key] < 1).map((column) => column.header);
  if (missing.length) return { entries: [], errors: [{ row: 1, message: `Kolom tidak ditemukan: ${missing.join(", ")}. Gunakan file contoh.` }], summary: { added: 0, changed: 0, hidden: 0 } };
  const entries = []; const errors = []; const seen = new Set(); const summary = { added: 0, changed: 0, hidden: 0 };
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const get = (key) => cellText(row.getCell(columnOf[key])).trim();
    const values = Object.fromEntries(FAQ_COLUMNS.filter((column) => columnOf[column.key] > 0).map((column) => [column.key, get(column.key)]));
    if (Object.values(values).every((value) => !value)) return;
    const fail = (message) => errors.push({ row: number, message });
    let id = values.id.toLowerCase();
    const builtin = BUILTIN.get(id);
    if (!id) id = `custom-${Date.now().toString(36)}-${number}`;
    if (!/^[a-z0-9-]{2,60}$/.test(id)) return fail(`ID "${values.id}" hanya boleh huruf kecil, angka, dan tanda minus.`);
    if (seen.has(id)) return fail(`ID "${id}" muncul lebih dari sekali.`);
    seen.add(id);
    const status = values.status.toLowerCase();
    if (!["tampil", "sembunyi", "show", "hide", "hidden"].includes(status)) return fail("Status harus Tampil atau Sembunyi.");
    const hidden = status !== "tampil" && status !== "show";
    const roles = [...new Set(values.roles.split(/[,;]/).map((role) => ROLE_NAMES[role.trim().toLowerCase()]).filter(Boolean))];
    const unknownRoles = values.roles.split(/[,;]/).map((role) => role.trim()).filter((role) => role && !ROLE_NAMES[role.toLowerCase()]);
    if (unknownRoles.length) return fail(`Peran tidak dikenal: ${unknownRoles.join(", ")}.`);
    const lines = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const link = values.link ? FAQ_LINKS.find((option) => option.to === values.link) : null;
    if (values.link && !link) return fail(`Tautan "${values.link}" tidak dikenal. Lihat daftar di sheet Petunjuk.`);
    if (builtin && hidden) { entries.push({ id, builtin: true, hidden: true }); summary.hidden += 1; return; }
    if (!roles.length) return fail("Isi minimal satu peran.");
    if (!values.qId || !values.qEn) return fail("Pertanyaan Indonesia dan Inggris wajib diisi.");
    if (values.qId.length > 200 || values.qEn.length > 200) return fail("Pertanyaan maksimal 200 karakter.");
    const aId = lines(values.aId); const aEn = lines(values.aEn);
    if (!aId.length || !aEn.length || aId.length > 8 || aEn.length > 8) return fail("Jawaban Indonesia dan Inggris wajib berisi 1–8 langkah.");
    const keywords = values.keywords.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean).slice(0, 15);
    const entry = { id, builtin: Boolean(builtin), hidden, pinned: yes(values.pinned), roles, keywords, link: link ? { to: link.to, label: link.label } : null, q: { id: values.qId, en: values.qEn }, a: { id: aId, en: aEn } };
    if (builtin) {
      const same = JSON.stringify([builtin.roles, builtin.q, builtin.a, builtin.link?.to ?? ""]) === JSON.stringify([roles, entry.q, entry.a, link?.to ?? ""]) && !keywords.length && !entry.pinned && !hidden;
      if (same) return;
      summary.changed += 1;
    } else if (hidden) summary.hidden += 1; else summary.added += 1;
    entries.push(entry);
  });
  return { entries, errors, summary };
}
