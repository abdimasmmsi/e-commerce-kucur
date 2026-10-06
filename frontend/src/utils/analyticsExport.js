import { METRICS } from "./analytics";

// Ekspor laporan Analytics. Library dimuat hanya saat dipakai supaya bundle utama tetap kecil.
const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const safeName = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "laporan";

export async function exportExcel({ title, periodText, filterText, widgets, orders, language }) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Kucur Local Market";
  const id = language !== "en";
  const money = '"Rp"#,##0';
  const summary = book.addWorksheet(id ? "Ringkasan" : "Summary");
  summary.columns = [{ width: 34 }, { width: 22 }];
  summary.addRows([[title], [id ? "Periode" : "Period", periodText], [id ? "Filter" : "Filters", filterText], []]);
  summary.getRow(1).font = { bold: true, size: 14 };
  const used = new Set([summary.name]);
  for (const widget of widgets) {
    const metric = METRICS[widget.metric];
    if (widget.view === "kpi") {
      const row = summary.addRow([widget.title, Math.round(widget.result.total * 100) / 100]);
      if (metric?.money) row.getCell(2).numFmt = money;
      continue;
    }
    let name = widget.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Widget";
    for (let index = 2; used.has(name); index += 1) name = `${name.slice(0, 25)} ${index}`;
    used.add(name);
    const sheet = book.addWorksheet(name);
    sheet.columns = [{ header: id ? "Kelompok" : "Group", width: 32 }, { header: id ? metric?.id : metric?.en, width: 22 }];
    sheet.getRow(1).font = { bold: true };
    for (const row of widget.result.rows) {
      const added = sheet.addRow([row.label, row.value === null || row.value === undefined ? null : Math.round(row.value * 100) / 100]);
      if (metric?.money) added.getCell(2).numFmt = money;
    }
  }
  const raw = book.addWorksheet(id ? "Data pesanan" : "Order data");
  raw.columns = [[id ? "Kode" : "Code", 24], [id ? "Tanggal" : "Date", 20], [id ? "Lapak" : "Store", 28], ["Status", 16], [id ? "Kurir" : "Courier", 20], [id ? "Harga produk" : "Product total", 16], [id ? "Ongkir" : "Delivery fee", 14], [id ? "Tip kurir" : "Courier tip", 12], [id ? "PPN" : "VAT", 12], ["Total", 16]].map(([header, width]) => ({ header, width }));
  raw.getRow(1).font = { bold: true };
  for (const order of orders) {
    const row = raw.addRow([order.code, new Date(order.createdAt), order.store, order.status, order.courier || "", order.productTotal, order.deliveryFee, order.courierTip, order.tax, order.total]);
    row.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
    for (const cell of [6, 7, 8, 9, 10]) row.getCell(cell).numFmt = money;
  }
  const buffer = await book.xlsx.writeBuffer();
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `kucur-${safeName(title)}.xlsx`);
}

// PDF digambar langsung (teks, kotak, batang), bukan tangkapan layar: rapi di kertas dan tidak tergantung CSS.
export async function exportPdf({ title, periodText, filterText, widgets, orientation = "landscape", letterhead = true, language, format }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14; const width = pageWidth - margin * 2; let y = margin;
  const green = [35, 128, 58]; const ink = [23, 32, 26]; const muted = [87, 97, 90]; const line = [225, 228, 220];
  const ensure = (height) => { if (y + height > pageHeight - margin) { pdf.addPage(); y = margin; } };
  const text = (value, x, top, { size = 10, bold = false, color = ink, align = "left", maxWidth } = {}) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(...color); pdf.text(String(value).replace(/[\u00a0\u202f]/g, " ").replace(/[\u2013\u2014]/g, "-"), x, top, { align, maxWidth }); };
  const fmt = (widget, value) => format(widget.metric, value);
  if (letterhead) {
    text(language === "en" ? "Kucur Tourism Village Management" : "Pengelola Desa Wisata Kucur", margin, y + 5, { size: 13, bold: true });
    text("Kucur Local Market", margin, y + 10, { size: 9, color: muted });
    pdf.setDrawColor(23, 63, 41); pdf.setLineWidth(0.6); pdf.line(margin, y + 13, pageWidth - margin, y + 13); y += 19;
  }
  text(title, margin, y + 5, { size: 16, bold: true }); text(`${periodText} | ${filterText}`, margin, y + 11, { size: 9, color: muted }); y += 18;
  const kpis = widgets.filter((widget) => widget.view === "kpi");
  if (kpis.length) {
    const columns = Math.min(kpis.length, orientation === "landscape" ? 4 : 2); const boxWidth = (width - (columns - 1) * 4) / columns;
    kpis.forEach((widget, index) => {
      const column = index % columns; if (column === 0) ensure(22);
      const x = margin + column * (boxWidth + 4);
      pdf.setDrawColor(...line); pdf.setLineWidth(0.3); pdf.roundedRect(x, y, boxWidth, 20, 2, 2);
      text(widget.title, x + 4, y + 7, { size: 8.5, color: muted, maxWidth: boxWidth - 8 }); text(fmt(widget, widget.result.total), x + 4, y + 15, { size: 13, bold: true });
      if (column === columns - 1 || index === kpis.length - 1) y += 25;
    });
  }
  for (const widget of widgets.filter((item) => item.view !== "kpi")) {
    const rows = widget.result.rows; const max = Math.max(...rows.map((row) => row.value), 0);
    ensure(20); text(widget.title, margin, y + 5, { size: 12, bold: true }); y += 9;
    if (!rows.length || !max) { text(language === "en" ? "No data for this period." : "Belum ada data pada periode ini.", margin, y + 4, { size: 9, color: muted }); y += 10; continue; }
    if (["bar", "line"].includes(widget.view)) {
      const chartHeight = 40; ensure(chartHeight + 12);
      const barWidth = width / rows.length;
      rows.forEach((row, index) => { const height = (row.value / max) * chartHeight; pdf.setFillColor(...(index === rows.length - 1 ? green : [159, 207, 166])); pdf.rect(margin + index * barWidth + 0.3, y + chartHeight - height, Math.max(barWidth - 0.6, 0.4), height, "F"); });
      pdf.setDrawColor(...line); pdf.line(margin, y + chartHeight, margin + width, y + chartHeight);
      text(rows[0].label, margin, y + chartHeight + 5, { size: 8, color: muted }); text(rows[rows.length - 1].label, margin + width, y + chartHeight + 5, { size: 8, color: muted, align: "right" });
      text(`${language === "en" ? "Highest" : "Tertinggi"}: ${fmt(widget, max)}`, margin + width / 2, y + chartHeight + 5, { size: 8, color: muted, align: "center" });
      y += chartHeight + 11; continue;
    }
    const sum = rows.reduce((total, row) => total + row.value, 0) || 1;
    for (const row of rows) {
      ensure(8);
      text(row.label, margin, y + 4, { size: 9.5, maxWidth: width * 0.4 });
      if (widget.view !== "table") { pdf.setFillColor(236, 238, 232); pdf.rect(margin + width * 0.42, y + 1.2, width * 0.36, 3.2, "F"); pdf.setFillColor(...green); pdf.rect(margin + width * 0.42, y + 1.2, width * 0.36 * (row.value / max), 3.2, "F"); }
      text(widget.view === "share" ? `${fmt(widget, row.value)} (${Math.round((row.value / sum) * 100)}%)` : fmt(widget, row.value), margin + width, y + 4, { size: 9.5, bold: true, align: "right" });
      pdf.setDrawColor(...line); pdf.line(margin, y + 6.2, margin + width, y + 6.2); y += 7.5;
    }
    y += 5;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) { pdf.setPage(page); text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 6, { size: 8, color: muted, align: "right" }); }
  pdf.save(`kucur-${safeName(title)}.pdf`);
}
