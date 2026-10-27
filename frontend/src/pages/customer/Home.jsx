import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import ProductImage from "../../components/ProductImage";
import ProductStats from "../../components/customer/ProductStats";
import { productStockBadge } from "../../utils/productStock";
import { categoryStyle } from "../../utils/productCategory";
import { CustomerEmpty, CustomerLinkButton, CustomerLoading, CustomerPage, CustomerPanel } from "../../components/customer/CustomerUI";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import { getProductDisplayPrice, getProductTotalStock, productService } from "../../services/productService";
import { HISTORY_EVENT, personalize } from "../../utils/browsingHistory";
import { useLiveRefresh } from "../../utils/liveRefresh";

const Icon = ({ path, className = "size-7" }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
// Warna inisial lapak (teks putih, kontras ≥ 4.5:1).
const storeTints = ["#2f6b45", "#9a5b1c", "#3d5a80", "#6b4a8a", "#8a3b3b"];
// Bagian yang di HP melebar sampai tepi layar (lepas dari padding container).
const bleed = "-mx-4 !max-w-none sm:-mx-6 lg:mx-0 lg:!max-w-full";

function SectionHead({ id, title, to, linkLabel }) {
  return <div className="mb-2.5 flex items-center justify-between gap-4">
    <h2 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--kucur-text)] sm:text-xl" id={id}>{title}</h2>
    {to && <Link className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-[var(--kucur-green-ink)] hover:underline" to={to}>{linkLabel}</Link>}
  </div>;
}

function Home() {
  const { isAuthenticated, user } = useAuth();
  const { formatCurrency, language, t } = usePreferences();
  const { settings } = useSystemSettings();
  const text = (key, values) => t(`commerceHome.${key}`, values);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    productService.list()
      .then((rows) => { if (active) setProducts(rows); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  // Muat ulang diam-diam (stok/harga berubah di perangkat lain); galat diabaikan.
  useLiveRefresh(() => productService.list().then((rows) => setProducts(rows)).catch(() => {}));

  const available = useMemo(() => products.filter((product) => product.status === "active" && getProductTotalStock(product) > 0), [products]);
  // Terlaris = penjualan 30 hari terakhir (data asli dari pesanan selesai); bila belum ada, pakai total penjualan.
  const bestSellers = useMemo(() => {
    const recent = available.filter((product) => Number(product.soldRecent) > 0).sort((a, b) => Number(b.soldRecent) - Number(a.soldRecent));
    return (recent.length >= 2 ? recent : available.filter((product) => Number(product.soldCount) > 0).sort((a, b) => Number(b.soldCount) - Number(a.soldCount))).slice(0, 8);
  }, [available]);
  // "Untuk kamu": diurutkan dari kategori yang sering dilihat & kata yang pernah dicari di perangkat ini.
  const [historyVersion, setHistoryVersion] = useState(0);
  useEffect(() => { const bump = () => setHistoryVersion((value) => value + 1); window.addEventListener(HISTORY_EVENT, bump); return () => window.removeEventListener(HISTORY_EVENT, bump); }, []);
  const feed = useMemo(() => personalize(available).slice(0, 10), [available, historyVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const categories = useMemo(() => [...new Set(available.map((product) => product.category).filter(Boolean))].slice(0, 5), [available]);
  const stores = useMemo(() => {
    const map = new Map();
    for (const product of available) {
      if (!product.store?.id) continue;
      const entry = map.get(product.store.id) ?? { id: product.store.id, name: product.store.name, count: 0, categories: new Map() };
      entry.count += 1;
      if (product.category) entry.categories.set(product.category, (entry.categories.get(product.category) ?? 0) + 1);
      map.set(product.store.id, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 4).map((store, index) => ({ ...store, tint: storeTints[index % storeTints.length], mainCategory: [...store.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] }));
  }, [available]);
  const clock = (value) => { const time = String(value ?? "").slice(0, 5); return language === "id" ? time.replace(":", ".") : time; };
  const cutoff = clock(settings?.deliveryOrderCutoffTime);
  const dispatch = clock(settings?.deliveryDispatchTime);
  const firstName = user?.fullName?.split(" ")[0];
  const priceOf = (product) => product.hasVariants ? t("commerce.startsFrom", { price: formatCurrency(getProductDisplayPrice(product)) }) : formatCurrency(getProductDisplayPrice(product));

  return <CustomerPage className="space-y-6 !pt-4 sm:space-y-8 sm:!pt-6">
    <h1 className="sr-only">{firstName ? text("hello", { name: firstName }) : text("helloGuest")}</h1>

    <section className="home-banner relative isolate overflow-hidden rounded-2xl p-4 sm:p-6 lg:p-8" aria-label={text("deliveryBadgeGeneric")}>
      <span className="inline-flex rounded-full bg-[var(--kucur-amber)] px-2.5 py-0.5 text-xs font-extrabold text-[#2a1d00]">{cutoff ? text("deliveryBadge") : text("deliveryBadgeGeneric")}</span>
      <p className="mt-2 max-w-[17rem] text-xl font-extrabold leading-tight tracking-[-0.02em] sm:max-w-md sm:text-2xl lg:text-3xl">{cutoff ? text("deliveryTitle", { cutoff }) : text("deliveryTitleGeneric")}</p>
      <p className="mt-1.5 max-w-md text-sm opacity-90 max-sm:pr-12 sm:text-[15px]">{dispatch ? text("deliveryText", { dispatch }) : text("deliveryTextGeneric")}</p>
      <Icon className="pointer-events-none absolute -bottom-8 -right-6 -z-10 size-28 opacity-[0.14] sm:-bottom-6 sm:-right-4 sm:size-48 sm:opacity-[0.16]" path="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Zm0 0 8-8" />
    </section>

    {categories.length > 0 && <nav aria-label={text("categories")} className="-mx-2 grid grid-cols-5 gap-1 sm:mx-0 sm:flex sm:flex-wrap sm:gap-3">
      {categories.map((category) => { const style = categoryStyle(category); return <Link className="grid min-h-[76px] min-w-0 content-start justify-items-center gap-1.5 rounded-xl p-1 text-center text-xs font-semibold leading-tight text-[var(--kucur-text)] hover:bg-[var(--kucur-surface)] sm:flex sm:min-h-0 sm:items-center sm:gap-2.5 sm:border sm:border-[var(--kucur-border)] sm:bg-[var(--kucur-surface)] sm:py-2 sm:pl-2 sm:pr-4 sm:text-left sm:text-sm" key={category} to={`/products?category=${encodeURIComponent(category)}`}>
        <span className="grid size-[50px] shrink-0 place-items-center rounded-2xl bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)] sm:size-10 sm:rounded-xl"><Icon path={style.path} className="size-6 sm:size-5" /></span>
        <span className="line-clamp-2 break-words">{category}</span>
      </Link>; })}
    </nav>}

    {loading ? <CustomerLoading label={t("commerce.loadingProducts")} count={4} /> : error ? <CustomerEmpty title={t("commerce.loadError", { message: t("error.NETWORK_ERROR") })} description={t("commerce.emptyProductsHint")} /> : <>
      {bestSellers.length >= 2 && <section className="min-w-0" aria-labelledby="home-best">
        <SectionHead id="home-best" title={text("bestSellers")} to="/products" linkLabel={text("allProducts")} />
        <div className={`${bleed} flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:scroll-px-6 lg:scroll-px-0 [scrollbar-width:none] sm:px-6 lg:px-0 [&::-webkit-scrollbar]:hidden`}>
          {bestSellers.map((product, index) => <Link className="group grid w-[140px] shrink-0 snap-start content-start gap-1 sm:w-[168px]" key={product.id} to={`/products/${product.id}`}>
            <span className="relative block aspect-square overflow-hidden rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]">
              <ProductImage className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" product={product} alt="" />
              <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--kucur-brand)] px-1.5 py-0.5 text-[11px] font-extrabold text-[var(--kucur-on-brand)]">#{index + 1}</span>
            </span>
            <span className="mt-1 line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-snug text-[var(--kucur-text)]">{product.name}</span>
            <strong className="text-[15px] font-extrabold text-[var(--kucur-text)]">{priceOf(product)}</strong>
            <ProductStats ratingAverage={product.ratingAverage} ratingCount={product.ratingCount} soldCount={product.soldCount} />
          </Link>)}
        </div>
      </section>}

      {stores.length > 0 && <section className={`${bleed} border-y border-[var(--kucur-border)] bg-[var(--kucur-surface)] lg:rounded-xl lg:border`} aria-labelledby="home-stores">
        <div className="px-4 pt-2 sm:px-6 lg:px-5"><SectionHead id="home-stores" title={text("storesTitle")} /></div>
        <ul className="lg:grid lg:grid-cols-2">
          {stores.map((store, index) => <li className={`border-[var(--kucur-border)] ${index ? "border-t" : ""} ${index === 1 ? "lg:border-t-0" : ""} lg:[&:nth-child(even)]:border-l`} key={store.id}>
            <Link className="flex min-h-[70px] items-center gap-3 px-4 py-3 hover:bg-[var(--kucur-surface-elevated)] sm:px-6 lg:px-5" to={`/stores/${store.id}`}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white" style={{ background: store.tint }} aria-hidden="true">{store.name?.trim()?.[0]?.toUpperCase() ?? "K"}</span>
              <span className="grid min-w-0 flex-1">
                <strong className="truncate text-[15px] font-bold text-[var(--kucur-text)]">{store.name}</strong>
                <span className="truncate text-[13px] text-[var(--kucur-text-muted)]">{[store.mainCategory, text("storeProducts", { count: store.count })].filter(Boolean).join(" · ")}</span>
              </span>
              <Icon className="size-5 shrink-0 text-[var(--kucur-text-muted)]" path="m9 6 6 6-6 6" />
            </Link>
          </li>)}
        </ul>
      </section>}

      <section className="min-w-0" aria-labelledby="home-feed">
        <SectionHead id="home-feed" title={text("forYou")} to="/products" linkLabel={text("allProducts")} />
        {feed.length ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{feed.map((product) => <ProductCard key={product.id} product={product} storeName={product.store?.name ?? t("customer.home.localStore")} price={priceOf(product)} {...productStockBadge(product, t)}/>)}</div> : <CustomerEmpty title={t("customer.home.noServices")} description={t("commerce.emptyProductsHint")} />}
      </section>
    </>}

    {!isAuthenticated && <CustomerPanel className="grid gap-4 p-4 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div><h2 className="text-lg font-extrabold text-[var(--kucur-text)]">{text("guestTitle")}</h2><p className="mt-1 text-[15px] leading-6 text-[var(--kucur-text-muted)]">{text("guestDescription")}</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0"><CustomerLinkButton to="/login">{t("customer.home.login")}</CustomerLinkButton><CustomerLinkButton secondary to="/register">{t("customer.home.register")}</CustomerLinkButton></div>
    </CustomerPanel>}
  </CustomerPage>;
}

export default Home;
