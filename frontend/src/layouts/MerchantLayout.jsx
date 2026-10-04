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
import "./MerchantLayout.css";

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
  const { activeStore, activeStoreId, setActiveStore, stores: merchantStores } = useStore();
  const { t } = usePreferences();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    if (!routeStoreId || ["new", "add"].includes(routeStoreId)) return;

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
  }, [activeStoreId, merchantStores, navigate, routeStoreId, setActiveStore]);

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

  const showStoreHeader = activeStoreId !== "all"
    && Boolean(activeStore)
    && (Boolean(routeStore) || ["/merchant/pickup", "/merchant/reviews"].includes(location.pathname));
  const headerStore = routeStore ?? activeStore;

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
      >
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
            <MerchantNavLink to="/merchant" end onClick={closeSidebar} icon="dashboard">{t("workspace.dashboard")}</MerchantNavLink>
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
        </nav>
      </aside>

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

        {showStoreHeader && !hasStoreTypeMismatch && <StoreWorkspaceHeader store={headerStore} />}

        {hasStoreTypeMismatch ? (
          <section className="merchant-feature-unavailable" role="status">
            <span>Workspace tidak cocok</span>
            <h1>Fitur tidak tersedia untuk jenis lapak ini</h1>
            <p>
              {routeStore.name} adalah lapak {storeTypeLabels[routeStore.type] ?? routeStore.type}.
              Pilih menu yang sesuai dengan jenis lapak aktif.
            </p>
            <NavLink to="/merchant">Kembali ke Dashboard</NavLink>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
      </div>
    </div>
  );
}

export default MerchantLayout;
