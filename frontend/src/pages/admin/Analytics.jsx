import { useEffect, useMemo, useState } from "react";
import AnalyticsWidget from "../../components/admin/AnalyticsWidget";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import { usePreferences } from "../../context/PreferencesContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import { financeService } from "../../services/financeService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import { reviewService } from "../../services/reviewService";
import { BUILTIN_REPORTS, GROUPS, METRICS, VIEWS, WIDGET_HEIGHTS, WIDGET_SIZES, arrangeWidgets, buildDatasets, buildHighlights, computeWidget, formatMetric, groupsFor, nearestSize, newWidgetId, periodRange, reportName, shiftSize, sizeOf, viewsFor, widgetTitle } from "../../utils/analytics";
import "./Analytics.css";
import { exportExcel, exportPdf } from "../../utils/analyticsExport";

const copyByLanguage = {
  id: {
    highlights: "Sorotan", bigger: "Perbesar widget", smaller: "Perkecil widget", autoLayout: "Rapikan otomatis", autoOn: "Tata letak otomatis aktif", autoOff: "Ukuran diatur manual", autoHint: "Widget dibagi otomatis supaya tiap baris penuh. Mengubah ukuran manual mematikannya sementara.", chartHeight: "Tinggi grafik", heights: { short: "Pendek", normal: "Normal", tall: "Tinggi" }, sizes: { quarter: "Kecil (¼ lebar)", third: "Sedang (⅓ lebar)", half: "Setengah (½ lebar)", twothirds: "Lebar (⅔ lebar)", full: "Penuh" }, fullscreen: "Layar penuh", exitFullscreen: "Tutup layar penuh", title: "Analitik & Laporan", description: "Susun laporan sendiri dari data penjualan, pengiriman, ulasan, dan keuangan lapak, lalu unduh sebagai PDF atau Excel.",
    builtin: "Laporan bawaan", mine: "Laporan saya", newReport: "+ Laporan baru", report: "Laporan", edit: "Ubah laporan", exportLabel: "Ekspor", loading: "Memuat data laporan",
    periods: { today: "Hari ini", "7d": "7 hari", "30d": "30 hari", "1y": "1 tahun", custom: "Pilih tanggal" }, from: "Dari", to: "Sampai", allStores: "Semua lapak", allCategories: "Semua kategori", store: "Lapak", category: "Kategori",
    empty: "Belum ada data pada periode ini.", editing: "Mode edit", reportName: "Nama laporan", cancel: "Batal", save: "Simpan", saving: "Menyimpan...", saveCopy: "Simpan sebagai laporan baru", remove: "Hapus laporan", copySuffix: "(salinan)",
    addWidget: "Tambah widget", addHint: "Ketuk untuk menambah ke laporan.", dragHint: "Seret untuk memindah", done: "Selesai", emptyReport: "Laporan masih kosong. Tambahkan widget dari panel kiri.", configure: "Atur", up: "Naik", down: "Turun", delete: "Hapus widget", settingsTitle: "Atur widget", pickWidget: "Pilih widget untuk mengatur isinya.",
    widgetTitle: "Judul", metric: "Data", group: "Dikelompokkan per", view: "Tampilan", size: "Ukuran", half: "Setengah lebar", full: "Lebar penuh", limit: "Jumlah baris", widgetCategory: "Filter kategori",
    saved: "Laporan tersimpan.", removed: "Laporan dihapus.", removeTitle: "Hapus laporan ini?", removeText: "Susunan laporan dihapus. Data asli tidak terpengaruh.", needWidget: "Tambahkan minimal satu widget.",
    exportTitle: "Ekspor laporan", format: "Format", pdfHint: "Siap cetak atau dikirim.", excelHint: "Untuk diolah lagi; angka tetap angka.", include: "Isi yang diekspor", orientation: "Orientasi kertas", landscape: "Mendatar (A4)", portrait: "Tegak (A4)", letterhead: "Pakai kop Pengelola Desa Wisata Kucur", excelNote: "Satu sheet per widget, ditambah sheet Data pesanan sesuai periode dan filter.", download: "Unduh", preparing: "Menyiapkan file...", noFilter: "Tanpa filter",
    presets: { kpi: "Angka ringkas", bar: "Grafik batang", line: "Grafik garis", hbar: "Batang horizontal", table: "Tabel", share: "Batang bertumpuk" },
  },
  en: {
    highlights: "Highlights", bigger: "Make widget bigger", smaller: "Make widget smaller", autoLayout: "Auto arrange", autoOn: "Auto layout on", autoOff: "Sizes set manually", autoHint: "Widgets are split automatically so every row is full. Resizing by hand turns it off for now.", chartHeight: "Chart height", heights: { short: "Short", normal: "Normal", tall: "Tall" }, sizes: { quarter: "Small (¼ width)", third: "Medium (⅓ width)", half: "Half (½ width)", twothirds: "Wide (⅔ width)", full: "Full" }, fullscreen: "Full screen", exitFullscreen: "Close full screen", title: "Analytics & Reports", description: "Build your own reports from sales, delivery, review, and store finance data, then download them as PDF or Excel.",
    builtin: "Built-in reports", mine: "My reports", newReport: "+ New report", report: "Report", edit: "Edit report", exportLabel: "Export", loading: "Loading report data",
    periods: { today: "Today", "7d": "7 days", "30d": "30 days", "1y": "1 year", custom: "Pick dates" }, from: "From", to: "To", allStores: "All stores", allCategories: "All categories", store: "Store", category: "Category",
    empty: "No data for this period yet.", editing: "Edit mode", reportName: "Report name", cancel: "Cancel", save: "Save", saving: "Saving...", saveCopy: "Save as new report", remove: "Delete report", copySuffix: "(copy)",
    addWidget: "Add widget", addHint: "Tap to add it to the report.", dragHint: "Drag to move", done: "Done", emptyReport: "This report is empty. Add widgets from the left panel.", configure: "Configure", up: "Up", down: "Down", delete: "Delete widget", settingsTitle: "Configure widget", pickWidget: "Pick a widget to configure it.",
    widgetTitle: "Title", metric: "Data", group: "Grouped by", view: "Display", size: "Size", half: "Half width", full: "Full width", limit: "Rows", widgetCategory: "Category filter",
    saved: "Report saved.", removed: "Report deleted.", removeTitle: "Delete this report?", removeText: "The report layout is removed. The underlying data is not affected.", needWidget: "Add at least one widget.",
    exportTitle: "Export report", format: "Format", pdfHint: "Ready to print or send.", excelHint: "For further processing; numbers stay numbers.", include: "Include", orientation: "Paper orientation", landscape: "Landscape (A4)", portrait: "Portrait (A4)", letterhead: "Use the Kucur Tourism Village letterhead", excelNote: "One sheet per widget, plus an Order data sheet for the period and filters.", download: "Download", preparing: "Preparing file...", noFilter: "No filters",
    presets: { kpi: "Number", bar: "Bar chart", line: "Line chart", hbar: "Horizontal bars", table: "Table", share: "Stacked bar" },
  },
};
const PRESETS = { kpi: ["revenue", "total"], bar: ["revenue", "day"], line: ["completedOrders", "week"], hbar: ["revenue", "category"], table: ["revenue", "store"], share: ["orders", "status"] };
const field = "min-h-11 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[15px] text-[var(--kucur-text)]";
// Grid 12 kolom. Ukuran dipilih untuk layar lebar (lg); di tablet/HP kolom menyesuaikan sendiri.
// Kartu angka selalu 2 per baris di HP; widget lain satu per baris di HP dan dua per baris di tablet.
// Deret kartu angka berjumlah ganjil: kartu terakhir dibuat selebar layar di HP supaya tidak menyisakan lubang.
const kpiOdd = (widgets, index) => {
  if (widgets[index]?.view !== "kpi" || widgets[index + 1]?.view === "kpi") return false;
  let start = index; while (start > 0 && widgets[start - 1].view === "kpi") start -= 1;
  return (index - start + 1) % 2 === 1;
};
const SPAN = {
  card: { quarter: "col-span-6 lg:col-span-3", third: "col-span-6 lg:col-span-4", half: "col-span-12 md:col-span-6", twothirds: "col-span-12 lg:col-span-8", full: "col-span-12" },
  chart: { quarter: "col-span-12 md:col-span-6 lg:col-span-3", third: "col-span-12 md:col-span-6 lg:col-span-4", half: "col-span-12 lg:col-span-6", twothirds: "col-span-12 lg:col-span-8", full: "col-span-12" },
};
const spanClass = (widget) => SPAN[widget.view === "kpi" ? "card" : "chart"][sizeOf(widget)];

export default function AdminAnalytics() {
  const { formatCurrency, formatDate, language, t } = usePreferences();
  const lang = language === "en" ? "en" : "id";
  const copy = copyByLanguage[lang];
  const { settings, updateSettings } = useSystemSettings();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("sales");
  const [period, setPeriod] = useState("30d");
  const [custom, setCustom] = useState(() => periodRange("30d"));
  const [storeId, setStoreId] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState(null);
  const [activeWidget, setActiveWidget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([orderService.list({ scope: "admin" }), productService.list(), reviewService.admin().catch(() => []), financeService.monitor().catch(() => ({}))])
      .then(([orders, products, reviews, finance]) => { if (active) setData(buildDatasets({ orders, products, reviews: Array.isArray(reviews) ? reviews : reviews?.items ?? [], finance })); })
      .catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);

  const customReports = useMemo(() => (Array.isArray(settings?.analyticsReports) ? settings.analyticsReports : []), [settings]);
  const report = draft ?? [...BUILTIN_REPORTS, ...customReports].find((item) => item.id === selectedId) ?? BUILTIN_REPORTS[0];
  const range = period === "custom" ? custom : periodRange(period);
  const format = useMemo(() => ({ formatCurrency, language: lang }), [formatCurrency, lang]);
  const results = useMemo(() => (data ? report.widgets.map((widget) => computeWidget(widget, data, { ...range, storeId, category }, lang)) : []), [category, data, lang, range.from, range.to, report, storeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodText = `${formatDate(`${range.from}T12:00:00`, { dateStyle: "medium" })} – ${formatDate(`${range.to}T12:00:00`, { dateStyle: "medium" })}`;
  const highlights = useMemo(() => (data && !draft ? buildHighlights(data, { ...range, storeId, category }, lang, { formatCurrency }) : []), [category, data, draft, formatCurrency, lang, range.from, range.to, storeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterText = [storeId && data?.stores.find((item) => item.id === storeId)?.name, category].filter(Boolean).join(", ") || copy.noFilter;

  const startEdit = (source, asNew) => {
    setMessage({ type: "", text: "" });
    // Tata letak otomatis hanya aktif bila laporan memang sudah rapi (atau baru dibuat); susunan manual milik admin tidak diacak.
    const arranged = arrangeWidgets(source.widgets).every((item, index) => item.size === sizeOf(source.widgets[index]));
    setDraft({ id: asNew ? `r-${Date.now().toString(36)}` : source.id, isNew: asNew, autoLayout: asNew || arranged, name: asNew && source.widgets.length ? `${reportName(source, lang)} ${copy.copySuffix}` : reportName(source, lang), widgets: source.widgets.map((widget) => ({ ...widget, title: widgetTitle(widget, lang), filters: { categories: [...(widget.filters?.categories ?? [])], storeIds: [...(widget.filters?.storeIds ?? [])] } })) });
    setActiveWidget(0);
  };
  const withLayout = (value, widgets) => ({ ...value, widgets: value.autoLayout ? arrangeWidgets(widgets) : widgets });
  const updateWidget = (index, patch) => setDraft((value) => ({ ...value, autoLayout: patch.size ? false : value.autoLayout, widgets: value.widgets.map((widget, position) => {
    if (position !== index) return widget;
    const next = { ...widget, ...patch };
    if (!groupsFor(next.metric).includes(next.group)) next.group = groupsFor(next.metric)[0];
    if (!viewsFor(next.group).includes(next.view)) next.view = viewsFor(next.group)[0];
    return next;
  }) }));
  const addWidget = (view) => { const [metric, group] = PRESETS[view]; setDraft((value) => withLayout(value, [...value.widgets, { id: newWidgetId(), title: copy.presets[view], metric, group, view, size: view === "kpi" ? "quarter" : "half", height: "normal", limit: null, filters: { categories: [], storeIds: [] } }])); setActiveWidget(draft.widgets.length); setSheetOpen(true); };
  const moveWidget = (index, delta) => setDraft((value) => { const widgets = [...value.widgets]; const target = index + delta; if (target < 0 || target >= widgets.length) return value; [widgets[index], widgets[target]] = [widgets[target], widgets[index]]; setActiveWidget(target); return withLayout(value, widgets); });
  const removeWidget = (index) => { setDraft((value) => withLayout(value, value.widgets.filter((_, position) => position !== index))); setActiveWidget(0); };
  const resizeWidget = (index, delta) => updateWidget(index, { size: shiftSize(sizeOf(draft.widgets[index]), delta) });
  const arrangeNow = () => setDraft((value) => ({ ...value, autoLayout: true, widgets: arrangeWidgets(value.widgets) }));
  // Tarik tepi kanan widget (laptop): lebar mengikuti pointer, dibulatkan ke ukuran terdekat.
  const startResize = (event, index) => {
    event.preventDefault(); event.stopPropagation();
    const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
    const card = handle.parentElement; const grid = card.parentElement;
    const move = (moveEvent) => {
      const gridBox = grid.getBoundingClientRect(); const cardBox = card.getBoundingClientRect();
      const columns = ((moveEvent.clientX - cardBox.left) / gridBox.width) * 12;
      const size = nearestSize(columns);
      setDraft((value) => (sizeOf(value.widgets[index]) === size ? value : { ...value, autoLayout: false, widgets: value.widgets.map((item, position) => (position === index ? { ...item, size } : item)) }));
    };
    const stop = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); handle.removeEventListener("pointercancel", stop); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop);
  };
  const persist = async (reports) => { setBusy(true); try { await updateSettings({ analyticsReports: reports }); return true; } catch (caught) { setMessage({ type: "error", text: caught.message }); return false; } finally { setBusy(false); } };
  const saveDraft = async (asNew = false) => {
    if (!draft.widgets.length) return setMessage({ type: "error", text: copy.needWidget });
    const id = asNew ? `r-${Date.now().toString(36)}` : draft.id;
    const entry = { id, name: draft.name.trim() || copy.newReport, widgets: draft.widgets.map((widget) => ({ ...widget, size: sizeOf(widget), title: String(widget.title).trim() || METRICS[widget.metric][lang] })) };
    const list = asNew || draft.isNew ? [...customReports, entry] : customReports.map((item) => (item.id === id ? entry : item));
    if (await persist(list)) { setDraft(null); setSelectedId(id); setMessage({ type: "success", text: copy.saved }); }
  };
  const removeReport = async () => { if (await persist(customReports.filter((item) => item.id !== draft.id))) { setDraft(null); setSelectedId("sales"); setConfirmRemove(false); setMessage({ type: "success", text: copy.removed }); } };
  const runExport = async () => {
    setBusy(true);
    try {
      const chosen = report.widgets.map((widget, index) => ({ ...widget, title: widgetTitle(widget, lang), result: results[index] })).filter((_, index) => exporting.include[index]);
      const options = { title: reportName(report, lang), periodText, filterText, widgets: chosen, language: lang };
      if (exporting.format === "pdf") await exportPdf({ ...options, orientation: exporting.orientation, letterhead: exporting.letterhead, format: (metric, value) => formatMetric(metric, value, format) });
      else await exportExcel({ ...options, orders: data.orderRows.filter((row) => { const day = String(row.createdAt).slice(0, 10); return day >= range.from && day <= range.to && (!storeId || row.storeId === storeId); }) });
      setExporting(null);
    } catch (caught) { setMessage({ type: "error", text: caught.message }); }
    finally { setBusy(false); }
  };

  const reportButton = (item) => { const on = !draft && item.id === selectedId; return <button className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${on ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] font-extrabold text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border)] bg-[var(--kucur-surface)] font-semibold hover:border-[var(--kucur-border-strong)]"}`} type="button" aria-pressed={on} key={item.id} onClick={() => { setDraft(null); setSelectedId(item.id); }}>{reportName(item, lang)}</button>; };
  // Mode edit: widget bisa digeser (seret di laptop, atau tombol naik/turun) dan diketuk untuk diatur.
  const [dragIndex, setDragIndex] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Layar penuh: laporan menutupi seluruh layar (menu & header disembunyikan), Esc untuk keluar.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    if (!immersive) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setImmersive(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [immersive]);
  const fullscreen = immersive && !draft;
  const configure = (index) => { setActiveWidget(index); setSheetOpen(true); };
  const dropWidget = (target) => { if (dragIndex === null || dragIndex === target) return setDragIndex(null); setDraft((value) => { const widgets = [...value.widgets]; const [moved] = widgets.splice(dragIndex, 1); widgets.splice(target, 0, moved); return withLayout(value, widgets); }); setActiveWidget(target); setDragIndex(null); };
  const widget = draft?.widgets[activeWidget];
  const settingsFields = !widget ? <p className="mt-2 text-sm text-[var(--kucur-text-muted)]">{copy.pickWidget}</p> : <div className="mt-3 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold">{copy.widgetTitle}<input className={field} maxLength="80" value={widget.title} onChange={(event) => updateWidget(activeWidget, { title: event.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-bold">{copy.metric}<select className={field} value={widget.metric} onChange={(event) => updateWidget(activeWidget, { metric: event.target.value })}>{Object.entries(METRICS).map(([key, item]) => <option value={key} key={key}>{item[lang]}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-bold">{copy.group}<select className={field} value={widget.group} onChange={(event) => updateWidget(activeWidget, { group: event.target.value })}>{groupsFor(widget.metric).map((key) => <option value={key} key={key}>{GROUPS[key][lang]}</option>)}</select></label>
          <fieldset className="grid gap-1.5"><legend className="mb-1.5 text-sm font-bold">{copy.view}</legend><div className="grid grid-cols-3 gap-1.5">{viewsFor(widget.group).map((key) => <button className={`min-h-11 rounded-lg border text-xs font-bold ${widget.view === key ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)]"}`} type="button" aria-pressed={widget.view === key} key={key} onClick={() => updateWidget(activeWidget, { view: key })}>{VIEWS[key][lang]}</button>)}</div></fieldset>
          <label className="grid gap-1.5 text-sm font-bold">{copy.size}<select className={field} value={sizeOf(widget)} onChange={(event) => updateWidget(activeWidget, { size: event.target.value })}>{WIDGET_SIZES.map((key) => <option value={key} key={key}>{copy.sizes[key]}</option>)}</select></label>
          {["bar", "line"].includes(widget.view) && <label className="grid gap-1.5 text-sm font-bold">{copy.chartHeight}<select className={field} value={widget.height ?? "normal"} onChange={(event) => updateWidget(activeWidget, { height: event.target.value })}>{WIDGET_HEIGHTS.map((key) => <option value={key} key={key}>{copy.heights[key]}</option>)}</select></label>}
          {["table", "hbar", "share"].includes(widget.view) && <label className="grid gap-1.5 text-sm font-bold">{copy.limit}<select className={field} value={widget.limit ?? 10} onChange={(event) => updateWidget(activeWidget, { limit: Number(event.target.value) })}>{[5, 10, 15, 20].map((count) => <option value={count} key={count}>{count}</option>)}</select></label>}
          {["item", "order"].includes(METRICS[widget.metric].grain) && <label className="grid gap-1.5 text-sm font-bold">{copy.widgetCategory}<select className={field} value={widget.filters.categories[0] ?? ""} onChange={(event) => updateWidget(activeWidget, { filters: { ...widget.filters, categories: event.target.value ? [event.target.value] : [] } })}><option value="">{copy.allCategories}</option>{data.categories.map((item) => <option key={item}>{item}</option>)}</select></label>}
        </div>;

  return <div className="page-container admin-operations-page analytics-wide min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.adminEyebrow")} title={copy.title} description={copy.description} />
    {message.text && <p className={`mb-4 rounded-xl p-3 text-[15px] font-semibold ${message.type === "error" ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)]"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}
    {!data && !error ? <LoadingPanel label={copy.loading} rows={5} /> : data && <div className="flex flex-wrap gap-5" style={fullscreen ? { animation: "none" } : undefined}>
      {draft && <aside className="w-full min-w-0 shrink-0 self-start lg:sticky lg:top-24 lg:w-72" aria-label={copy.addWidget}>
        <h2 className="text-[15px] font-extrabold">{copy.addWidget}</h2><p className="mb-2 text-[13px] text-[var(--kucur-text-muted)]">{copy.addHint}</p>
        <div className="kucur-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-1 lg:px-0">{Object.keys(PRESETS).map((view) => <button className="min-h-12 shrink-0 whitespace-nowrap rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-3 text-left text-sm font-bold hover:border-[var(--kucur-green)]" type="button" key={view} onClick={() => addWidget(view)}>+ {copy.presets[view]}</button>)}</div>

        <section className="mt-4 hidden rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 lg:block" aria-label={copy.settingsTitle}>
        <h2 className="text-[15px] font-extrabold">{copy.settingsTitle}</h2>
        {settingsFields}
        </section>
      </aside>}

      <main className={fullscreen ? "analytics-immersive fixed inset-0 z-[900] min-w-0 overflow-y-auto bg-[var(--kucur-bg)] p-3 sm:p-6 lg:p-8" : "min-w-0 flex-[999_1_560px]"} id="analytics-report">
        {fullscreen && <div className="mx-auto mb-4 flex max-w-[2400px] items-center justify-between gap-3"><strong className="text-lg font-extrabold">{reportName(report, lang)}</strong><Button variant="secondary" onClick={() => setImmersive(false)}>{copy.exitFullscreen}</Button></div>}
        {!draft && <nav className="kucur-no-scrollbar -mx-1 mb-4 flex items-center gap-2 overflow-x-auto px-1 pb-1" aria-label={copy.report}>
          {BUILTIN_REPORTS.map(reportButton)}
          {customReports.length > 0 && <span className="mx-1 h-6 w-px shrink-0 bg-[var(--kucur-border-strong)]" aria-hidden="true"/>}
          {customReports.map(reportButton)}
          <button className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border-[1.5px] border-dashed border-[var(--kucur-border-strong)] px-4 text-sm font-bold text-[var(--kucur-green-ink)] hover:border-[var(--kucur-green)]" type="button" onClick={() => startEdit({ name: copy.newReport, widgets: [] }, true)}>{copy.newReport}</button>
        </nav>}
        {draft ? <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--kucur-amber)] bg-[var(--kucur-amber-soft)] p-3">
          <span className="self-center rounded-full bg-[var(--kucur-amber)] px-2.5 py-0.5 text-xs font-extrabold text-[#2a1d00]">{copy.editing}</span>
          <span className="self-center text-xs font-semibold text-[var(--kucur-amber-ink)]" title={copy.autoHint}>{draft.autoLayout ? copy.autoOn : copy.autoOff}</span>
          <label className="grid min-w-[14rem] flex-1 gap-1 text-[13px] font-bold">{copy.reportName}<input className={field} maxLength="80" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></label>
          <Button variant="secondary" disabled={busy} onClick={arrangeNow} title={copy.autoHint}>{copy.autoLayout}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>{copy.cancel}</Button>
          {!draft.isNew && <Button variant="secondary" disabled={busy} onClick={() => setConfirmRemove(true)}>{copy.remove}</Button>}
          {!draft.isNew && <Button variant="secondary" disabled={busy} onClick={() => saveDraft(true)}>{copy.saveCopy}</Button>}
          <Button disabled={busy} onClick={() => saveDraft(false)}>{busy ? copy.saving : copy.save}</Button>
        </div> : <div className="mb-3 flex flex-wrap items-end gap-2">
          <h2 className="min-w-0 flex-1 text-xl font-extrabold tracking-[-0.02em] max-sm:basis-full sm:text-2xl">{reportName(report, lang)}</h2>
          <Button variant="secondary" onClick={() => startEdit(report, Boolean(report.builtin))}>{copy.edit}</Button>
          <Button variant="secondary" onClick={() => setImmersive(true)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span className="max-sm:sr-only">{copy.fullscreen}</span></Button>
          <Button onClick={() => setExporting({ format: "pdf", orientation: "landscape", letterhead: true, include: report.widgets.map(() => true) })}>{copy.exportLabel}</Button>
        </div>}

        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-3 sm:p-4">
          <div className="kucur-no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[var(--kucur-surface-elevated)] p-1" role="group" aria-label={copy.periods.custom}>{Object.entries(copy.periods).map(([key, label]) => <button className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-sm transition-colors ${period === key ? "bg-[var(--kucur-surface)] font-extrabold text-[var(--kucur-green-ink)] shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "font-semibold text-[var(--kucur-text-muted)] hover:text-[var(--kucur-text)]"}`} type="button" aria-pressed={period === key} key={key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
          {period === "custom" && <div className="flex flex-wrap gap-2"><label className="grid gap-1 text-[13px] font-bold">{copy.from}<input className={field} type="date" value={custom.from} max={custom.to} onChange={(event) => event.target.value && setCustom((value) => ({ ...value, from: event.target.value }))} /></label><label className="grid gap-1 text-[13px] font-bold">{copy.to}<input className={field} type="date" value={custom.to} min={custom.from} onChange={(event) => event.target.value && setCustom((value) => ({ ...value, to: event.target.value }))} /></label></div>}
          <label className="grid min-w-[10rem] flex-1 gap-1 text-[13px] font-bold sm:flex-none">{copy.store}<select className={field} value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">{copy.allStores}</option>{data.stores.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="grid min-w-[10rem] flex-1 gap-1 text-[13px] font-bold sm:flex-none">{copy.category}<select className={field} value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{copy.allCategories}</option>{data.categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <span className="w-full text-[13px] text-[var(--kucur-text-muted)]">{periodText}</span>
        </div>

        {highlights.length > 0 && <section className="mb-4 grid gap-2 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-label={copy.highlights}>
          <h2 className="text-sm font-bold text-[var(--kucur-text-muted)]">{copy.highlights}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{highlights.map((item, index) => <li className="flex items-start gap-2.5 text-[15px]" key={index}>
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ${item.tone === "good" ? "bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : item.tone === "warn" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-surface-elevated)] text-[var(--kucur-text-muted)]"}`} aria-hidden="true">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{item.icon === "money" ? <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3"/></> : item.icon === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></> : item.icon === "clock" ? <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> : item.icon === "store" ? <><path d="M4 9h16l-1-4H5z"/><path d="M5 9v10h14V9M9 19v-5h6v5"/></> : item.icon === "box" ? <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></> : <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></>}</svg>
            </span>
            <span className="leading-snug text-[var(--kucur-text)]">{item.text}</span>
          </li>)}</ul>
        </section>}

        <div className={`${fullscreen ? "mx-auto max-w-[2400px] " : ""}grid grid-cols-12 gap-3 sm:gap-4`}>
          {report.widgets.map((item, index) => <div className={`${spanClass(item)} ${kpiOdd(report.widgets, index) ? "max-md:col-span-12" : ""} relative grid min-w-0 content-start gap-1.5 rounded-2xl transition-[outline-color,opacity] ${draft ? `cursor-pointer outline outline-2 outline-offset-2 ${index === activeWidget ? "outline-[var(--kucur-green)]" : "outline-transparent hover:outline-[var(--kucur-border-strong)]"}` : ""} ${dragIndex === index ? "opacity-50" : ""}`} key={item.id}
            draggable={Boolean(draft)} onDragStart={() => setDragIndex(index)} onDragEnd={() => setDragIndex(null)} onDragOver={(event) => { if (draft && dragIndex !== null) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); dropWidget(index); }}
            onClick={draft ? () => configure(index) : undefined}>
            {draft && <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <span className="hidden size-9 cursor-grab place-items-center rounded-lg text-[var(--kucur-text-muted)] lg:grid" title={copy.dragHint} aria-hidden="true"><svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>
              <button className={`min-h-9 min-w-9 rounded-lg border px-2 text-xs font-bold sm:px-2.5 ${index === activeWidget ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)]"}`} type="button" aria-label={copy.configure} onClick={() => configure(index)}><span className="inline-flex items-center gap-1.5"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg><span className="max-sm:sr-only">{copy.configure}</span></span></button>
              <button className="grid size-9 place-items-center rounded-lg border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] disabled:opacity-40" type="button" aria-label={copy.up} title={copy.up} disabled={!index} onClick={() => moveWidget(index, -1)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
              <button className="grid size-9 place-items-center rounded-lg border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] disabled:opacity-40" type="button" aria-label={copy.down} title={copy.down} disabled={index === report.widgets.length - 1} onClick={() => moveWidget(index, 1)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
              <button className="grid size-9 place-items-center rounded-lg border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] disabled:opacity-40" type="button" aria-label={copy.smaller} title={copy.smaller} disabled={sizeOf(item) === WIDGET_SIZES[0]} onClick={() => resizeWidget(index, -1)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
              <button className="grid size-9 place-items-center rounded-lg border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] disabled:opacity-40" type="button" aria-label={copy.bigger} title={copy.bigger} disabled={sizeOf(item) === WIDGET_SIZES.at(-1)} onClick={() => resizeWidget(index, 1)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
              <button className="ml-auto grid size-9 place-items-center rounded-lg border border-rose-300 bg-[var(--kucur-surface)] text-rose-700 dark:border-rose-800 dark:text-rose-300" type="button" aria-label={copy.delete} title={copy.delete} onClick={() => removeWidget(index)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
            </div>}
            {results[index] && <AnalyticsWidget widget={item} title={widgetTitle(item, lang)} result={results[index]} format={format} language={lang} emptyLabel={copy.empty} />}
            {draft && <span className="absolute -right-2 top-1/2 z-10 hidden h-14 w-2.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-[var(--kucur-green)] opacity-60 transition-opacity hover:opacity-100 lg:block" role="presentation" title={`${copy.bigger} / ${copy.smaller}`} draggable={false} onPointerDown={(event) => startResize(event, index)} onClick={(event) => event.stopPropagation()} />}
          </div>)}
          {draft && !report.widgets.length && <p className="col-span-12 rounded-2xl border-[1.5px] border-dashed border-[var(--kucur-border-strong)] p-8 text-center text-sm text-[var(--kucur-text-muted)]">{copy.emptyReport}</p>}
        </div>
      </main>


    </div>}

    {draft && sheetOpen && widget && <div className="kucur-overlay-in fixed inset-0 z-[960] flex items-end bg-slate-950/50 lg:hidden" role="presentation" onClick={() => setSheetOpen(false)}>
      <section className="kucur-dialog-in max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-[var(--kucur-surface)] p-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-[var(--kucur-text)]" role="dialog" aria-modal="true" aria-label={copy.settingsTitle} onClick={(event) => event.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[var(--kucur-border-strong)]" aria-hidden="true"/>
        <div className="flex items-center justify-between gap-3"><h2 className="text-[17px] font-extrabold">{copy.settingsTitle}</h2><Button onClick={() => setSheetOpen(false)}>{copy.done}</Button></div>
        {settingsFields}
      </section>
    </div>}
    <ActionDialog open={Boolean(exporting)} busy={busy} title={copy.exportTitle} description={`${reportName(report, lang)} · ${periodText}`} confirmLabel={busy ? copy.preparing : `${copy.download} ${exporting?.format === "pdf" ? "PDF" : "Excel"}`} cancelLabel={copy.cancel} confirmDisabled={!exporting?.include.some(Boolean)} onCancel={() => setExporting(null)} onConfirm={runExport}>
      {exporting && <>
        <fieldset className="grid gap-2"><legend className="mb-1.5 text-[15px] font-bold">{copy.format}</legend><div className="grid gap-2 sm:grid-cols-2">{[["pdf", "PDF", copy.pdfHint], ["excel", "Excel (.xlsx)", copy.excelHint]].map(([key, label, hint]) => <button className={`grid gap-1 rounded-xl p-3 text-left ${exporting.format === key ? "border-2 border-[var(--kucur-green)] bg-[var(--kucur-green-soft)]" : "border border-[var(--kucur-border-strong)]"}`} type="button" aria-pressed={exporting.format === key} key={key} onClick={() => setExporting((value) => ({ ...value, format: key }))}><strong>{label}</strong><span className="text-[13px] text-[var(--kucur-text-muted)]">{hint}</span></button>)}</div></fieldset>
        <fieldset className="grid gap-1"><legend className="mb-1 text-[15px] font-bold">{copy.include}</legend>{report.widgets.map((item, index) => <label className="flex min-h-10 items-center gap-2.5 text-sm" key={item.id}><input className="size-5 accent-[var(--kucur-green)]" type="checkbox" checked={exporting.include[index]} onChange={() => setExporting((value) => ({ ...value, include: value.include.map((on, position) => (position === index ? !on : on)) }))} />{widgetTitle(item, lang)}</label>)}</fieldset>
        {exporting.format === "pdf" ? <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold">{copy.orientation}<select className={field} value={exporting.orientation} onChange={(event) => setExporting((value) => ({ ...value, orientation: event.target.value }))}><option value="landscape">{copy.landscape}</option><option value="portrait">{copy.portrait}</option></select></label><label className="flex min-h-11 items-center gap-2.5 self-end text-sm font-semibold"><input className="size-5 accent-[var(--kucur-green)]" type="checkbox" checked={exporting.letterhead} onChange={(event) => setExporting((value) => ({ ...value, letterhead: event.target.checked }))} />{copy.letterhead}</label></div> : <p className="rounded-xl bg-[var(--kucur-surface-elevated)] p-3 text-sm">{copy.excelNote}</p>}
      </>}
    </ActionDialog>
    <ActionDialog open={confirmRemove} busy={busy} destructive title={copy.removeTitle} description={copy.removeText} confirmLabel={copy.remove} cancelLabel={copy.cancel} onCancel={() => setConfirmRemove(false)} onConfirm={removeReport} />
  </div>;
}
