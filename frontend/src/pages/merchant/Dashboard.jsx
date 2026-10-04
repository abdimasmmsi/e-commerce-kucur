import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardStatCard from "../../components/DashboardStatCard";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import StatusBadge from "../../components/ui/StatusBadge";
import { useStore } from "../../context/StoreContext";
import { usePreferences } from "../../context/PreferencesContext";
import { orderService } from "../../services/orderService";
import { getProductTotalStock, productService } from "../../services/productService";
import { getAverageRating, reviewService } from "../../services/reviewService";
import "./Dashboard.css";

const actionable = new Set(["pending", "confirmed", "processing", "ready-for-pickup"]);

export default function MerchantDashboard() {
  const { activeStore, activeStoreId, stores } = useStore();
  const { formatDate, t } = usePreferences();
  const [data, setData] = useState({ products: [], orders: [], reviews: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isOverview = activeStoreId === "all" || !activeStore;
  const selectedIds = useMemo(
    () => new Set(isOverview ? stores.filter((store) => store.type === "product").map((store) => store.id) : [activeStore?.id].filter(Boolean)),
    [activeStore?.id, isOverview, stores],
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [products, orders, reviews] = await Promise.all([
        productService.list({ scope: "manage" }),
        orderService.list({ scope: "merchant" }),
        reviewService.merchant(isOverview ? undefined : activeStore.id),
      ]);
      setData({
        products: products.filter((row) => selectedIds.has(row.storeId)),
        orders: orders.filter((row) => selectedIds.has(row.storeId)),
        reviews,
      });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [activeStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(() => ({
    total: data.products.length,
    active: data.products.filter((row) => row.status === "active").length,
    low: data.products.filter((row) => {
      const stock = getProductTotalStock(row);
      return stock > 0 && stock <= 5;
    }).length,
    pending: data.orders.filter((row) => row.status === "pending").length,
    processing: data.orders.filter((row) => ["confirmed", "processing"].includes(row.status)).length,
    pickup: data.orders.filter((row) => row.status === "ready-for-pickup").length,
    delivery: data.orders.filter((row) => ["courier-assigned", "picked-up", "on-delivery"].includes(row.status)).length,
    completed: data.orders.filter((row) => row.status === "completed").length,
  }), [data.orders, data.products]);

  const urgent = useMemo(() => data.orders.filter((order) => actionable.has(order.status)).slice(0, 6), [data.orders]);
  const rating = getAverageRating(data.reviews);

  if (activeStore && activeStore.type !== "product") {
    return <div className="page-container merchant-standard-page"><EmptyState title={t("merchantDashboard.selectCommerceStore")} description={t("merchantDashboard.commerceOnly")} /></div>;
  }
  if (loading) {
    return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><LoadingPanel label={t("merchantDashboard.loading")} rows={4} /></div>;
  }

  return (
    <div className="merchant-dashboard merchant-standard-page">
      <header className="merchant-dashboard__header">
        <div>
          <span className="merchant-dashboard__eyebrow">{isOverview ? t("merchantDashboard.allStores") : activeStore.name}</span>
          <h1>{t("merchantDashboard.title")}</h1>
          <p>{t("merchantDashboard.subtitle")}</p>
        </div>
        {!isOverview && (
          <Link className="merchant-dashboard__add primary-button" to={`/merchant/stores/${activeStore.id}/products/add`}>
            <span aria-hidden="true">+</span> {t("merchantDashboard.addProduct")}
          </Link>
        )}
      </header>

      {error && (
        <section className="merchant-dashboard__error" role="alert">
          <strong>{t("merchantDashboard.loadFailed")}</strong>
          <p>{error}</p>
          <button className="secondary-button" type="button" onClick={load}>{t("merchantDashboard.retry")}</button>
        </section>
      )}

      {!error && (
        <>
          <section className="merchant-dashboard__primary-grid" aria-label={t("merchantDashboard.orderActions")}>
            <DashboardStatCard className="merchant-dashboard__metric metric-neutral" label={t("merchantDashboard.newOrders")} value={metrics.pending} detail={t("merchantDashboard.needsConfirmation")} to="/merchant/orders?status=pending" />
            <DashboardStatCard className="merchant-dashboard__metric metric-warning" label={t("merchantDashboard.needsProcessing")} value={metrics.processing} detail={t("merchantDashboard.prepareOrders")} to="/merchant/orders?status=processing" />
            <DashboardStatCard className="merchant-dashboard__metric metric-ready" label={t("merchantDashboard.readyPickup")} value={metrics.pickup} detail={t("merchantDashboard.waitingCourier")} to="/merchant/pickup" />
            <DashboardStatCard className="merchant-dashboard__metric metric-delivery" label={t("merchantDashboard.inDelivery")} value={metrics.delivery} detail={t("merchantDashboard.handledCourier")} to="/merchant/orders?status=on-delivery" />
          </section>

          <section className="merchant-dashboard__secondary-grid">
            {[[t("merchantDashboard.totalProducts"), metrics.total], [t("merchantDashboard.activeProducts"), metrics.active], [t("merchantDashboard.lowStock"), metrics.low], [t("merchantDashboard.completedOrders"), metrics.completed], [t("merchantDashboard.storeRating"), rating ?? t("merchantDashboard.unavailable")]].map(([label, value]) => (
              <article className="merchant-dashboard__secondary-stat" key={label}><span>{label}</span><strong>{value}</strong></article>
            ))}
          </section>

          <section className="merchant-dashboard__actions">
            <header><h2>{t("merchantDashboard.actionRequired")}</h2><p>{t("merchantDashboard.openToContinue")}</p></header>
            {urgent.length ? (
              <div className="merchant-dashboard__action-list">
                {urgent.map((order) => (
                  <Link className="merchant-dashboard__action-row" to={`/merchant/stores/${order.storeId}/orders/${order.id}`} key={order.id}>
                    <span className="merchant-dashboard__order-copy"><strong>{order.orderNumber}</strong><small>{order.customerName}{order.storeName ? ` · ${order.storeName}` : ""}</small></span>
                    <time dateTime={order.createdAt}>{formatDate(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time>
                    <StatusBadge status={order.status} />
                    <span className="merchant-dashboard__view-action">{t("orderManagement.details")} <span aria-hidden="true">→</span></span>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title={t("merchantDashboard.noPending")} description={t("merchantDashboard.newAppearHere")} />}
          </section>
        </>
      )}
    </div>
  );
}
