import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { getProductTotalStock, productService } from "../../services/productService";

const stockInputs = (product) => product?.hasVariants
  ? Object.fromEntries(product.variants.map((variant) => [variant.id, String(variant.stock)]))
  : { product: String(product?.stock ?? 0) };

export default function StockManagement() {
  const { storeId: routeStoreId } = useParams();
  const storeId = canonicalStoreId(routeStoreId);
  const { errorMessage, t } = usePreferences();
  const [products, setProducts] = useState([]); const [selectedId, setSelectedId] = useState("");
  const [stockValues, setStockValues] = useState({}); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const stockLabel = (stock) => t(stock <= 0 ? "stockManagement.out" : stock <= 5 ? "stockManagement.low" : "stockManagement.available");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const rows = await productService.list({ storeId, scope: "manage" });
      setProducts(rows.filter((product) => product.storeId === storeId));
      const next = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
      setSelectedId(next?.id ?? ""); setStockValues(stockInputs(next));
    } catch (caught) { setError(errorMessage(caught.code, t("stockManagement.updateFailed"))); }
    finally { setLoading(false); }
  };
  useEffect(() => { queueMicrotask(() => void load()); }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => products.find((row) => row.id === selectedId) ?? null, [products, selectedId]);
  // Muat ulang diam-diam: hanya daftar produk yang diganti; isian stok yang sedang diubah tidak ditimpa
  // (pembaruan ditahan selama isian berbeda dari data tersimpan atau sedang menyimpan).
  const stockDirty = Boolean(selected) && JSON.stringify(stockValues) !== JSON.stringify(stockInputs(selected));
  useLiveRefresh(
    () => productService.list({ storeId, scope: "manage" }).then((rows) => setProducts(rows.filter((product) => product.storeId === storeId))),
    { enabled: !loading && !saving && !stockDirty },
  );
  const save = async (event) => {
    event.preventDefault();
    if (!selected || saving) return;
    const values = Object.values(stockValues).map(Number);
    if (values.some((value) => !Number.isInteger(value) || value < 0)) return setError(t("stockManagement.invalid"));
    setSaving(true); setError(""); setNotice("");
    try {
      const input = selected.hasVariants
        ? { variants: selected.variants.map((variant) => ({ ...variant, stock: Number(stockValues[variant.id]) })) }
        : { stock: Number(stockValues.product) };
      const updated = await productService.update(selected.id, input);
      setProducts((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setNotice(t("stockManagement.saved", { name: updated.name }));
    } catch (caught) { setError(errorMessage(caught.code, t("stockManagement.updateFailed"))); }
    finally { setSaving(false); }
  };
  return <div className="merchant-standard-page space-y-5">
    <header><h1 className="text-2xl font-extrabold">{t("stockManagement.title")}</h1><p className="text-[var(--kucur-text-muted)]">{t("stockManagement.subtitle")}</p></header>
    {loading && <LoadingPanel label={t("stockManagement.loading")} rows={4} />}
    {error && <section className="grid gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert"><strong>{t("stockManagement.updateFailed")}</strong><span className="break-words">{error}</span>{!products.length && <button className="min-h-11 w-fit rounded-xl border border-current px-4 font-bold" type="button" onClick={load}>{t("stockManagement.retry")}</button>}</section>}
    {notice && <p className="merchant-status-feedback rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">{notice}</p>}
    {!loading && !products.length && !error && <EmptyState title={t("stockManagement.empty")} description={t("stockManagement.emptyHint")} />}
    {!loading && products.length > 0 && <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(240px,.7fr)_minmax(0,1.3fr)]">
      <section className="grid min-w-0 content-start gap-2 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" aria-label={t("stockManagement.productList")}><h2 className="mb-2 text-lg font-bold">{t("stockManagement.selectProduct")}</h2>{products.map((product) => { const total = getProductTotalStock(product); return <button className={`flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left ${selectedId === product.id ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-[var(--kucur-border)]"}`} type="button" onClick={() => { setSelectedId(product.id); setStockValues(stockInputs(product)); setError(""); setNotice(""); }} key={product.id}><span className="min-w-0"><strong className="block truncate">{product.name}</strong><small className="text-[var(--kucur-text-muted)]">{stockLabel(total)}</small></span><b>{total}</b></button>; })}</section>
      {selected && <form className="grid min-w-0 content-start gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" onSubmit={save}><div><h2 className="break-words text-xl font-bold">{selected.name}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{t("stockManagement.helper")}</p></div>{selected.hasVariants ? <div className="grid gap-3 sm:grid-cols-2">{selected.variants.map((variant) => <label className="grid min-w-0 gap-1.5" key={variant.id}><span className="break-words font-semibold">{Object.values(variant.options).join(" \u00B7 ") || variant.sku}</span><input className="min-h-11 min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3" type="number" min="0" step="1" required value={stockValues[variant.id] ?? ""} onChange={(event) => setStockValues((current) => ({ ...current, [variant.id]: event.target.value }))} /></label>)}</div> : <label className="grid gap-1.5"><span className="font-semibold">{t("stockManagement.availableAmount")}</span><input className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3" type="number" min="0" step="1" required value={stockValues.product ?? ""} onChange={(event) => setStockValues({ product: event.target.value })} /></label>}<button className="min-h-11 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={saving}>{t(saving ? "stockManagement.saving" : "stockManagement.save")}</button></form>}
    </div>}
  </div>;
}
