import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import ProductImage from "../../components/ProductImage";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import LoadingPanel from "../../components/ui/LoadingPanel";
import EmptyState from "../../components/ui/EmptyState";
import PageContainer from "../../components/ui/PageContainer";
import { usePreferences } from "../../context/PreferencesContext";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import { paginate } from "../../utils/pagination";
import { getProductDisplayPrice, getProductTotalStock, hasLowProductStock, productCategories, productService } from "../../services/productService";

const filterValues = ["all", "active", "inactive", "low-stock"];
const PAGE_SIZE = 12;

function ProductManagement() {
  const { storeId: routeStoreId } = useParams();
  const storeId = canonicalStoreId(routeStoreId);
  const { stores } = useStore();
  const { errorMessage, formatCurrency, t } = usePreferences();
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
  const load = async () => {
    setLoading(true); setError("");
    try { setProducts((await productService.list({ storeId, scope: "manage" })).filter((product) => product.storeId === storeId)); }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    productService.list({ storeId, scope: "manage" })
      .then((rows) => { if (active) setProducts(rows.filter((product) => product.storeId === storeId)); })
      .catch((caught) => { if (active) setError(caught.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId]);
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
  const chipClass = (active) => `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold ${active ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`;
  const fieldClass = "min-h-12 w-full min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]";
  return <PageContainer className="merchant-standard-page merchant-product-management space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">{t("productManagement.title")}</h1><p className="text-[15px] text-[var(--kucur-text-muted)]">{store?.name ?? t("productManagement.activeStore")} · {products.length}</p></div><Link to={`/merchant/stores/${storeId}/products/add`}>{t("productManagement.add")}</Link></header>
    <section className="grid min-w-0 gap-3" aria-label={t("productManagement.filters")}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block"><span className="sr-only">{t("productManagement.search")}</span><svg className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--kucur-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input className={`${fieldClass} !pl-11`} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("productManagement.searchPlaceholder")} /></label>
        <label className="block"><span className="sr-only">{t("productManagement.category")}</span><select className={fieldClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">{t("productManagement.allCategories")}</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{filters.map((item) => <button className={chipClass(status === item.value)} type="button" key={item.value} aria-pressed={status === item.value} onClick={() => changeStatus(item.value)}>{item.label}{item.value !== "all" && counts[item.value] > 0 && <span className="ml-2 rounded-full bg-[var(--kucur-surface-muted)] px-2 text-xs text-[var(--kucur-text)]">{counts[item.value]}</span>}</button>)}</div>
    </section>
    {error && <section role="alert" className="grid gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"><strong>{t("productManagement.loadFailed")}</strong><p>{errorMessage(error.code, t("productManagement.loadFailed"))}</p><button className="w-fit min-h-11 rounded-xl border border-current px-4 font-bold" type="button" onClick={load}>{t("productManagement.retry")}</button></section>}
    {!error && shown.length ? <><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleProducts.map((product) => {
      const stock = getProductTotalStock(product);
      const low = hasLowProductStock(product) || stock <= 0;
      return <article key={product.id} className={`merchant-product-card grid min-w-0 gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-3 ${product.status !== "active" ? "opacity-75" : ""}`}>
        <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-start gap-3">
          <span className="block size-[72px] overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={product} alt="" /></span>
          <div className="grid min-w-0 gap-0.5">
            <strong className="line-clamp-2 text-[15px] leading-snug">{product.name}</strong>
            <span className="text-base font-extrabold">{product.hasVariants ? t("productManagement.startsFrom") : ""}{formatCurrency(getProductDisplayPrice(product))}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className={low ? "font-bold text-amber-700 dark:text-amber-300" : "text-[var(--kucur-text-muted)]"}>{t("productManagement.stock")} {stock}</span>{product.status !== "active" && <StatusBadge status={product.status}/>}</div>
          </div>
        </div>
        <div className="merchant-product-actions grid grid-cols-2 gap-2">
          <Link className="merchant-product-edit inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold" to={`/merchant/stores/${storeId}/products/${product.id}/edit`}>{t("productManagement.edit")}</Link>
          <button className={`merchant-product-status-action inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-bold disabled:opacity-50 ${product.status === "active" ? "is-danger border-[var(--kucur-border-strong)] text-[var(--kucur-text-muted)]" : "border-[var(--kucur-green)] text-[var(--kucur-green-ink)]"}`} type="button" disabled={updatingId === product.id} onClick={() => void toggle(product)}>{updatingId === product.id ? t("productManagement.processing") : t(product.status === "active" ? "productManagement.deactivate" : "productManagement.activate")}</button>
        </div>
      </article>;
    })}</div><Pagination page={page} pageSize={PAGE_SIZE} totalItems={shown.length} onPageChange={setPage}/></> : !error ? <EmptyState title={t(search.trim() || category !== "all" || status !== "all" ? "productManagement.notFound" : "productManagement.empty")} description={t("productManagement.emptyHint")} /> : null}
  </PageContainer>;
}
export default ProductManagement;
