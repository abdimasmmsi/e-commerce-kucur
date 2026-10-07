// Mesin Analytics admin: semua angka dihitung dari data asli (pesanan, ulasan, iuran) di browser.
// Laporan hanya menyimpan susunan widget (PlatformSettings.analyticsReports), bukan angkanya.

const DAY = 86400000;
const jakartaDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const jakartaHour = (value) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
const WEEKDAY_ORDER = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const jakartaWeekday = (value) => WEEKDAY_ORDER[new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date(value))] ?? 0;
const WEEKDAY_LABELS = { id: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
// Pengelompokan siklik: jumlah ember tetap & berurutan (bukan diurut nilai), ember kosong = 0.
const CYCLIC = {
  weekday: { count: 7, keyOf: (date) => jakartaWeekday(date), label: (index, lang) => (WEEKDAY_LABELS[lang] ?? WEEKDAY_LABELS.id)[index] },
  hour: { count: 24, keyOf: (date) => jakartaHour(date), label: (index) => `${String(index).padStart(2, "0")}:00` },
};
export const isCyclicGroup = (group) => group === "weekday" || group === "hour";
const COMPLETED = new Set(["completed", "delivered"]);

// grain = jenis baris data yang dihitung; menentukan pengelompokan yang masuk akal.
export const METRICS = {
  revenue: { id: "Pendapatan produk", en: "Product revenue", grain: "item", money: true },
  completedOrders: { id: "Pesanan selesai", en: "Completed orders", grain: "order" },
  orders: { id: "Pesanan masuk", en: "Orders placed", grain: "order" },
  avgOrder: { id: "Rata-rata belanja", en: "Average order value", grain: "order", money: true },
  cancelledOrders: { id: "Pesanan dibatalkan", en: "Cancelled orders", grain: "order" },
  cancelRate: { id: "Tingkat pembatalan", en: "Cancellation rate", grain: "order", percent: true },
  itemsSold: { id: "Barang terjual", en: "Items sold", grain: "item" },
  deliveryFee: { id: "Ongkir", en: "Delivery fees", grain: "order", money: true },
  courierTip: { id: "Tip kurir", en: "Courier tips", grain: "order", money: true },
  tax: { id: "PPN", en: "VAT", grain: "order", money: true },
  failedDeliveries: { id: "Pengiriman gagal", en: "Failed deliveries", grain: "order" },
  reviewCount: { id: "Jumlah ulasan", en: "Reviews", grain: "review" },
  avgRating: { id: "Rata-rata rating", en: "Average rating", grain: "review", rating: true },
  adminFeeBilled: { id: "Biaya admin tertagih", en: "Admin fees billed", grain: "fee", money: true },
  adminFeePaid: { id: "Biaya admin terbayar", en: "Admin fees paid", grain: "fee", money: true },
  contributions: { id: "Iuran sukarela", en: "Voluntary contributions", grain: "contribution", money: true },
};
export const GROUPS = {
  total: { id: "Total saja", en: "Total only" }, day: { id: "Hari", en: "Day" }, week: { id: "Minggu", en: "Week" }, month: { id: "Bulan", en: "Month" },
  weekday: { id: "Hari", en: "Day of week" }, hour: { id: "Jam", en: "Hour" }, store: { id: "Lapak", en: "Store" }, category: { id: "Kategori", en: "Category" }, product: { id: "Produk", en: "Product" }, courier: { id: "Kurir", en: "Courier" }, status: { id: "Status pesanan", en: "Order status" },
};
export const VIEWS = {
  kpi: { id: "Angka", en: "Number" }, bar: { id: "Batang", en: "Bars" }, line: { id: "Garis", en: "Line" },
  hbar: { id: "Horizontal", en: "Horizontal" }, table: { id: "Tabel", en: "Table" }, share: { id: "Tumpuk", en: "Stacked" },
};
const GRAIN_GROUPS = {
  order: ["total", "day", "week", "month", "weekday", "hour", "store", "courier", "status"],
  item: ["total", "day", "week", "month", "store", "category", "product"],
  review: ["total", "day", "week", "month", "store"],
  fee: ["total", "day", "week", "month", "store"],
  contribution: ["total", "day", "week", "month", "store"],
};
export const groupsFor = (metric) => GRAIN_GROUPS[METRICS[metric]?.grain] ?? ["total"];
export const isTimeGroup = (group) => ["day", "week", "month"].includes(group);
export const viewsFor = (group) => (group === "total" ? ["kpi"] : isTimeGroup(group) || isCyclicGroup(group) ? ["bar", "line", "table"] : ["hbar", "table", "share", "bar"]);

const STATUS_LABEL = {
  id: { pending: "Menunggu", confirmed: "Diterima", processing: "Dikemas", "ready-for-pickup": "Siap diambil", "courier-assigned": "Siap diambil", "picked-up": "Diantar", "on-delivery": "Diantar", delivered: "Selesai", completed: "Selesai", cancelled: "Dibatalkan" },
  en: { pending: "Waiting", confirmed: "Accepted", processing: "Packing", "ready-for-pickup": "Ready for pickup", "courier-assigned": "Ready for pickup", "picked-up": "On delivery", "on-delivery": "On delivery", delivered: "Completed", completed: "Completed", cancelled: "Cancelled" },
};

// Ubah data mentah API menjadi baris siap hitung per grain.
export function buildDatasets({ orders = [], products = [], reviews = [], finance = {} }) {
  const categoryOf = new Map(products.map((product) => [String(product.id), product.category || null]));
  const courierOf = (order) => { const rows = order.deliveryBatchOrders ?? []; return rows.length ? rows[rows.length - 1]?.batch?.courier?.fullName ?? null : null; };
  const orderRows = orders.map((order) => {
    const categories = [...new Set((order.items ?? []).map((item) => categoryOf.get(String(item.productId)) || "Lainnya"))];
    return { kind: "order", id: order.id, code: order.orderCode || order.orderNumber, storeId: order.storeId, store: order.storeName || order.store?.name || "-", status: order.status || order.fulfillmentStatus, createdAt: order.createdAt, completedAt: order.completedAt, cancelledAt: order.cancelledAt || order.updatedAt, updatedAt: order.updatedAt, total: Number(order.totalAmount || 0), productTotal: Number(order.productTotal || 0), deliveryFee: Number(order.deliveryFee || 0), courierTip: Number(order.courierTip || 0), tax: Number(order.taxAmount || 0), courier: courierOf(order), failed: (order.deliveryBatchOrders ?? []).some((row) => row.status === "FAILED"), categories };
  });
  const itemRows = orderRows.flatMap((order, index) => (COMPLETED.has(order.status) ? (orders[index].items ?? []).map((item) => ({ kind: "item", storeId: order.storeId, store: item.storeName || order.store, product: item.productNameSnapshot || item.productName || "-", category: categoryOf.get(String(item.productId)) || "Lainnya", date: order.completedAt || order.updatedAt, quantity: Number(item.quantity || 0), subtotal: Number(item.subtotal || 0) })) : []));
  const reviewRows = reviews.map((review) => ({ kind: "review", storeId: review.storeId, store: review.store?.name || "-", rating: Number(review.rating || 0), date: review.createdAt, hidden: Boolean(review.isHidden) }));
  const feeRows = (finance.adminFees ?? []).map((fee) => ({ kind: "fee", storeId: fee.storeId, store: fee.store?.name || "-", amount: Number(fee.feeAmount || 0), paid: String(fee.status).toLowerCase() === "paid", date: fee.platformTransaction?.completedAt || fee.cutoffAt || fee.paidAt }));
  const contributionRows = (finance.contributions ?? []).map((row) => ({ kind: "contribution", storeId: row.storeId, store: row.store?.name || "-", amount: Number(row.amount || 0), paid: String(row.status || row.paymentStatus).toLowerCase() === "paid", date: row.paidAt || row.createdAt }));
  return { orderRows, itemRows, reviewRows, feeRows, contributionRows, stores: [...new Map(orderRows.map((row) => [row.storeId, row.store])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)), categories: [...new Set(products.map((product) => product.category).filter(Boolean))].sort() };
}

// Baris + tanggal acuan + nilai per metrik.
function metricRows(metric, data) {
  const { orderRows, itemRows, reviewRows, feeRows, contributionRows } = data;
  switch (metric) {
    case "orders": return orderRows.map((row) => ({ row, date: row.createdAt, value: 1 }));
    case "completedOrders": return orderRows.filter((row) => COMPLETED.has(row.status)).map((row) => ({ row, date: row.completedAt || row.updatedAt, value: 1 }));
    case "avgOrder": return orderRows.filter((row) => COMPLETED.has(row.status)).map((row) => ({ row, date: row.completedAt || row.updatedAt, value: row.total }));
    case "cancelledOrders": return orderRows.filter((row) => row.status === "cancelled").map((row) => ({ row, date: row.cancelledAt, value: 1 }));
    case "cancelRate": return orderRows.map((row) => ({ row, date: row.createdAt, value: row.status === "cancelled" ? 1 : 0 }));
    case "deliveryFee": case "courierTip": case "tax": return orderRows.filter((row) => COMPLETED.has(row.status)).map((row) => ({ row, date: row.completedAt || row.updatedAt, value: row[metric] }));
    case "failedDeliveries": return orderRows.filter((row) => row.failed).map((row) => ({ row, date: row.updatedAt, value: 1 }));
    case "revenue": return itemRows.map((row) => ({ row, date: row.date, value: row.subtotal }));
    case "itemsSold": return itemRows.map((row) => ({ row, date: row.date, value: row.quantity }));
    case "reviewCount": return reviewRows.map((row) => ({ row, date: row.date, value: 1 }));
    case "avgRating": return reviewRows.map((row) => ({ row, date: row.date, value: row.rating }));
    case "adminFeeBilled": return feeRows.map((row) => ({ row, date: row.date, value: row.amount }));
    case "adminFeePaid": return feeRows.filter((row) => row.paid).map((row) => ({ row, date: row.date, value: row.amount }));
    case "contributions": return contributionRows.filter((row) => row.paid).map((row) => ({ row, date: row.date, value: row.amount }));
    default: return [];
  }
}
export const AVERAGE_METRICS = new Set(["avgOrder", "avgRating", "cancelRate"]);
const aggregate = (metric, values) => {
  if (!values.length) return 0;
  const sum = values.reduce((total, value) => total + value, 0);
  if (metric === "avgOrder" || metric === "avgRating") return sum / values.length;
  if (metric === "cancelRate") return (sum / values.length) * 100;
  return sum;
};

const weekStart = (day) => { const date = new Date(`${day}T12:00:00Z`); const shift = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - shift); return date.toISOString().slice(0, 10); };
const bucketKey = (group, day) => (group === "day" ? day : group === "week" ? weekStart(day) : day.slice(0, 7));
function timeBuckets(group, from, to) {
  const keys = []; const seen = new Set();
  for (let time = new Date(`${from}T12:00:00Z`).getTime(); time <= new Date(`${to}T12:00:00Z`).getTime(); time += DAY) {
    const key = bucketKey(group, new Date(time).toISOString().slice(0, 10));
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
  }
  return keys;
}
export function bucketLabel(group, key, language) {
  const locale = language === "en" ? "en-US" : "id-ID";
  if (group === "month") return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  const label = new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return group === "week" ? (language === "en" ? `Week of ${label}` : `Minggu ${label}`) : label;
}

// Hitung satu widget untuk periode {from, to} (YYYY-MM-DD) dan filter laporan + filter widget.
export function computeWidget(widget, data, { from, to, storeId = "", category = "" }, language = "id") {
  const metric = METRICS[widget.metric]; if (!metric) return { rows: [], total: 0 };
  const categories = [...(widget.filters?.categories ?? []), ...(category ? [category] : [])];
  const storeIds = [...(widget.filters?.storeIds ?? []), ...(storeId ? [storeId] : [])];
  const inPeriod = (date, start, end) => { if (!date) return false; const day = jakartaDay(date); return day >= start && day <= end; };
  const matches = ({ row }) => (!storeIds.length || storeIds.includes(row.storeId)) && (!categories.length || (row.kind === "item" ? categories.includes(row.category) : row.kind === "order" ? row.categories.some((item) => categories.includes(item)) : true));
  const all = metricRows(widget.metric, data).filter(matches);
  const current = all.filter((entry) => inPeriod(entry.date, from, to));
  const total = aggregate(widget.metric, current.map((entry) => entry.value));
  const length = Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / DAY) + 1;
  const prevTo = new Date(new Date(`${from}T12:00:00Z`).getTime() - DAY).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(`${prevTo}T12:00:00Z`).getTime() - (length - 1) * DAY).toISOString().slice(0, 10);
  const previous = aggregate(widget.metric, all.filter((entry) => inPeriod(entry.date, prevFrom, prevTo)).map((entry) => entry.value));
  if (widget.group === "total") {
    // Tren mini untuk kartu angka: per hari (<= 31 hari), per minggu (<= 6 bulan), atau per bulan.
    const grain = length <= 31 ? "day" : length <= 186 ? "week" : "month";
    const buckets = new Map();
    for (const entry of current) { const key = bucketKey(grain, jakartaDay(entry.date)); buckets.set(key, [...(buckets.get(key) ?? []), entry.value]); }
    const trend = length > 1 ? timeBuckets(grain, from, to).map((key) => aggregate(widget.metric, buckets.get(key) ?? [])) : [];
    return { rows: [], total, previous, trend };
  }
  // Periode panjang dengan pengelompokan per hari/minggu otomatis dibuat lebih kasar (maks ±60 titik) supaya tetap terbaca.
  let timeGroup = widget.group;
  if (isTimeGroup(timeGroup)) {
    if (timeGroup === "day" && timeBuckets("day", from, to).length > 62) timeGroup = "week";
    if (timeGroup === "week" && timeBuckets("week", from, to).length > 60) timeGroup = "month";
  }
  const cyclic = isCyclicGroup(widget.group) ? CYCLIC[widget.group] : null;
  const groups = new Map();
  for (const entry of current) {
    const key = isTimeGroup(widget.group) ? bucketKey(timeGroup, jakartaDay(entry.date)) : cyclic ? cyclic.keyOf(entry.date) : widget.group === "status" ? (STATUS_LABEL[language] ?? STATUS_LABEL.id)[entry.row.status] ?? entry.row.status : entry.row[widget.group] || (language === "en" ? "Not set" : "Belum ada");
    groups.set(key, [...(groups.get(key) ?? []), entry.value]);
  }
  let rows;
  // Rata-rata/persentase tanpa data di satu periode = kosong (null), bukan 0, supaya grafik tidak menyesatkan.
  if (isTimeGroup(widget.group)) rows = timeBuckets(timeGroup, from, to).map((key) => ({ key, label: bucketLabel(timeGroup, key, language), value: AVERAGE_METRICS.has(widget.metric) && !groups.get(key)?.length ? null : aggregate(widget.metric, groups.get(key) ?? []) }));
  else if (cyclic) rows = Array.from({ length: cyclic.count }, (_, index) => ({ key: index, label: cyclic.label(index, language), value: AVERAGE_METRICS.has(widget.metric) && !groups.get(index)?.length ? null : aggregate(widget.metric, groups.get(index) ?? []) }));
  else {
    const sorted = [...groups.entries()].map(([key, values]) => ({ key, label: key, value: aggregate(widget.metric, values), values })).sort((a, b) => b.value - a.value);
    if (widget.view === "share") {
      // Grafik tumpuk memakai maks. 6 warna; sisanya digabung jadi "Lainnya" (hanya untuk angka yang bisa dijumlah).
      const summable = !["avgOrder", "avgRating", "cancelRate"].includes(widget.metric);
      const head = sorted.slice(0, sorted.length > 6 && summable ? 5 : 6);
      const rest = sorted.slice(head.length);
      rows = rest.length && summable ? [...head, { key: "__other", label: language === "en" ? "Other" : "Lainnya", value: aggregate(widget.metric, rest.flatMap((row) => row.values)), other: true }] : head;
    } else rows = sorted.slice(0, widget.limit || 10);
    rows = rows.map(({ values, ...row }) => row); // eslint-disable-line no-unused-vars
  }
  return { rows, total, previous, timeGroup: isTimeGroup(widget.group) ? timeGroup : null, regrouped: timeGroup !== widget.group };
}

export function formatMetric(metricKey, value, { formatCurrency, language }) {
  const metric = METRICS[metricKey]; const locale = language === "en" ? "en-US" : "id-ID";
  if (value === null || value === undefined) return "–";
  if (metric?.money) return formatCurrency(Math.round(value));
  if (metric?.percent) return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  if (metric?.rating) return value ? value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-";
  return Math.round(value).toLocaleString(locale);
}

// Periode cepat → {from, to}.
export function periodRange(key, today = jakartaDay(new Date())) {
  const back = (days) => new Date(new Date(`${today}T12:00:00Z`).getTime() - days * DAY).toISOString().slice(0, 10);
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: back(6), to: today };
  if (key === "1y") return { from: back(364), to: today };
  return { from: back(29), to: today };
}

const widget = (id, title, metric, group, view, size = "half", limit = null) => ({ id, title, metric, group, view, size, limit, filters: { categories: [], storeIds: [] } });
// Laporan bawaan (tidak bisa dihapus; bisa disalin lalu diubah).
export const BUILTIN_REPORTS = [
  { id: "sales", builtin: true, name: { id: "Ringkasan Penjualan", en: "Sales Summary" }, widgets: [widget("k1", { id: "Pendapatan produk", en: "Product revenue" }, "revenue", "total", "kpi"), widget("k2", { id: "Pesanan selesai", en: "Completed orders" }, "completedOrders", "total", "kpi"), widget("k3", { id: "Rata-rata belanja", en: "Average order value" }, "avgOrder", "total", "kpi"), widget("k4", { id: "Tingkat pembatalan", en: "Cancellation rate" }, "cancelRate", "total", "kpi"), widget("w1", { id: "Pendapatan per hari", en: "Revenue per day" }, "revenue", "day", "bar", "full"), widget("w2", { id: "Kategori terlaris", en: "Top categories" }, "revenue", "category", "hbar"), widget("w3", { id: "Lapak teratas", en: "Top stores" }, "revenue", "store", "table"), widget("w4", { id: "Status pesanan", en: "Order status" }, "orders", "status", "share", "full")] },
  { id: "stores", builtin: true, name: { id: "Lapak & Produk", en: "Stores & Products" }, widgets: [widget("k1", { id: "Barang terjual", en: "Items sold" }, "itemsSold", "total", "kpi"), widget("k2", { id: "Jumlah ulasan", en: "Reviews" }, "reviewCount", "total", "kpi"), widget("w1", { id: "Pendapatan per lapak", en: "Revenue per store" }, "revenue", "store", "table"), widget("w2", { id: "Produk terlaris", en: "Best-selling products" }, "itemsSold", "product", "hbar", "half", 10), widget("w3", { id: "Rating per lapak", en: "Rating per store" }, "avgRating", "store", "table", "full")] },
  { id: "delivery", builtin: true, name: { id: "Pengiriman & Kurir", en: "Delivery & Couriers" }, widgets: [widget("k1", { id: "Pesanan selesai", en: "Completed orders" }, "completedOrders", "total", "kpi"), widget("k2", { id: "Pengiriman gagal", en: "Failed deliveries" }, "failedDeliveries", "total", "kpi"), widget("k3", { id: "Ongkir", en: "Delivery fees" }, "deliveryFee", "total", "kpi"), widget("k4", { id: "Tip kurir", en: "Courier tips" }, "courierTip", "total", "kpi"), widget("w1", { id: "Pesanan selesai per kurir", en: "Completed orders per courier" }, "completedOrders", "courier", "hbar"), widget("w2", { id: "Pengiriman per hari", en: "Deliveries per day" }, "completedOrders", "day", "bar"), widget("w3", { id: "Status pesanan", en: "Order status" }, "orders", "status", "share", "full")] },
  { id: "finance", builtin: true, name: { id: "Keuangan Lapak", en: "Store Finance" }, widgets: [widget("k1", { id: "Biaya admin tertagih", en: "Admin fees billed" }, "adminFeeBilled", "total", "kpi"), widget("k2", { id: "Biaya admin terbayar", en: "Admin fees paid" }, "adminFeePaid", "total", "kpi"), widget("k3", { id: "Iuran sukarela", en: "Voluntary contributions" }, "contributions", "total", "kpi"), widget("k4", { id: "PPN", en: "VAT" }, "tax", "total", "kpi"), widget("w1", { id: "Biaya admin per lapak", en: "Admin fees per store" }, "adminFeeBilled", "store", "table"), widget("w2", { id: "Biaya admin per bulan", en: "Admin fees per month" }, "adminFeeBilled", "month", "bar")] },
  { id: "reviews", builtin: true, name: { id: "Ulasan", en: "Reviews" }, widgets: [widget("k1", { id: "Rata-rata rating", en: "Average rating" }, "avgRating", "total", "kpi"), widget("k2", { id: "Jumlah ulasan", en: "Reviews" }, "reviewCount", "total", "kpi"), widget("w1", { id: "Rating per minggu", en: "Rating per week" }, "avgRating", "week", "line", "full"), widget("w2", { id: "Rating per lapak", en: "Rating per store" }, "avgRating", "store", "table", "full")] },
];
export const reportName = (report, language) => (typeof report.name === "string" ? report.name : report.name?.[language] ?? report.name?.id ?? "");
// Judul widget: teks admin (string) atau judul bawaan dua bahasa.
export const widgetTitle = (widget, language) => (typeof widget.title === "string" ? widget.title : widget.title?.[language] ?? widget.title?.id ?? "");
export const newWidgetId = () => `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Tick sumbu Y yang "bersih" (0, 5.000, 10.000, ...).
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw) ?? raw;
  const ticks = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if (ticks.at(-1) < max) ticks.push(ticks.at(-1) + step);
  return ticks;
}

// Angka ringkas untuk sumbu: 12 rb, 1,2 jt (ID) / 12K, 1.2M (EN).
export function compactNumber(value, language) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

// Angka ringkas untuk label di atas batang/titik: Rp 1,2 jt · 4,5 · 12% · 1,3 rb.
export function shortMetric(metricKey, value, language) {
  const metric = METRICS[metricKey]; const locale = language === "en" ? "en-US" : "id-ID";
  if (value === null || value === undefined) return "–";
  if (metric?.rating) return value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (metric?.percent) return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const compact = Math.abs(value) >= 1000 ? compactNumber(value, language) : Math.round(value).toLocaleString(locale);
  return metric?.money ? `${language === "en" ? "IDR" : "Rp"} ${compact}` : compact;
}

// "Sorotan": beberapa kalimat ringkas yang dihitung dari data pada filter aktif, supaya admin desa
// langsung paham tanpa membaca grafik. Memakai ulang computeWidget agar angkanya konsisten dengan widget.
export function buildHighlights(data, { from, to, storeId = "", category = "" }, language = "id", { formatCurrency } = {}) {
  if (!data) return [];
  const scope = { from, to, storeId, category };
  const id = language !== "en";
  const w = (metric, group) => computeWidget({ metric, group, view: group === "total" ? "kpi" : "table", filters: { categories: [], storeIds: [] } }, data, scope, language);
  const fmt = (metric, value) => formatMetric(metric, value, { formatCurrency, language });
  const num = (value) => Number(value).toLocaleString(id ? "id-ID" : "en-US");
  const topRow = (rows) => rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value)[0];
  const out = [];

  const orders = w("orders", "total");
  if (!orders.total) return [];

  const rev = w("revenue", "total");
  if (rev.total > 0) {
    let note = "";
    if (rev.previous > 0) {
      const change = Math.round(((rev.total - rev.previous) / rev.previous) * 100);
      if (Math.abs(change) >= 1) note = id ? ` (${change > 0 ? "naik" : "turun"} ${Math.abs(change)}% dari periode lalu)` : ` (${change > 0 ? "up" : "down"} ${Math.abs(change)}% vs last period)`;
    }
    out.push({ tone: rev.previous > 0 && rev.total < rev.previous ? "warn" : "good", icon: "money", text: (id ? `Pendapatan produk ${fmt("revenue", rev.total)}` : `Product revenue ${fmt("revenue", rev.total)}`) + note });
  }

  const day = topRow(w("orders", "weekday").rows);
  if (day) out.push({ tone: "info", icon: "calendar", text: id ? `Hari tersibuk: ${day.label} (${num(day.value)} pesanan)` : `Busiest day: ${day.label} (${num(day.value)} orders)` });
  const hour = topRow(w("orders", "hour").rows);
  if (hour) out.push({ tone: "info", icon: "clock", text: id ? `Jam tersibuk: ${hour.label}` : `Busiest hour: ${hour.label}` });

  if (!storeId) {
    const store = topRow(w("revenue", "store").rows);
    if (store) out.push({ tone: "info", icon: "store", text: id ? `Lapak teratas: ${store.label} (${fmt("revenue", store.value)})` : `Top store: ${store.label} (${fmt("revenue", store.value)})` });
  }
  const product = topRow(w("itemsSold", "product").rows);
  if (product) out.push({ tone: "info", icon: "box", text: id ? `Produk terlaris: ${product.label} (${num(product.value)} terjual)` : `Best seller: ${product.label} (${num(product.value)} sold)` });

  const cancelRate = w("cancelRate", "total").total;
  if (cancelRate >= 15) out.push({ tone: "warn", icon: "alert", text: id ? `Tingkat pembatalan tinggi: ${fmt("cancelRate", cancelRate)}` : `High cancellation rate: ${fmt("cancelRate", cancelRate)}` });
  const failed = w("failedDeliveries", "total").total;
  if (failed > 0) out.push({ tone: "warn", icon: "alert", text: id ? `${num(failed)} pengiriman gagal pada periode ini` : `${num(failed)} failed deliveries this period` });

  return out.slice(0, 6);
}
