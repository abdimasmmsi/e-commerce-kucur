import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { getAdminDashboardMetrics } from "../../services/dashboardMetricsService";
import "./AdminOperations.css";
import "./Dashboard.css";

export default function Dashboard() {
  const { language } = usePreferences();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const c = language === "id" ? {
    eyebrow: "WORKSPACE ADMIN", title: "Pusat Operasional", description: "Pantau tindakan penting dan aktivitas E-Commerce dari satu tempat.", action: "Perlu Tindakan", actionHint: "Antrean yang membutuhkan pemeriksaan Admin.", operations: "Operasi Aktif", overview: "Ringkasan Sistem", review: "Tinjau", pendingStores: "Persetujuan lapak", pendingStoresHint: "Menunggu pemeriksaan", activeOrders: "Pesanan aktif", activeOrdersHint: "Sedang diproses", waitingCourier: "Menunggu kurir", waitingCourierHint: "Perlu penugasan", storesQueue: "Pengajuan lapak", storesQueueHint: "Lapak menunggu keputusan persetujuan.", deliveryQueue: "Penugasan pengiriman", deliveryQueueHint: "Pesanan siap pickup belum memiliki kurir.", allClear: "Tidak ada tindakan mendesak", allClearHint: "Semua antrean persetujuan dan penugasan saat ini sudah ditangani.", merchants: "Merchant", merchantsHint: "Pemilik pengajuan lapak", couriers: "Kurir", couriersHint: "aktif saat ini", loading: "Memuat ringkasan operasional", failed: "Ringkasan operasional belum dapat dimuat.", retry: "Coba Lagi",
  } : {
    eyebrow: "ADMIN WORKSPACE", title: "Operations Center", description: "Monitor important actions and E-Commerce activity in one place.", action: "Action Required", actionHint: "Queues that need an Admin review.", operations: "Active Operations", overview: "System Overview", review: "Review", pendingStores: "Store approvals", pendingStoresHint: "Awaiting review", activeOrders: "Active orders", activeOrdersHint: "Currently processing", waitingCourier: "Waiting for courier", waitingCourierHint: "Assignment needed", storesQueue: "Store application", storesQueueHint: "Stores are waiting for an approval decision.", deliveryQueue: "Delivery assignment", deliveryQueueHint: "Pickup-ready orders do not have a courier yet.", allClear: "No urgent actions", allClearHint: "All approval and assignment queues are currently handled.", merchants: "Merchants", merchantsHint: "Store application owners", couriers: "Couriers", couriersHint: "currently active", loading: "Loading operations summary", failed: "The operations summary could not be loaded.", retry: "Try Again",
  };
  const load = () => {
    setError("");
    setMetrics(null);
    getAdminDashboardMetrics().then(setMetrics).catch((caught) => setError(caught.message || c.failed));
  };
  useEffect(() => {
    let active = true;
    getAdminDashboardMetrics().then((data) => { if (active) setMetrics(data); }).catch((caught) => { if (active) setError(caught.message || c.failed); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!metrics) return <div className="page-container admin-operations-page admin-dashboard-page min-w-0"><PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />{error ? <section className="admin-feedback error" role="alert"><strong>{c.failed}</strong><p>{error}</p><button type="button" onClick={load}>{c.retry}</button></section> : <LoadingPanel label={c.loading} rows={5} />}</div>;
  const primary = [
    { label: c.pendingStores, value: metrics.pendingMerchants, detail: c.pendingStoresHint, to: "/admin/merchant-approval", status: "pending" },
    { label: c.activeOrders, value: metrics.activeOrders, detail: c.activeOrdersHint, to: "/admin/transactions", status: "processing" },
    { label: c.waitingCourier, value: metrics.waitingCourier, detail: c.waitingCourierHint, to: "/admin/delivery-batches", status: "pending" },
  ];
  const queues = [
    { label: c.storesQueue, detail: c.storesQueueHint, value: metrics.pendingMerchants, status: "pending", to: "/admin/merchant-approval" },
    { label: c.deliveryQueue, detail: c.deliveryQueueHint, value: metrics.waitingCourier, status: "pending", to: "/admin/delivery-batches" },
  ].filter((item) => item.value > 0);

  return <div className="page-container admin-operations-page admin-dashboard-page min-w-0">
    <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
    <section aria-labelledby="priority-heading"><div className="admin-section-heading"><div><h2 id="priority-heading">{c.operations}</h2><p>{c.actionHint}</p></div></div><div className="admin-primary-metrics">{primary.map((item) => <Link to={item.to} className={`admin-metric-card metric-${item.status}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><div><small>{item.detail}</small><StatusBadge status={item.status} /></div></Link>)}</div></section>
    <div className="admin-dashboard-lower">
      <section className="admin-monitor-section" aria-labelledby="action-heading"><div className="admin-monitor-heading"><h2 id="action-heading">{c.action}</h2><span>{queues.reduce((sum, item) => sum + item.value, 0)}</span></div>{queues.length ? <div>{queues.map((item) => <article key={item.label}><div><div className="admin-monitor-title"><strong>{item.label}</strong><StatusBadge status={item.status}>{item.value}</StatusBadge></div><span>{item.detail}</span></div><Link to={item.to}>{c.review} <span aria-hidden="true">→</span></Link></article>)}</div> : <div className="admin-dashboard-clear"><strong>{c.allClear}</strong><span>{c.allClearHint}</span></div>}</section>
      <section aria-labelledby="overview-heading"><div className="admin-section-heading"><div><h2 id="overview-heading">{c.overview}</h2></div></div><div className="admin-secondary-metrics"><Link to="/admin/merchant-approval"><span>{c.merchants}</span><strong>{metrics.totalMerchants}</strong><small>{c.merchantsHint}</small></Link><Link to="/admin/couriers"><span>{c.couriers}</span><strong>{metrics.totalCouriers}</strong><small>{metrics.availableCouriers} {c.couriersHint}</small></Link></div></section>
    </div>
  </div>;
}
