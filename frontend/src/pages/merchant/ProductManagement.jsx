import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { useLiveRefresh } from "../../utils/liveRefresh";
import ProductImage from "../../components/ProductImage";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import LoadingPanel from "../../components/ui/LoadingPanel";
import EmptyState from "../../components/ui/EmptyState";
import ActionDialog from "../../components/ui/ActionDialog";
import { exportProductExcel, parseProductExcel } from "../../utils/productExcel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { usePreferences } from "../../context/PreferencesContext";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import { paginate } from "../../utils/pagination";
import { getProductDisplayPrice, getProductTotalStock, hasLowProductStock, productCategories, productService } from "../../services/productService";

const filterValues = ["all", "active", "inactive", "low-stock"];
const PAGE_SIZE = 12;

// Teks lokal untuk statistik dilihat dan upload massal Excel.
const copyByLanguage = {
  id: {
    views7: "Dilihat 7 hari: {count}", views30: "30 hari: {count}",
    excelTitle: "Unggah banyak produk (Excel)", excelHint: "Untuk produk tanpa variasi. Foto ditambahkan nanti lewat Ubah.",
    template: "Unduh contoh Excel", export: "Unduh Excel", import: "Impor Excel", reading: "Membaca file...",
    excelFailed: "File Excel gagal dibaca. Pastikan formatnya .xlsx dari file contoh.",
    previewTitle: "Periksa impor produk", previewDescription: "Cek ringkasan di bawah sebelum produk disimpan. Impor tidak menghapus produk.",
    created: "Produk baru", updated: "Diubah", unchanged: "Tidak berubah", skipped: "Dilewati",
    errorsTitle: "{count} kesalahan, perbaiki file lalu impor lagi", row: "Baris {row}", skippedTitle: "Dilewati",
    nothing: "Tidak ada perubahan untuk disimpan.", confirm: "Impor {count} produk", cancel: "Batal", close: "Tutup", done: "Selesai",
    progress: "Mengimpor {done}/{total}...", resultTitle: "Impor selesai", resultDescription: "{ok} produk tersimpan.", failedTitle: "{count} baris gagal disimpan",
    inactiveTitle: "Produk belum tampil ke pembeli", inactiveBody: "Lapak ini belum aktif. Bayar cicilan pertama iuran pokok di Keuangan Lapak; setelah Admin mengonfirmasi, produk langsung tampil.", inactiveAction: "Buka Keuangan Lapak",
  },
  en: {
    views7: "Viewed 7 days: {count}", views30: "30 days: {count}",
    excelTitle: "Bulk upload (Excel)", excelHint: "For products without variants. Add photos later with Edit.",
    template: "Download Excel template", export: "Download Excel", import: "Import Excel", reading: "Reading file...",
    excelFailed: "The Excel file could not be read. Make sure it is an .xlsx based on the template.",
    previewTitle: "Review product import", previewDescription: "Check the summary below before the products are saved. Import never deletes products.",
    created: "New products", updated: "Updated", unchanged: "Unchanged", skipped: "Skipped",
    errorsTitle: "{count} errors, fix the file and import again", row: "Row {row}", skippedTitle: "Skipped",
    nothing: "There are no changes to save.", confirm: "Import {count} products", cancel: "Cancel", close: "Close", done: "Done",
    progress: "Importing {done}/{total}...", resultTitle: "Import finished", resultDescription: "{ok} products saved.", failedTitle: "{count} rows could not be saved",
    inactiveTitle: "Products are not visible to buyers yet", inactiveBody: "This store is not active yet. Pay the first membership fee installment in Store Finance; once the Admin confirms it, your products show right away.", inactiveAction: "Open Store Finance",
  },
};
const fill = (text, values) => Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, value), text);

function ProductManagement() {
  const { storeId: routeStoreId } = useParams();
  const storeId = canonicalStoreId(routeStoreId);
  const { stores } = useStore();
  const { errorMessage, formatCurrency, formatNumber, language, t } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const filters = filterValues.map((value) => ({ value, label: t(`productManagement.${value === "low-stock" ? "lowStock" : value}`) }));
  const store = stores.find((item) => String(item.id) === storeId);
  const [params, setParams] = useSearchParams();
  const requested = params.get("status");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState(filterValues.includes(requested) ? requested : "all");
  const [page, setPage] = useState(1);
  const [views, setViews] = useState({});
  const [excelBusy, setExcelBusy] = useState("");
  const [excelError, setExcelError] = useState("");
  const [importState, setImportState] = useState(null);
  const importInput = useRef(null);
  const load = async () => {
    setLoading(true); setError("");
    try {
      setProducts((await productService.list({ storeId, scope: "manage" })).filter((product) => product.storeId === storeId));
      setViews(await productService.storeViews(storeId).catch(() => ({})));
    }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    productService.list({ storeId, scope: "manage" })
      .then((rows) => { if (active) setProducts(rows.filter((product) => product.storeId === storeId)); })
      .catch((caught) => { if (active) setError(caught.message); })
      .finally(() => { if (active) setLoading(false); });
    productService.storeViews(storeId).then((rows) => { if (active) setViews(rows ?? {}); }).catch(() => {});
    return () => { active = false; };
  }, [storeId]);
  // Muat ulang diam-diam: hanya daftar produk & statistik; filter, halaman, dan dialog impor tidak disentuh.
  useLiveRefresh(async () => {
    const rows = await productService.list({ storeId, scope: "manage" });
    setProducts(rows.filter((product) => product.storeId === storeId));
    productService.storeViews(storeId).then((v) => setViews(v ?? {})).catch(() => {});
  }, { enabled: !loading && !updatingId && !excelBusy });
  const downloadExcel = async (template) => {
    setExcelBusy(template ? "template" : "export"); setExcelError("");
    try { await exportProductExcel({ products, storeName: store?.name, language, template }); }
    catch { setExcelError(copy.excelFailed); }
    finally { setExcelBusy(""); }
  };
  const readExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExcelBusy("import"); setExcelError("");
    try { setImportState({ phase: "preview", ...(await parseProductExcel(file, { products, language })) }); }
    catch { setExcelError(copy.excelFailed); }
    finally { setExcelBusy(""); }
  };
  const runImport = async () => {
    const tasks = importState.plan.filter((item) => item.action === "create" || item.action === "update");
    const failed = [];
    let ok = 0;
    setImportState((current) => ({ ...current, phase: "running", done: 0, total: tasks.length }));
    for (const [index, item] of tasks.entries()) {
      try {
        if (item.action === "create") await productService.create({ storeId, ...item.payload, hasVariants: false, images: [], image: "" });
        else await productService.update(item.productId, { ...item.payload, hasVariants: false });
        ok += 1;
      } catch (caught) { failed.push({ row: item.row, message: `${item.name}: ${[errorMessage(caught.code, caught.message), ...Object.values(caught.details ?? {}).filter((value) => typeof value === "string")].join(" ")}` }); }
      setImportState((current) => ({ ...current, done: index + 1 }));
    }
    setImportState((current) => ({ ...current, phase: "done", ok, failed }));
    try { setProducts((await productService.list({ storeId, scope: "manage" })).filter((product) => product.storeId === storeId)); }
    catch (caught) { setError(caught.message); }
  };
  const importCount = importState ? importState.summary.created + importState.summary.updated : 0;
  const categories = useMemo(() => [...new Set([...productCategories, ...products.map((item) => item.category)])], [products]);
  const shown = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase())
    && (category === "all" || product.category === category)
    && (status === "all" || product.status === status || (status === "low-stock" && hasLowProductStock(product)))), [category, products, search, status]);
  const visibleProducts = useMemo(() => paginate(shown, page, PAGE_SIZE), [page, shown]);
  const changeStatus = (value) => {
    setStatus(value); setPage(1); const next = new URLSearchParams(params);
    if (value === "all") next.delete("status"); else next.set("status", value);
    setParams(next, { replace: true });
  };
  const toggle = async (product) => {
    setUpdatingId(product.id); setError("");
    try { const updated = await productService.update(product.id, { status: product.status === "active" ? "inactive" : "active" }); setProducts((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    catch (caught) { setError(caught.message); }
    finally { setUpdatingId(null); }
  };
  const counts = { active: products.filter((item) => item.status === "active").length, inactive: products.filter((item) => item.status !== "active").length, "low-stock": products.filter((item) => hasLowProductStock(item)).length };
  if (loading) return <PageContainer><LoadingPanel label={t("productManagement.loading")} rows={4} /></PageContainer>;
  const chipClass = (active) => `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold ${active ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`;
  const fieldClass = "min-h-11 w-full min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[15px] text-[var(--kucur-text)]";
  return <PageContainer className="merchant-standard-page merchant-product-management space-y-3 sm:space-y-4">
    <PageHeader eyebrow={t("workspace.merchantEyebrow")} title={t("productManagement.title")} description={t("productManagement.subtitle", { store: store?.name ?? t("productManagement.activeStore") })} inlineActions actions={<Link className="primary-button !min-h-11 shrink-0 !px-4 !text-sm" to={`/merchant/stores/${storeId}/products/add`}>{t("productManagement.add")}</Link>} />
    <section className="grid min-w-0 gap-3 border-[var(--kucur-border)] max-sm:-mx-4 max-sm:!max-w-none max-sm:border-y max-sm:bg-[var(--kucur-surface)] max-sm:px-4 max-sm:py-3" aria-label={t("productManagement.filters")}>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-3">
        <label className="relative block"><span className="sr-only">{t("productManagement.search")}</span><svg className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--kucur-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input className={`${fieldClass} !pl-11`} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("productManagement.searchPlaceholder")} /></label>
        <label className="block"><span className="sr-only">{t("productManagement.category")}</span><select className={fieldClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">{t("productManagement.allCategories")}</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">{filters.map((item) => <button className={chipClass(status === item.value)} type="button" key={item.value} aria-pressed={status === item.value} onClick={() => changeStatus(item.value)}>{item.label}{item.value !== "all" && counts[item.value] > 0 && <span className="ml-2 rounded-full bg-[var(--kucur-green-soft)] px-2 text-xs text-[var(--kucur-green-ink)]">{counts[item.value]}</span>}</button>)}</div>
    </section>
    {String(store?.status || "").toLowerCase().replace(/-/g, "_") === "pending_initial_payment" && <section role="status" className="grid gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"><strong>{copy.inactiveTitle}</strong><p>{copy.inactiveBody}</p><Link className="inline-flex min-h-11 w-fit items-center rounded-xl border border-current px-4 font-bold" to={`/merchant/stores/${storeId}/finance`}>{copy.inactiveAction}</Link></section>}
    {error && <section role="alert" className="grid gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"><strong>{t("productManagement.loadFailed")}</strong><p>{errorMessage(error.code, t("productManagement.loadFailed"))}</p><button className="w-fit min-h-11 rounded-xl border border-current px-4 font-bold" type="button" onClick={load}>{t("productManagement.retry")}</button></section>}
    {!error && shown.length ? <><div className="grid gap-2 max-sm:-mx-4 max-sm:!max-w-none sm:gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleProducts.map((product) => {
      const stock = getProductTotalStock(product);
      const low = hasLowProductStock(product) || stock <= 0;
      return <article key={product.id} className={`merchant-product-card grid min-w-0 gap-3 border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 max-sm:border-y sm:rounded-xl sm:border sm:p-3 ${product.status !== "active" ? "opacity-75" : ""}`}>
        <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-3">
          <span className="block size-16 overflow-hidden rounded-lg bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={product} alt="" /></span>
          <div className="grid min-w-0 gap-0.5">
            <strong className="line-clamp-2 text-[15px] leading-snug">{product.name}</strong>
            <span className="text-base font-extrabold">{product.hasVariants ? t("productManagement.startsFrom") : ""}{formatCurrency(getProductDisplayPrice(product))}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className={low ? "font-bold text-amber-700 dark:text-amber-300" : "text-[var(--kucur-text-muted)]"}>{t("productManagement.stock")} {stock}</span>{product.status !== "active" && <StatusBadge status={product.status}/>}</div>
            {views[product.id] && <span className="text-[13px] text-[var(--kucur-text-muted)]">{fill(copy.views7, { count: formatNumber(views[product.id].last7Days ?? 0) })} · {fill(copy.views30, { count: formatNumber(views[product.id].last30Days ?? 0) })}</span>}
          </div>
        </div>
        <div className="merchant-product-actions grid grid-cols-2 gap-2">
          <Link className="merchant-product-edit inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold" to={`/merchant/stores/${storeId}/products/${product.id}/edit`}>{t("productManagement.edit")}</Link>
          <button className={`merchant-product-status-action inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-bold disabled:opacity-50 ${product.status === "active" ? "is-danger border-[var(--kucur-border-strong)] text-[var(--kucur-text-muted)]" : "border-[var(--kucur-green)] text-[var(--kucur-green-ink)]"}`} type="button" disabled={updatingId === product.id} onClick={() => void toggle(product)}>{updatingId === product.id ? t("productManagement.processing") : t(product.status === "active" ? "productManagement.deactivate" : "productManagement.activate")}</button>
        </div>
      </article>;
    })}</div><Pagination page={page} pageSize={PAGE_SIZE} totalItems={shown.length} onPageChange={setPage}/></> : !error ? <EmptyState title={t(search.trim() || category !== "all" || status !== "all" ? "productManagement.notFound" : "productManagement.empty")} description={t("productManagement.emptyHint")} /> : null}
    <section className="grid gap-3 border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 max-sm:-mx-4 max-sm:!max-w-none max-sm:border-y sm:rounded-xl sm:border" aria-labelledby="product-excel-title">
      <div><h2 className="text-base font-extrabold" id="product-excel-title">{copy.excelTitle}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.excelHint}</p></div>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-text)] disabled:opacity-50" type="button" data-no-busy disabled={Boolean(excelBusy)} onClick={() => void downloadExcel(true)}>{copy.template}</button>
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-text)] disabled:opacity-50" type="button" data-no-busy disabled={Boolean(excelBusy) || !products.some((item) => !item.hasVariants)} onClick={() => void downloadExcel(false)}>{copy.export}</button>
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-green)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-green-ink)] disabled:opacity-50" type="button" data-no-busy disabled={Boolean(excelBusy)} onClick={() => importInput.current?.click()}>{excelBusy === "import" ? copy.reading : copy.import}</button>
        <input ref={importInput} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" tabIndex={-1} aria-hidden="true" onChange={(event) => void readExcel(event)} />
      </div>
      {excelError && <p className="text-sm font-bold text-rose-700 dark:text-rose-300" role="alert">{excelError}</p>}
    </section>
    <ActionDialog
      open={Boolean(importState)}
      busy={importState?.phase === "running"}
      title={importState?.phase === "done" ? copy.resultTitle : copy.previewTitle}
      description={importState?.phase === "done" ? fill(copy.resultDescription, { ok: importState.ok }) : copy.previewDescription}
      cancelLabel={importState?.phase === "done" ? copy.close : copy.cancel}
      confirmLabel={importState?.phase === "done" ? copy.done : importState?.phase === "running" ? fill(fill(copy.progress, { done: importState.done }), { total: importState.total }) : fill(copy.confirm, { count: importCount })}
      confirmDisabled={importState?.phase === "preview" && (importState.errors.length > 0 || importCount === 0)}
      onCancel={() => setImportState(null)}
      onConfirm={() => { if (importState?.phase === "done") setImportState(null); else void runImport(); }}
    >
      {importState && <>
        {importState.phase !== "done" && <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{["created", "updated", "unchanged", "skipped"].map((key) => <div className="rounded-xl border border-[var(--kucur-border)] p-3" key={key}><dt className="text-[var(--kucur-text-muted)]">{copy[key]}</dt><dd className="text-lg font-extrabold">{importState.summary[key]}</dd></div>)}</dl>}
        {importState.phase === "running" && <p className="text-sm font-bold text-[var(--kucur-green-ink)]" role="status" aria-live="polite">{fill(fill(copy.progress, { done: importState.done }), { total: importState.total })}</p>}
        {importState.phase === "preview" && importState.errors.length > 0 && <div className="grid gap-2" role="alert"><strong className="text-sm text-rose-700 dark:text-rose-300">{fill(copy.errorsTitle, { count: importState.errors.length })}</strong><ul className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{importState.errors.map((item, index) => <li key={index}><b>{fill(copy.row, { row: item.row })}:</b> {item.message}</li>)}</ul></div>}
        {importState.phase === "preview" && !importState.errors.length && importCount === 0 && <p className="text-sm text-[var(--kucur-text-muted)]">{copy.nothing}</p>}
        {importState.phase !== "done" && importState.skipped.length > 0 && <div className="grid gap-1 text-sm"><strong>{copy.skippedTitle}</strong><ul className="grid max-h-40 gap-1 overflow-y-auto text-[var(--kucur-text-muted)]">{importState.skipped.map((item, index) => <li key={index}>{fill(copy.row, { row: item.row })}: {item.message}</li>)}</ul></div>}
        {importState.phase === "done" && importState.failed.length > 0 && <div className="grid gap-2" role="alert"><strong className="text-sm text-rose-700 dark:text-rose-300">{fill(copy.failedTitle, { count: importState.failed.length })}</strong><ul className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{importState.failed.map((item, index) => <li key={index}><b>{fill(copy.row, { row: item.row })}:</b> {item.message}</li>)}</ul></div>}
      </>}
    </ActionDialog>
  </PageContainer>;
}
export default ProductManagement;
