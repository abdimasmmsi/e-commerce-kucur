import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import ProductImage from "../../components/ProductImage";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import { paginate } from "../../utils/pagination";
import { getProductDisplayPrice, getProductTotalStock, hasLowProductStock, productCategories, productService } from "../../services/productService";

const filterValues = ["all", "active", "inactive", "low-stock"];
const PAGE_SIZE = 12;

function ProductActions({ product, storeId, updating, onToggle, t }) {
  return <div className="merchant-product-actions">
    <Link className="merchant-product-edit" to={`/merchant/stores/${storeId}/products/${product.id}/edit`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m14.7 6.3 3 3M5 19l3.8-.8L19 8a2.1 2.1 0 0 0-3-3L5.8 15.2 5 19Z" /></svg>
      {t("productManagement.edit")}
    </Link>
    <button
      className={`merchant-product-status-action${product.status === "active" ? " is-danger" : ""}`}
      type="button"
      disabled={updating}
      onClick={() => void onToggle(product)}
    >
      {updating ? t("productManagement.processing") : t(product.status === "active" ? "productManagement.deactivate" : "productManagement.activate")}
    </button>
  </div>;
}

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
  if (loading) return <div className="merchant-standard-page"><LoadingPanel label={t("productManagement.loading")} rows={4} /></div>;
  return <div className="merchant-standard-page merchant-product-management space-y-5 [&_button]:rounded-xl [&_button]:border [&_button]:border-[var(--kucur-border-strong)] [&_button]:px-3 [&_button]:py-2 [&_input]:rounded-xl [&_input]:border [&_input]:border-[var(--kucur-border-strong)] [&_input]:px-3 [&_input]:py-2.5 [&_select]:rounded-xl [&_select]:border [&_select]:border-[var(--kucur-border-strong)] [&_select]:px-3 [&_select]:py-2.5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold">{t("productManagement.title")}</h1><p>{t("productManagement.subtitle", { store: store?.name ?? t("productManagement.activeStore") })}</p></div><Link to={`/merchant/stores/${storeId}/products/add`}>{t("productManagement.add")}</Link></header>
    <section className="merchant-standard-toolbar grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] md:items-end" aria-label={t("productManagement.filters")}><label className="grid min-w-0 gap-1"><span>{t("productManagement.search")}</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("productManagement.searchPlaceholder")} /></label><label className="grid min-w-0 gap-1"><span>{t("productManagement.category")}</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">{t("productManagement.allCategories")}</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><div className="merchant-product-filter-chips flex min-w-0 flex-wrap gap-2">{filters.map((item) => <button type="button" key={item.value} aria-pressed={status === item.value} onClick={() => changeStatus(item.value)} className={status === item.value ? "active" : ""}>{item.label}</button>)}</div></section>
    {error && <section role="alert" className="rounded-2xl border border-rose-400 p-4"><strong>{t("productManagement.loadFailed")}</strong><p>{errorMessage(error.code, t("productManagement.loadFailed"))}</p><button type="button" onClick={load}>{t("productManagement.retry")}</button></section>}
    {loading ? <section role="status" className="rounded-2xl border border-[var(--kucur-border)] p-4">{t("productManagement.loading")}</section> : !error && shown.length ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="merchant-product-card grid min-w-0 gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4"><ProductImage className="aspect-square w-full rounded-xl object-cover" product={product} alt={product.name} /><div className="merchant-product-card-heading min-w-0"><div className="min-w-0"><strong className="block truncate">{product.name}</strong><span>{product.category}</span></div><div className="merchant-product-badges"><StatusBadge status={product.status}/>{hasLowProductStock(product) && <StatusBadge status="pending">{t("productManagement.lowStock")}</StatusBadge>}</div></div><dl className="grid grid-cols-2 gap-2"><div><dt>{t("productManagement.price")}</dt><dd>{product.hasVariants ? t("productManagement.startsFrom") : ""}{formatCurrency(getProductDisplayPrice(product))}</dd></div><div><dt>{t("productManagement.stock")}</dt><dd className={hasLowProductStock(product) ? "font-bold text-amber-700" : ""}>{getProductTotalStock(product)}</dd></div></dl><ProductActions product={product} storeId={storeId} updating={updatingId === product.id} onToggle={toggle} t={t} /></article>)}</div><Pagination page={page} pageSize={PAGE_SIZE} totalItems={shown.length} onPageChange={setPage}/></> : !error ? <section className="rounded-2xl border border-[var(--kucur-border)] p-4"><strong>{t(search.trim() || category !== "all" || status !== "all" ? "productManagement.notFound" : "productManagement.empty")}</strong><p>{t("productManagement.emptyHint")}</p></section> : null}
  </div>;
}
export default ProductManagement;
