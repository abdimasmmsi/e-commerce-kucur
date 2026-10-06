import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import { productStockBadge } from "../../utils/productStock";
import { CustomerEmpty, CustomerLoading, CustomerPage } from "../../components/customer/CustomerUI";
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
  // Kategori bisa dipilih lebih dari satu; daftar kosong = semua kategori.
  const [selectedCategories, setSelectedCategories] = useState(() => searchParams.getAll("category").filter(Boolean));
  const toggleCategory = (item) => setSelectedCategories((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const [storeId, setStoreId] = useState("All");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("Featured");

  useEffect(() => {
    let active = true;
    productService.list().then((rows) => { if (active) setProducts(rows); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { queueMicrotask(() => { setSearch(searchParams.get("search") ?? ""); setSelectedCategories(searchParams.getAll("category").filter(Boolean)); }); }, [searchParams]);

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
    return matchesQuery && (!selectedCategories.length || selectedCategories.includes(product.category)) && (storeId === "All" || String(product.storeId) === storeId) && !invalidPriceRange && (minimum === null || price >= minimum) && (maximum === null || price <= maximum);
  }).sort((a, b) => {
    if (sort === "Lowest") return getProductDisplayPrice(a) - getProductDisplayPrice(b);
    if (sort === "Highest") return getProductDisplayPrice(b) - getProductDisplayPrice(a);
    if (sort === "Name") return a.name.localeCompare(b.name);
    if (sort === "Newest") return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    return 0;
  }), [activeProducts, selectedCategories, invalidPriceRange, maximum, minimum, search, sort, storeId, storeMap]);

  const chips = [
    search.trim() && { key: "search", label: `${t("commerce.search")}: ${search.trim()}`, clear: () => setSearch("") },
    ...selectedCategories.map((item) => ({ key: `category-${item}`, label: item, clear: () => toggleCategory(item) })),
    storeId !== "All" && { key: "store", label: storeMap.get(storeId)?.name, clear: () => setStoreId("All") },
    minimumPrice !== "" && { key: "minimum", label: `${t("catalogFilters.minimumPrice")}: ${formatCurrency(Number(minimumPrice))}`, clear: () => setMinimumPrice("") },
    maximumPrice !== "" && { key: "maximum", label: `${t("catalogFilters.maximumPrice")}: ${formatCurrency(Number(maximumPrice))}`, clear: () => setMaximumPrice("") },
  ].filter(Boolean);
  const reset = () => { setSearch(""); setSelectedCategories([]); setStoreId("All"); setMinimumPrice(""); setMaximumPrice(""); setSort("Featured"); };

  const chipClass = (active) => `inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition ${active ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border)] bg-[var(--kucur-surface)] text-[var(--kucur-text)] hover:border-[var(--kucur-border-strong)]"}`;
  const advancedActive = storeId !== "All" || minimumPrice !== "" || maximumPrice !== "";

  return <CustomerPage className="space-y-3 !pt-0 sm:space-y-6 sm:!pt-8">
    <header className="grid gap-1 max-sm:pt-4"><h1 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--kucur-text)] sm:text-3xl">{t("commerce.catalogTitle")}</h1><p className="hidden text-[15px] text-[var(--kucur-text-muted)] sm:block">{t("commerce.catalogDescription")}</p></header>
    {!loading && error && <p className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[15px] font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100" role="alert">{t("commerce.loadError", { message: error })}</p>}

    <form className="grid min-w-0 gap-3 border-[var(--kucur-border)] max-sm:-mx-4 max-sm:!max-w-none max-sm:border-y max-sm:bg-[var(--kucur-surface)] max-sm:px-4 max-sm:py-3 sm:gap-4" role="search" aria-label={t("catalogFilters.title")} onSubmit={(event) => event.preventDefault()}>
      <label className="relative block"><span className="sr-only">{t("commerce.search")}</span><svg className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--kucur-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input className={`${controlClass} !min-h-12 !pl-11 !text-base`} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("catalogFilters.searchPlaceholder")}/></label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("commerce.category")}>
        <button className={chipClass(!selectedCategories.length)} type="button" aria-pressed={!selectedCategories.length} onClick={() => setSelectedCategories([])}>{t("catalogFilters.allCategories")}</button>
        {categories.map((item) => { const on = selectedCategories.includes(item); return <button className={chipClass(on)} type="button" aria-pressed={on} key={item} onClick={() => toggleCategory(item)}>{on && <svg className="-ml-1 mr-1.5 size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>}{item}</button>; })}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--kucur-text-muted)]" aria-live="polite">{loading ? " " : t("catalogFilters.results", { count: rows.length })}</p>
        <label className="flex items-center gap-2 text-sm font-semibold"><span className="text-[var(--kucur-text-muted)]">{t("commerce.sort")}</span><select className={`${controlClass} !w-auto`} value={sort} onChange={(event) => setSort(event.target.value)}><option value="Featured">{t("catalogFilters.recommended")}</option><option value="Newest">{t("catalogFilters.newest")}</option><option value="Lowest">{t("commerce.lowestPrice")}</option><option value="Highest">{t("commerce.highestPrice")}</option><option value="Name">{t("catalogFilters.nameAscending")}</option></select></label>
      </div>
      <details className="group rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-3 max-sm:-mx-1" open={advancedActive || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold">{t("catalogFilters.moreFilters")}<svg className="size-5 text-[var(--kucur-text-muted)] transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div className="grid gap-3 pb-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">{t("commerce.seller")}<select className={controlClass} value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="All">{t("catalogFilters.allMerchants")}</option>{stores.map((store) => <option value={String(store.id)} key={store.id}>{store.name}</option>)}</select></label>
          <fieldset className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2"><legend className="col-span-3 mb-1.5 text-sm font-semibold">{t("catalogFilters.priceRange")}</legend><input className={controlClass} aria-label={t("catalogFilters.minimumPrice")} type="number" inputMode="numeric" min="0" step="1000" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder={t("catalogFilters.minimumPrice")}/><span className="pb-3 text-[var(--kucur-text-muted)]" aria-hidden="true">–</span><input className={controlClass} aria-label={t("catalogFilters.maximumPrice")} type="number" inputMode="numeric" min="0" step="1000" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder={t("catalogFilters.noLimit")}/></fieldset>
        </div>
        {invalidPriceRange && <p className="pb-3 text-sm font-semibold text-rose-700 dark:text-rose-300" role="alert">{t("catalogFilters.invalidPriceRange")}</p>}
      </details>
      {(chips.length > 0 || sort !== "Featured") && <div className="flex min-w-0 flex-wrap items-center gap-2">{chips.map((chip) => <button className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full bg-[var(--kucur-green-soft)] px-3 text-sm font-bold text-[var(--kucur-green-ink)]" type="button" onClick={chip.clear} key={chip.key}><span className="truncate">{chip.label}</span><b aria-hidden="true">{"×"}</b></button>)}<button className="min-h-9 rounded-full px-3 text-sm font-bold text-[var(--kucur-text-muted)] underline" type="button" onClick={reset}>{t("catalogFilters.reset")}</button></div>}
    </form>

    {loading ? <CustomerLoading label={t("commerce.loadingProducts")} count={8}/> : !error && rows.length ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{rows.map((product) => <ProductCard key={product.id} product={product} storeName={storeMap.get(String(product.storeId))?.name ?? t("commerce.store")} price={product.hasVariants ? t("commerce.startsFrom", { price: formatCurrency(getProductDisplayPrice(product)) }) : formatCurrency(product.price)} {...productStockBadge(product, t)}/>)}</div> : !error && <CustomerEmpty title={t("commerce.emptyProducts")} description={t("commerce.emptyProductsHint")}/>}
  </CustomerPage>;
}

export default Products;
