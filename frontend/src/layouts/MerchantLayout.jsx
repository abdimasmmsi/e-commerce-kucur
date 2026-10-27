import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import StoreSwitcher from "../components/StoreSwitcher";
import StoreWorkspaceHeader from "../components/StoreWorkspaceHeader";
import AppHeader from "../components/AppHeader";
import { usePreferences } from "../context/PreferencesContext";
import { useStore } from "../context/StoreContext";
import {
  getStoreManagementPath,
  normalizeStoreType,
  storeTypeLabels,
} from "../utils/storeScope";
import { canonicalStoreId } from "../services/legacyStoreReferences";
import "../styles/workspace-shell.css";
import "../components/ui/LoadingPanel.css";
import WorkspaceLogout from "../components/WorkspaceLogout";
import WorkspaceSidebarControls, { WorkspaceSidebarResizer } from "../components/WorkspaceSidebarControls";
import { useWorkspaceSidebar } from "../utils/useWorkspaceSidebar";
import "./MerchantLayout.css";
import "../components/CustomerBottomNav.css";

const sectionStoreTypes = {
  products: "product",
  orders: "product",
  stock: "product",
};

const NavigationIcon = ({ type }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    stores: <><path d="M3 10h18"/><path d="m5 10 1-6h12l1 6"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4"/><path d="M12 11.5V21"/></>,
    orders: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
    pickup: <><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    stock: <><path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3M8 11h8M8 15h5"/></>,
    reviews: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
    finance: <><path d="M4 6h16v14H4z"/><path d="M4 10h16M8 15h3"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
  };

  return <svg className="merchant-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
};

const MerchantNavLink = ({ children, icon, ...props }) => (
  <NavLink {...props}>
    <NavigationIcon type={icon} />
    <span>{children}</span>
  </NavLink>
);

function MerchantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeStore, activeStoreId, loading: storesLoading, setActiveStore, stores: merchantStores } = useStore();
  const { language, t } = usePreferences();
  const tabCopy = language === "id" ? { home: "Beranda", homeLong: "Beranda Lapak", orders: "Pesanan", products: "Produk", menu: "Menu" } : { home: "Home", homeLong: "Store Home", orders: "Orders", products: "Products", menu: "Menu" };
  const mismatchCopy = language === "id" ? { eyebrow: "Panel tidak cocok", title: "Fitur tidak tersedia untuk jenis lapak ini", body: "{store} adalah lapak {type}. Pilih menu yang sesuai dengan jenis lapak aktif.", back: "Kembali ke Beranda Lapak" } : { eyebrow: "Panel mismatch", title: "This feature is not available for this store type", body: "{store} is a {type} store. Choose a menu that matches the active store.", back: "Back to Store Home" };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebar = useWorkspaceSidebar("merchant");

  const storeRouteMatch = location.pathname.match(/^\/merchant\/stores\/([^/]+)(?:\/([^/]+))?/);
  const routeStoreId = storeRouteMatch?.[1];
  const routeSection = storeRouteMatch?.[2];
  const routeStore = merchantStores.find((store) => String(store.id) === canonicalStoreId(routeStoreId));
  const requiredStoreType = sectionStoreTypes[routeSection];
  const hasStoreTypeMismatch = Boolean(
    routeStore && requiredStoreType && normalizeStoreType(routeStore.type) !== requiredStoreType,
  );

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [sidebarOpen]);

  useEffect(() => {
    // Tunggu daftar lapak selesai dimuat; tanpa ini, membuka/refresh URL lapak langsung terlempar ke daftar lapak.
    if (storesLoading || !merchantStores.length || !routeStoreId || ["new", "add"].includes(routeStoreId)) return;

    const routeStore = merchantStores.find((store) => String(store.id) === canonicalStoreId(routeStoreId));
    if (routeStore) {
      if (String(activeStoreId) !== routeStore.id) setActiveStore(routeStore.id);
      return;
    }

    const fallbackStore = merchantStores[0];
    if (fallbackStore) {
      setActiveStore(fallbackStore.id);
      navigate(getStoreManagementPath(fallbackStore), { replace: true });
    } else {
      navigate("/merchant/stores", { replace: true });
    }
  }, [activeStoreId, merchantStores, navigate, routeStoreId, setActiveStore, storesLoading]);

  const allowAllStores = [
    "/merchant",
    "/merchant/stores",
    "/merchant/stores/new",
    "/merchant/stores/add",
  ].includes(location.pathname);

  const activeStoreType = normalizeStoreType(activeStore?.type);
  const storeNavigation = activeStoreId !== "all" && activeStoreType === "product"
    ? [
        [t("workspace.products"), `/merchant/stores/${activeStore.id}/products`, "products"],
        [t("workspace.orders"), `/merchant/stores/${activeStore.id}/orders`, "orders"],
        [t("workspace.pickupToday"), "/merchant/pickup", "pickup"],
        [t("workspace.stock"), `/merchant/stores/${activeStore.id}/stock`, "stock"],
        [t("workspace.reviews"), "/merchant/reviews", "reviews"],
      ]
    : [];

  const storeFinancePath = activeStoreId !== "all" && activeStoreType === "product"
    ? `/merchant/stores/${activeStore.id}/finance`
    : null;

  // Bar lapak tampil di semua halaman panel Penjual (di mode Semua Lapak berisi "Semua Lapak"), jadi posisi judul halaman sama di semua menu.
  const headerStore = routeStore ?? (activeStoreId !== "all" ? activeStore : null);

  return (
    <div className="merchant-workspace">
      <AppHeader accountMode workspaceRole="merchant" />
      <div className="merchant-layout">
      {sidebarOpen && (
        <button
          className="merchant-overlay"
          type="button"
          onClick={closeSidebar}
          aria-label={t("workspace.closeMenu")}
        />
      )}

      <aside
        aria-label={`${t("workspace.navigation")} ${t("workspace.merchant")}`}
        className={`merchant-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
        {...sidebar.sidebarProps}
      >
        <WorkspaceSidebarControls sidebar={sidebar} />
        <div className="merchant-sidebar-header">
          <h2>{t("workspace.merchant")}</h2>

          <button
            className="merchant-close-button"
            onClick={closeSidebar}
            aria-label={t("workspace.closeMenu")}
            type="button"
          >
            <span className="workspace-close-icon" aria-hidden="true" />
          </button>
        </div>

        <div className="merchant-store-switcher-wrap">
          <StoreSwitcher allowAll={allowAllStores} compact />
        </div>

        <nav className="merchant-nav" aria-label={t("workspace.navigation")}>
          <section className="merchant-nav-group" aria-labelledby="merchant-nav-overview">
            <h3 id="merchant-nav-overview">{t("merchantSidebar.overview")}</h3>
            <MerchantNavLink to="/merchant" end onClick={closeSidebar} icon="dashboard">{tabCopy.homeLong}</MerchantNavLink>
            <MerchantNavLink to="/merchant/stores" end onClick={closeSidebar} icon="stores">{t("workspace.stores")}</MerchantNavLink>
          </section>

          {storeNavigation.length > 0 && (
            <section className="merchant-nav-group" aria-labelledby="merchant-nav-operations">
              <h3 id="merchant-nav-operations">{t("merchantSidebar.operations")}</h3>
              {storeNavigation.map(([label, path, icon]) => <MerchantNavLink to={path} onClick={closeSidebar} icon={icon} key={`${path}:${label}`}>{label}</MerchantNavLink>)}
            </section>
          )}

          <section className="merchant-nav-group" aria-labelledby="merchant-nav-finance">
            <h3 id="merchant-nav-finance">{t("merchantSidebar.finance")}</h3>
            {storeFinancePath && <MerchantNavLink to={storeFinancePath} onClick={closeSidebar} icon="finance">{t("workspace.storeFinance")}</MerchantNavLink>}
            <MerchantNavLink to="/merchant/finance" onClick={closeSidebar} icon="finance">{t("workspace.merchantFinance")}</MerchantNavLink>
          </section>
          <section className="merchant-nav-group" aria-labelledby="merchant-nav-account">
            <h3 id="merchant-nav-account">{t("accountNav.account")}</h3>
            <MerchantNavLink to="/profile" onClick={closeSidebar} icon="account">{t("workspace.myAccount")}</MerchantNavLink>
          </section>
        </nav>
        <WorkspaceLogout />
      </aside>
      <WorkspaceSidebarResizer sidebar={sidebar} />

      <main className="merchant-main">
        <div className="merchant-mobile-header">
          <button
            className="merchant-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("workspace.openMenu")}
            type="button"
          >
            <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
          </button>

          <strong>{t("workspace.merchant")}</strong>
        </div>

        {!hasStoreTypeMismatch && <StoreWorkspaceHeader store={headerStore} storeCount={merchantStores.length} loading={storesLoading} />}

        {hasStoreTypeMismatch ? (
          <section className="merchant-feature-unavailable" role="status">
            <span>{mismatchCopy.eyebrow}</span>
            <h1>{mismatchCopy.title}</h1>
            <p>{mismatchCopy.body.replace("{store}", routeStore.name).replace("{type}", storeTypeLabels[routeStore.type] ?? routeStore.type)}</p>
            <NavLink to="/merchant">{mismatchCopy.back}</NavLink>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
      </div>
      <nav className="customer-bottom-nav merchant-bottom-nav" aria-label={t("workspace.navigation")}>
        <NavLink to="/merchant" end onClick={closeSidebar}><NavigationIcon type="dashboard" /><span>{tabCopy.home}</span></NavLink>
        <NavLink to="/merchant/orders" onClick={closeSidebar}><NavigationIcon type="orders" /><span>{tabCopy.orders}</span></NavLink>
        <NavLink to={activeStoreType === "product" && activeStore ? `/merchant/stores/${activeStore.id}/products` : "/merchant/stores"} onClick={closeSidebar}><NavigationIcon type="products" /><span>{tabCopy.products}</span></NavLink>
        <button type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><svg className="merchant-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>{tabCopy.menu}</span></button>
      </nav>
    </div>
  );
}

export default MerchantLayout;
