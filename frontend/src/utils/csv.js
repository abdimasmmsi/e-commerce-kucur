// Unduh laporan sebagai CSV yang langsung terbuka rapi di Excel (pemisah titik koma + BOM UTF-8, sesuai Excel Indonesia).
const cell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((column) => cell(column.label)).join(";"), ...rows.map((row) => columns.map((column) => cell(column.value(row))).join(";"))];
  const blob = new Blob([String.fromCharCode(0xfeff), lines.join(String.fromCharCode(13, 10))], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const day = (value) => (value ? String(value).slice(0, 10) : "");
const money = (value) => Math.round(Number(value ?? 0));

// Kolom laporan pesanan yang sama untuk admin dan lapak.
export function orderReportColumns(language, statusLabel, { withStore = true } = {}) {
  const id = language === "id";
  return [
    { label: id ? "Kode pesanan" : "Order code", value: (order) => order.orderCode ?? order.orderNumber },
    { label: id ? "Tanggal" : "Date", value: (order) => day(order.createdAt) },
    { label: id ? "Tanggal selesai" : "Completed on", value: (order) => day(order.completedAt) },
    ...(withStore ? [{ label: id ? "Lapak" : "Store", value: (order) => order.storeName ?? order.store?.name }] : []),
    { label: id ? "Pembeli" : "Buyer", value: (order) => order.recipientName ?? order.customerName },
    { label: id ? "Status" : "Status", value: (order) => statusLabel(order.status ?? order.fulfillmentStatus) },
    { label: id ? "Pembayaran" : "Payment", value: (order) => statusLabel(order.paymentStatus) },
    { label: id ? "Produk" : "Items", value: (order) => (order.items ?? []).map((item) => `${item.productName ?? item.productNameSnapshot} x${item.quantity}`).join(", ") },
    { label: id ? "Total produk" : "Product total", value: (order) => money(order.productTotal ?? order.subtotal) },
    { label: "PPN", value: (order) => money(order.taxAmount) },
    { label: id ? "Ongkir" : "Delivery fee", value: (order) => money(order.deliveryFee) },
    { label: id ? "Tip kurir" : "Courier tip", value: (order) => money(order.courierTip) },
    { label: id ? "Total bayar" : "Grand total", value: (order) => money(order.totalAmount ?? order.grandTotal) },
  ];
}

export const reportFileName = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
