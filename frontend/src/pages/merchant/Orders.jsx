import { Navigate, useLocation } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { normalizeStoreType } from "../../utils/storeScope";

export default function Orders() {
  const location = useLocation();
  const { activeStore, error, loading, stores } = useStore();
  const { errorMessage, t } = usePreferences();
  const productStore = activeStore && normalizeStoreType(activeStore.type) === "product"
    ? activeStore
    : stores.find((store) => normalizeStoreType(store.type) === "product");

  if (loading) return <div className="page-container merchant-standard-page"><LoadingPanel label={t("orderManagement.loading")} rows={4} /></div>;
  if (error) return <div className="page-container merchant-standard-page"><section className="rounded-kucur-card border border-rose-300 bg-kucur-paper p-5" role="alert"><h1 className="text-xl font-bold">{t("orderManagement.loadFailed")}</h1><p className="mt-2 text-[var(--kucur-text-muted)]">{errorMessage(error.code, error.message)}</p></section></div>;
  if (!productStore) return <div className="page-container merchant-standard-page"><EmptyState title={t("merchantDashboard.selectCommerceStore")} description={t("merchantDashboard.commerceOnly")}/></div>;

  return <Navigate to={`/merchant/stores/${productStore.id}/orders${location.search}`} replace/>;
}
