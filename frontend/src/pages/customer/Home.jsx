import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import { CustomerEmpty, CustomerLinkButton, CustomerLoading, CustomerPage, CustomerPanel, CustomerSection } from "../../components/customer/CustomerUI";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { getProductDisplayPrice, getProductTotalStock, productService } from "../../services/productService";

const trustIcons = [
  "M6 8.5h12l-1 10H7l-1-10ZM9 9V7a3 3 0 0 1 6 0v2",
  "m5 12 4 4L19 6",
  "M3 7h11v9H3V7Zm11 3h3l3 3v3h-6v-6ZM7 19h.01M17 19h.01",
];

function Home() {
  const { isAuthenticated } = useAuth();
  const { formatCurrency, t } = usePreferences();
  const text = (key) => t(`customer.home.${key}`);
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

  const featured = products
    .filter((product) => product.status === "active" && getProductTotalStock(product) > 0)
    .slice(0, 5);
  const benefits = [text("localProducts"), t("commerceHome.easyShopping"), t("commerceHome.trackedDelivery")];

  return <CustomerPage className="space-y-6 sm:space-y-8">
    <CustomerPanel className="relative isolate overflow-hidden bg-[color-mix(in_srgb,var(--kucur-sand)_64%,var(--kucur-surface))] px-5 py-7 sm:px-8 sm:py-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
      <span className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full border-[34px] border-kucur-green/10" aria-hidden="true" />
      <div className="relative max-w-3xl">
        <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-kucur-clay">{t("commerceHome.eyebrow")}</span>
        <h1 className="mt-2 max-w-2xl text-balance text-3xl font-black leading-tight tracking-[-0.04em] text-[var(--kucur-text)] sm:text-4xl">{t("commerceHome.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--kucur-text-muted)] sm:text-base">{t("commerceHome.description")}</p>
      </div>
      <div className="relative mt-5 flex shrink-0 flex-wrap gap-2 lg:mt-0">
        <CustomerLinkButton to="/products">{text("exploreProducts")}</CustomerLinkButton>
        {isAuthenticated && <CustomerLinkButton secondary to="/orders">{t("commerceHome.myOrders")}</CustomerLinkButton>}
      </div>
    </CustomerPanel>

    <CustomerSection title={text("selectedProducts")} description={t("commerce.catalogDescription")} action={<Link className="shrink-0 text-sm font-bold text-kucur-forest hover:underline dark:text-emerald-300" to="/products">{text("seeAll")} <span aria-hidden="true">→</span></Link>}>
      {loading ? <CustomerLoading label={t("commerce.loadingProducts")} count={4} /> : error ? <CustomerEmpty title={t("commerce.loadError", { message: t("error.NETWORK_ERROR") })} description={t("commerce.emptyProductsHint")} /> : featured.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{featured.map((product) => <ProductCard key={product.id} product={product} storeName={product.store?.name ?? text("localStore")} price={formatCurrency(getProductDisplayPrice(product))} stockLabel={t("commerce.stock", { count: getProductTotalStock(product) })} detailLabel={text("details")}/>)}</div> : <CustomerEmpty title={text("noServices")} description={t("commerce.emptyProductsHint")} />}
    </CustomerSection>

    <CustomerPanel className="p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[var(--kucur-text)]">{t("commerceHome.whyKucur")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {benefits.map((benefit, index) => <div className="flex items-center gap-3 rounded-xl bg-[var(--kucur-surface-elevated)] p-3" key={benefit}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-kucur-sand text-kucur-forest" aria-hidden="true"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d={trustIcons[index]} /></svg></span>
          <strong className="text-sm font-bold text-[var(--kucur-text)]">{benefit}</strong>
        </div>)}
      </div>
    </CustomerPanel>

    <CustomerPanel className="p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div className="max-w-2xl"><span className="text-xs font-extrabold uppercase tracking-[0.14em] text-kucur-clay">{isAuthenticated ? text("yourAccount") : text("account")}</span><h2 className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-[var(--kucur-text)]">{t(isAuthenticated ? "commerceHome.memberTitle" : "commerceHome.guestTitle")}</h2><p className="mt-1.5 text-sm leading-6 text-[var(--kucur-text-muted)]">{t(isAuthenticated ? "commerceHome.memberDescription" : "commerceHome.guestDescription")}</p></div>
      <div className="mt-5 flex shrink-0 flex-wrap gap-2 sm:mt-0">{isAuthenticated ? <><CustomerLinkButton to="/cart">{text("openCart")}</CustomerLinkButton><CustomerLinkButton secondary to="/orders">{t("commerceHome.myOrders")}</CustomerLinkButton></> : <><CustomerLinkButton to="/login">{text("login")}</CustomerLinkButton><CustomerLinkButton secondary to="/register">{text("register")}</CustomerLinkButton></>}</div>
    </CustomerPanel>
  </CustomerPage>;
}

export default Home;
