import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import { productStockBadge } from "../../utils/productStock";
import { CustomerEmpty, CustomerLoading, CustomerPage, CustomerPageHeader, CustomerPanel } from "../../components/customer/CustomerUI";
import { usePreferences } from "../../context/PreferencesContext";
import { getProductDisplayPrice, productService } from "../../services/productService";

const controlClass = "min-h-11 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-sm text-[var(--kucur-text)] outline-none transition focus:border-kucur-forest focus:ring-2 focus:ring-kucur-forest/15";

function Products() {
  const [searchParams] = useSearchParams();
  const { formatCurrency, t } = usePreferences();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [category, setCategory] = useState("All");
  const [storeId, setStoreId] = useState("All");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("Featured");

  useEffect(() => {
    let active = true;
    productService.list().then((rows) => { if (active) setProducts(rows); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { queueMicrotask(() => setSearch(searchParams.get("search") ?? "")); }, [searchParams]);

  const activeProducts = useMemo(() => products.filter((product) => product.status === "active"), [products]);
  const stores = useMemo(() => [...new Map(activeProducts.filter((product) => product.store?.type === "product").map((product) => [String(product.store.id), product.store])).values()].sort((a, b) => a.name.localeCompare(b.name)), [activeProducts]);
  const storeMap = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores]);
  const categories = useMemo(() => [...new Set(activeProducts.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [activeProducts]);
  const minimum = minimumPrice === "" ? null : Number(minimumPrice);
  const maximum = maximumPrice === "" ? null : Number(maximumPrice);
  const invalidPriceRange = minimum !== null && maximum !== null && maximum < minimum;
  const rows = useMemo(() => activeProducts.filter((product) => {
    const query = search.trim().toLowerCase();
    const storeName = storeMap.get(String(product.storeId))?.name ?? "";
    const matchesQuery = !query || [product.name, product.category, storeName].some((value) => String(value ?? "").toLowerCase().includes(query));
    const price = getProductDisplayPrice(product);
    return matchesQuery && (category === "All" || product.category === category) && (storeId === "All" || String(product.storeId) === storeId) && !invalidPriceRange && (minimum === null || price >= minimum) && (maximum === null || price <= maximum);
  }).sort((a, b) => {
    if (sort === "Lowest") return getProductDisplayPrice(a) - getProductDisplayPrice(b);
    if (sort === "Highest") return getProductDisplayPrice(b) - getProductDisplayPrice(a);
    if (sort === "Name") return a.name.localeCompare(b.name);
    if (sort === "Newest") return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    return 0;
  }), [activeProducts, category, invalidPriceRange, maximum, minimum, search, sort, storeId, storeMap]);

  const chips = [
    search.trim() && { key: "search", label: `${t("commerce.search")}: ${search.trim()}`, clear: () => setSearch("") },
    category !== "All" && { key: "category", label: category, clear: () => setCategory("All") },
    storeId !== "All" && { key: "store", label: storeMap.get(storeId)?.name, clear: () => setStoreId("All") },
    minimumPrice !== "" && { key: "minimum", label: `${t("catalogFilters.minimumPrice")}: ${formatCurrency(Number(minimumPrice))}`, clear: () => setMinimumPrice("") },
    maximumPrice !== "" && { key: "maximum", label: `${t("catalogFilters.maximumPrice")}: ${formatCurrency(Number(maximumPrice))}`, clear: () => setMaximumPrice("") },
  ].filter(Boolean);
  const reset = () => { setSearch(""); setCategory("All"); setStoreId("All"); setMinimumPrice(""); setMaximumPrice(""); setSort("Featured"); };

  return <CustomerPage className="space-y-6 sm:space-y-8">
    <CustomerPageHeader eyebrow={t("customer.home.localProducts")} title={t("commerce.catalogTitle")} description={t("commerce.catalogDescription")} />
    {!loading && error && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100" role="alert">{t("commerce.loadError", { message: error })}</p>}

    <CustomerPanel className="p-3 sm:p-4">
      <form className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,.8fr)_minmax(170px,.9fr)_minmax(260px,1.15fr)_minmax(160px,.8fr)]" role="search" aria-label={t("catalogFilters.title")} onSubmit={(event) => event.preventDefault()}>
        <label className="grid gap-1.5"><span className="text-xs font-bold text-[var(--kucur-text-muted)]">{t("commerce.search")}</span><input className={controlClass} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("catalogFilters.searchPlaceholder")}/></label>
        <label className="grid gap-1.5"><span className="text-xs font-bold text-[var(--kucur-text-muted)]">{t("commerce.category")}</span><select className={controlClass} value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">{t("catalogFilters.allCategories")}</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-1.5"><span className="text-xs font-bold text-[var(--kucur-text-muted)]">{t("commerce.seller")}</span><select className={controlClass} value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="All">{t("catalogFilters.allMerchants")}</option>{stores.map((store) => <option value={String(store.id)} key={store.id}>{store.name}</option>)}</select></label>
        <fieldset className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2"><legend className="col-span-3 mb-1 text-xs font-bold text-[var(--kucur-text-muted)]">{t("catalogFilters.priceRange")}</legend><input className={controlClass} aria-label={t("catalogFilters.minimumPrice")} type="number" min="0" step="1000" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder={t("catalogFilters.minimumPrice")}/><span className="pb-3 text-[var(--kucur-text-muted)]" aria-hidden="true">–</span><input className={controlClass} aria-label={t("catalogFilters.maximumPrice")} type="number" min="0" step="1000" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder={t("catalogFilters.noLimit")}/></fieldset>
        <label className="grid gap-1.5"><span className="text-xs font-bold text-[var(--kucur-text-muted)]">{t("commerce.sort")}</span><select className={controlClass} value={sort} onChange={(event) => setSort(event.target.value)}><option value="Featured">{t("catalogFilters.recommended")}</option><option value="Newest">{t("catalogFilters.newest")}</option><option value="Lowest">{t("commerce.lowestPrice")}</option><option value="Highest">{t("commerce.highestPrice")}</option><option value="Name">{t("catalogFilters.nameAscending")}</option></select></label>
      </form>
      {invalidPriceRange && <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300" role="alert">{t("catalogFilters.invalidPriceRange")}</p>}
      <div className="mt-3 flex justify-end"><button className="min-h-9 rounded-lg border border-[var(--kucur-border-strong)] px-3 text-xs font-bold text-[var(--kucur-text)] disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={reset} disabled={!chips.length && sort === "Featured"}>{t("catalogFilters.reset")}</button></div>
      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--kucur-border)] pt-4"><p className="text-sm font-semibold text-[var(--kucur-text-muted)]" aria-live="polite">{t("catalogFilters.results", { count: rows.length })}</p>{chips.length > 0 && <div className="flex min-w-0 flex-wrap gap-2">{chips.map((chip) => <button className="inline-flex max-w-full items-center gap-2 rounded-full bg-kucur-sand px-3 py-1.5 text-xs font-bold text-kucur-forest" type="button" onClick={chip.clear} key={chip.key}><span className="truncate">{chip.label}</span><b aria-hidden="true">{"\u00d7"}</b></button>)}</div>}</div>
    </CustomerPanel>

    {loading ? <CustomerLoading label={t("commerce.loadingProducts")} count={8}/> : !error && rows.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{rows.map((product) => <ProductCard key={product.id} product={product} storeName={storeMap.get(String(product.storeId))?.name ?? t("commerce.store")} price={product.hasVariants ? t("commerce.startsFrom", { price: formatCurrency(getProductDisplayPrice(product)) }) : formatCurrency(product.price)} {...productStockBadge(product, t)}/>)}</div> : !error && <CustomerEmpty title={t("commerce.emptyProducts")} description={t("commerce.emptyProductsHint")}/>} 
  </CustomerPage>;
}

export default Products;
