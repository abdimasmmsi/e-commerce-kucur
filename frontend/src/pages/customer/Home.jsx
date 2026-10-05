import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import { productStockBadge } from "../../utils/productStock";
import { categoryStyle } from "../../utils/productCategory";
import { CustomerEmpty, CustomerLinkButton, CustomerLoading, CustomerPage, CustomerPanel } from "../../components/customer/CustomerUI";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import { getProductDisplayPrice, getProductTotalStock, productService } from "../../services/productService";

const Icon = ({ path, className = "size-7" }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;

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

  const available = useMemo(() => products.filter((product) => product.status === "active" && getProductTotalStock(product) > 0), [products]);
  const featured = available.slice(0, 10);
  const categories = useMemo(() => [...new Set(available.map((product) => product.category).filter(Boolean))].slice(0, 4), [available]);
  const clock = (value) => { const time = String(value ?? "").slice(0, 5); return language === "id" ? time.replace(":", ".") : time; };
  const cutoff = clock(settings?.deliveryOrderCutoffTime);
  const dispatch = clock(settings?.deliveryDispatchTime);
  const firstName = user?.fullName?.split(" ")[0];

  return <CustomerPage className="space-y-5 sm:space-y-8">
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
      <CustomerPanel className="home-hero relative isolate grid content-start gap-4 overflow-hidden p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--kucur-text)] sm:text-3xl">{firstName ? text("hello", { name: firstName }) : text("helloGuest")}</h1>
          <p className="mt-1 text-[15px] text-[var(--kucur-text-muted)]">{text("subtitle")}</p>
        </div>
        {categories.length > 0 && <nav aria-label={text("categories")} className="grid grid-cols-4 gap-2 sm:gap-3">
          {categories.map((category) => { const style = categoryStyle(category); return <Link className="grid min-w-0 justify-items-center gap-1.5 rounded-xl p-1 text-center text-[13px] font-semibold leading-tight text-[var(--kucur-text)] hover:bg-[var(--kucur-surface-elevated)] sm:flex sm:items-center sm:gap-3 sm:border sm:border-[var(--kucur-border)] sm:p-2.5 sm:text-left sm:text-sm" key={category} to={`/products?category=${encodeURIComponent(category)}`}>
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl sm:size-11 sm:rounded-xl ${style.tint}`}><Icon path={style.path} className="size-7 sm:size-6" /></span>
            <span className="line-clamp-2 break-words">{category}</span>
          </Link>; })}
        </nav>}
      </CustomerPanel>
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--kucur-green-soft)] p-4 text-[15px] text-[var(--kucur-text)] sm:p-6">
        <Icon className="mt-0.5 size-6 shrink-0 text-[var(--kucur-green-ink)]" path="M3 6h11v10H3zM14 9h4l3 3.5V16h-7M7 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm10 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
        <div>
          <strong className="block text-base font-bold lg:text-lg">{cutoff ? text("deliveryTitle", { cutoff }) : text("deliveryTitleGeneric")}</strong>
          <p className="mt-1 leading-6">{dispatch ? text("deliveryText", { dispatch }) : text("deliveryTextGeneric")}</p>
        </div>
      </div>
    </div>

    <section className="min-w-0" aria-labelledby="home-featured">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-extrabold text-[var(--kucur-text)] sm:text-xl" id="home-featured">{t("customer.home.selectedProducts")}</h2>
        <Link className="shrink-0 text-sm font-bold text-[var(--kucur-green-ink)] hover:underline" to="/products">{t("customer.home.seeAll")}</Link>
      </div>
      {loading ? <CustomerLoading label={t("commerce.loadingProducts")} count={4} /> : error ? <CustomerEmpty title={t("commerce.loadError", { message: t("error.NETWORK_ERROR") })} description={t("commerce.emptyProductsHint")} /> : featured.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{featured.map((product) => <ProductCard key={product.id} product={product} storeName={product.store?.name ?? t("customer.home.localStore")} price={formatCurrency(getProductDisplayPrice(product))} {...productStockBadge(product, t)}/>)}</div> : <CustomerEmpty title={t("customer.home.noServices")} description={t("commerce.emptyProductsHint")} />}
    </section>

    {!isAuthenticated && <CustomerPanel className="grid gap-4 p-4 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div><h2 className="text-lg font-extrabold text-[var(--kucur-text)]">{text("guestTitle")}</h2><p className="mt-1 text-[15px] leading-6 text-[var(--kucur-text-muted)]">{text("guestDescription")}</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0"><CustomerLinkButton to="/login">{t("customer.home.login")}</CustomerLinkButton><CustomerLinkButton secondary to="/register">{t("customer.home.register")}</CustomerLinkButton></div>
    </CustomerPanel>}
  </CustomerPage>;
}

export default Home;
