import { productCategories } from "../services/productService.js";

// Upload/unduh produk lapak lewat Excel. Satu baris = satu produk TANPA variasi. exceljs dimuat hanya saat dipakai.
// Impor hanya membuat produk baru atau mengubah produk yang ada di lapak ini; impor tidak pernah menghapus produk.
const HEADERS = {
  id: ["ID", "ID"],
  name: ["Nama", "Name"],
  category: ["Kategori", "Category"],
  description: ["Deskripsi", "Description"],
  price: ["Harga", "Price"],
  compareAtPrice: ["Harga coret", "Compare-at price"],
  stock: ["Stok", "Stock"],
  status: ["Status", "Status"],
};
const WIDTHS = { id: 40, name: 34, category: 18, description: 60, price: 14, compareAtPrice: 16, stock: 10, status: 13 };
const KEYS = Object.keys(HEADERS);
const STATUS_LABEL = { id: { active: "Aktif", inactive: "Nonaktif" }, en: { active: "Active", inactive: "Inactive" } };
const STATUS_VALUES = { aktif: "active", active: "active", nonaktif: "inactive", "non-aktif": "inactive", "tidak aktif": "inactive", inactive: "inactive" };

const MESSAGES = {
  id: {
    noSheet: "Sheet Produk tidak ditemukan.",
    missingColumns: "Kolom tidak ditemukan: {columns}. Gunakan file contoh.",
    duplicateId: "ID \"{id}\" muncul lebih dari sekali.",
    unknownId: "ID \"{id}\" bukan produk di lapak ini. Kosongkan ID untuk membuat produk baru.",
    variantSkipped: "\"{name}\" punya variasi, jadi dilewati. Ubah produk variasi lewat formulir.",
    name: "Nama wajib diisi (maksimal 180 karakter).",
    category: "Kategori harus salah satu dari: {options}.",
    description: "Deskripsi wajib diisi (maksimal 5000 karakter).",
    price: "Harga wajib berupa angka lebih dari 0.",
    compareAtPrice: "Harga coret harus angka yang lebih besar dari Harga, atau dikosongkan.",
    stock: "Stok wajib berupa bilangan bulat 0 atau lebih.",
    status: "Status harus Aktif atau Nonaktif.",
  },
  en: {
    noSheet: "The Products sheet was not found.",
    missingColumns: "Missing columns: {columns}. Use the template file.",
    duplicateId: "ID \"{id}\" appears more than once.",
    unknownId: "ID \"{id}\" is not a product in this store. Leave ID empty to create a new product.",
    variantSkipped: "\"{name}\" has variants, so it was skipped. Edit variant products in the form.",
    name: "Name is required (max 180 characters).",
    category: "Category must be one of: {options}.",
    description: "Description is required (max 5000 characters).",
    price: "Price must be a number greater than 0.",
    compareAtPrice: "Compare-at price must be a number greater than Price, or left empty.",
    stock: "Stock must be a whole number of 0 or more.",
    status: "Status must be Active or Inactive.",
  },
};

const GUIDE = {
  id: [
    ["Kolom", "Wajib", "Isi yang diterima"],
    ["ID", "Untuk ubah produk", "Kosongkan untuk produk baru. Untuk mengubah produk, biarkan ID dari file \"Unduh Excel\" (jangan diubah)."],
    ["Nama", "Ya", "Nama produk, maksimal 180 karakter."],
    ["Kategori", "Ya", `Pilih salah satu: ${productCategories.join(", ")}.`],
    ["Deskripsi", "Ya", "Penjelasan produk, maksimal 5000 karakter."],
    ["Harga", "Ya", "Harga jual dalam rupiah, angka saja, mis. 25000."],
    ["Harga coret", "Tidak", "Harga sebelum diskon. Harus lebih besar dari Harga. Kosongkan jika tidak ada diskon."],
    ["Stok", "Ya", "Jumlah barang tersedia, bilangan bulat 0 atau lebih."],
    ["Status", "Ya", "Aktif (tampil di toko) atau Nonaktif (disembunyikan)."],
    [],
    ["Catatan", "", "Hanya untuk produk TANPA variasi. Produk bervariasi tidak ikut diunduh dan dilewati saat impor; ubah lewat formulir produk."],
    ["", "", "Foto produk tidak bisa diisi lewat Excel. Tambahkan foto setelah impor lewat tombol Ubah di daftar produk."],
    ["", "", "Impor tidak pernah menghapus produk. Baris yang dihapus dari file tidak mengubah apa pun."],
  ],
  en: [
    ["Column", "Required", "Accepted values"],
    ["ID", "To edit a product", "Leave empty for a new product. To edit a product, keep the ID from the \"Download Excel\" file (do not change it)."],
    ["Name", "Yes", "Product name, max 180 characters."],
    ["Category", "Yes", `One of: ${productCategories.join(", ")}.`],
    ["Description", "Yes", "Product description, max 5000 characters."],
    ["Price", "Yes", "Selling price in rupiah, numbers only, e.g. 25000."],
    ["Compare-at price", "No", "Price before discount. Must be greater than Price. Leave empty if there is no discount."],
    ["Stock", "Yes", "Available quantity, a whole number of 0 or more."],
    ["Status", "Yes", "Active (shown in the shop) or Inactive (hidden)."],
    [],
    ["Notes", "", "Only for products WITHOUT variants. Variant products are not exported and are skipped on import; edit them in the product form."],
    ["", "", "Product photos cannot be set through Excel. Add photos after importing with the Edit button in the product list."],
    ["", "", "Import never deletes products. Rows removed from the file change nothing."],
  ],
};

const fill = (text, values) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), text);
const cellText = (cell) => { const value = cell?.value; if (value == null) return ""; if (typeof value === "object") return String(value.richText ? value.richText.map((part) => part.text).join("") : value.text ?? value.result ?? ""); return String(value); };

// "25000", "25.000", "Rp 25.000", "25,000" -> 25000. Kosong -> null. Tidak valid -> NaN.
export function parseAmount(text) {
  const raw = String(text ?? "").replace(/rp\.?/i, "").replace(/\s/g, "");
  if (!raw) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
  return /^\d+([.,]\d+)?$/.test(raw) ? Number(raw.replace(",", ".")) : Number.NaN;
}

const download = (buffer, filename) => {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const slug = (text) => String(text ?? "lapak").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "lapak";

export async function exportProductExcel({ products = [], storeName = "", language = "id", template = false }) {
  const lang = language === "en" ? "en" : "id";
  const index = lang === "en" ? 1 : 0;
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook(); book.creator = "Kucur Local Market";
  const sheet = book.addWorksheet(lang === "en" ? "Products" : "Produk", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = KEYS.map((key) => ({ key, header: HEADERS[key][index], width: WIDTHS[key] }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173F29" } };
  const label = STATUS_LABEL[lang];
  const rows = template
    ? [
      { id: "", name: lang === "en" ? "Kucur cassava chips" : "Keripik singkong Kucur", category: productCategories[0], description: lang === "en" ? "Crispy cassava chips, 200 g pack." : "Keripik singkong renyah, kemasan 200 gram.", price: 15000, compareAtPrice: 18000, stock: 25, status: label.active },
      { id: "", name: lang === "en" ? "Bamboo basket" : "Keranjang bambu", category: "Kerajinan", description: lang === "en" ? "Handmade by Kucur villagers." : "Anyaman tangan warga Kucur.", price: 45000, compareAtPrice: "", stock: 5, status: label.inactive },
    ]
    : products.filter((product) => !product.hasVariants).map((product) => ({
      id: product.id, name: product.name, category: product.category, description: product.description ?? "",
      price: Number(product.price), compareAtPrice: product.compareAtPrice ?? "", stock: Number(product.stock), status: label[product.status] ?? label.active,
    }));
  for (const row of rows) sheet.addRow(row);
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  const last = Math.max(rows.length + 200, 300);
  sheet.dataValidations.add(`C2:C${last}`, { type: "list", allowBlank: false, formulae: [`"${productCategories.join(",")}"`] });
  sheet.dataValidations.add(`H2:H${last}`, { type: "list", allowBlank: false, formulae: [`"${label.active},${label.inactive}"`] });
  const guide = book.addWorksheet(lang === "en" ? "Guide" : "Petunjuk");
  guide.columns = [{ width: 22 }, { width: 20 }, { width: 100 }];
  GUIDE[lang].forEach((line) => guide.addRow(line));
  guide.getRow(1).font = { bold: true };
  guide.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
  const name = template ? (lang === "en" ? "kucur-product-import-template.xlsx" : "contoh-impor-produk-kucur.xlsx") : `${lang === "en" ? "products" : "produk"}-${slug(storeName)}.xlsx`;
  download(await book.xlsx.writeBuffer(), name);
}

// Baca file -> rencana impor per baris (create/update/unchanged/skip) + kesalahan per baris + ringkasan.
// `products` = produk lapak aktif saat ini (untuk mencocokkan ID dan mendeteksi baris yang tidak berubah).
export async function parseProductExcel(file, { products = [], language = "id" } = {}) {
  const m = MESSAGES[language === "en" ? "en" : "id"];
  const empty = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.getWorksheet("Produk") ?? book.getWorksheet("Products") ?? book.worksheets[0];
  if (!sheet) return { plan: [], errors: [{ row: 0, message: m.noSheet }], skipped: [], summary: empty };
  const headers = []; sheet.getRow(1).eachCell((cell, column) => { headers[column] = cellText(cell).trim().toLowerCase(); });
  const columnOf = Object.fromEntries(KEYS.map((key) => [key, headers.findIndex((header) => HEADERS[key].some((name) => name.toLowerCase() === header))]));
  const missing = KEYS.filter((key) => columnOf[key] < 1).map((key) => HEADERS[key][language === "en" ? 1 : 0]);
  if (missing.length) return { plan: [], errors: [{ row: 1, message: fill(m.missingColumns, { columns: missing.join(", ") }) }], skipped: [], summary: empty };
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const categoryByLower = new Map(productCategories.map((category) => [category.toLowerCase(), category]));
  const plan = []; const errors = []; const skipped = []; const seen = new Set(); const summary = { ...empty };
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const values = Object.fromEntries(KEYS.map((key) => [key, cellText(row.getCell(columnOf[key])).trim()]));
    if (Object.values(values).every((value) => !value)) return;
    const rowErrors = [];
    const id = values.id;
    const existing = id ? byId.get(id) : null;
    if (id) {
      if (seen.has(id)) { errors.push({ row: number, message: fill(m.duplicateId, { id }) }); return; }
      seen.add(id);
      if (!existing) { errors.push({ row: number, message: fill(m.unknownId, { id }) }); return; }
      if (existing.hasVariants) { skipped.push({ row: number, message: fill(m.variantSkipped, { name: existing.name }) }); summary.skipped += 1; return; }
    }
    const name = values.name;
    if (!name || name.length > 180) rowErrors.push(m.name);
    const category = categoryByLower.get(values.category.toLowerCase());
    if (!category) rowErrors.push(fill(m.category, { options: productCategories.join(", ") }));
    const description = values.description;
    if (!description || description.length > 5000) rowErrors.push(m.description);
    const price = parseAmount(values.price);
    const priceOk = Number.isFinite(price) && price > 0;
    if (!priceOk) rowErrors.push(m.price);
    const compareAtPrice = parseAmount(values.compareAtPrice);
    if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || (priceOk && compareAtPrice <= price))) rowErrors.push(m.compareAtPrice);
    const stock = parseAmount(values.stock);
    if (!Number.isInteger(stock) || stock < 0) rowErrors.push(m.stock);
    const status = values.status ? STATUS_VALUES[values.status.toLowerCase()] : "active";
    if (!status) rowErrors.push(m.status);
    if (rowErrors.length) { rowErrors.forEach((message) => errors.push({ row: number, message })); return; }
    const payload = { name, category, description, price, compareAtPrice, stock, status };
    if (!existing) { plan.push({ row: number, action: "create", name, payload }); summary.created += 1; return; }
    const current = { name: existing.name, category: existing.category, description: existing.description ?? "", price: Number(existing.price), compareAtPrice: existing.compareAtPrice ?? null, stock: Number(existing.stock), status: existing.status };
    const same = KEYS.filter((key) => key !== "id").every((key) => current[key] === payload[key]);
    plan.push({ row: number, action: same ? "unchanged" : "update", productId: existing.id, name, payload });
    summary[same ? "unchanged" : "updated"] += 1;
  });
  return { plan, errors, skipped, summary };
}
