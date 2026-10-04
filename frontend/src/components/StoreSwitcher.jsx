import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { usePreferences } from "../context/PreferencesContext";
import { getStoreManagementPath, storeTypeLabels } from "../utils/storeScope";
import "./StoreSwitcher.css";

function StoreSwitcher({ allowAll = false, compact = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeStore, activeStoreId, setActiveStore, stores } = useStore();
  const { statusLabel, t } = usePreferences();

  const handleChange = (event) => {
    const nextId = event.target.value;
    setActiveStore(nextId);
    if (nextId === "all") return;

    const selectedStore = stores.find((store) => String(store.id) === nextId);
    const isStoreSpecificPage = /^\/merchant\/stores\/[^/]+(?:\/|$)/.test(location.pathname)
      && !["/merchant/stores/new", "/merchant/stores/add"].includes(location.pathname);
    if (selectedStore && isStoreSpecificPage) navigate(getStoreManagementPath(selectedStore));
  };

  if (stores.length === 0) {
    return (
      <div className={`store-switcher store-switcher-empty${compact ? " is-compact" : ""}`}>
        <span>{t("workspace.activeStore")}</span>
        <strong>{t("workspace.noStore")}</strong>
        <Link to="/merchant/stores/new">{t("workspace.addStore")}</Link>
      </div>
    );
  }

  const selectedValue = allowAll && activeStoreId === "all"
    ? "all"
    : activeStore?.id ? String(activeStore.id) : String(stores[0].id);

  return (
    <label className={`store-switcher${compact ? " is-compact" : ""}`}>
      <span className="store-switcher-heading">
        <span>{t("workspace.activeStore")}</span>
        {compact && activeStoreId !== "all" && activeStore?.status && <small className={`store-switcher-status is-${String(activeStore.status).toLowerCase()}`}>{statusLabel(activeStore.status)}</small>}
      </span>
      {!compact && <strong title={activeStore?.name ?? t("workspace.allStores")}>
        {activeStoreId === "all" ? t("workspace.allStores") : activeStore?.name}
      </strong>}
      {!compact && <small>{activeStoreId === "all" ? t("workspace.allStoresSummary") : storeTypeLabels[activeStore?.type]}</small>}
      <select value={selectedValue} onChange={handleChange} aria-label={t("workspace.selectActiveStore")}>
        {allowAll && <option value="all">{t("workspace.allStores")}</option>}
        {stores.map((store) => (
          <option value={store.id} key={store.id}>
            {store.name} · {storeTypeLabels[store.type] ?? store.type}
          </option>
        ))}
      </select>
    </label>
  );
}

export default StoreSwitcher;
