import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { batchTime, useCourierBatches } from "./courierDeliveryModel";

export default function Dashboard() {
  const { formatDate, t } = usePreferences();
  const batches = useCourierBatches();
  const [availability, setAvailability] = useState({ rows: [], loading: true, error: "" });
  useEffect(() => { let mounted = true; deliveryApi.availability().then((rows) => { if (mounted) setAvailability({ rows, loading: false, error: "" }); }).catch((error) => { if (mounted) setAvailability({ rows: [], loading: false, error: error.message }); }); return () => { mounted = false; }; }, []);
  const data = useMemo(() => {
    const nextBatch = [...batches.upcomingBatches].sort((a, b) => batchTime(a) - batchTime(b))[0];
    const now = new Date();
    const unavailable = availability.rows.some((row) => new Date(row.startAt) <= now && (!row.endAt || new Date(row.endAt) > now));
    return { current: batches.active[0], nextBatch, unavailable, ready: batches.active.filter((item) => item.status === "WAITING_PICKUP").length, failed: batches.history.filter((item) => item.status === "FAILED").length };
  }, [availability.rows, batches.active, batches.history, batches.upcomingBatches]);
  const loading = batches.loading || availability.loading;
  const error = batches.error || availability.error;
  const metrics = [[t("courierIa.active"), batches.active.length], [t("courierIa.upcoming"), batches.upcomingBatches.length], [t("merchantDashboard.readyPickup"), data.ready], [t("courierIa.issueFailed"), data.failed]];
  return <div className="page-container min-w-0 text-[var(--kucur-text)]"><PageHeader eyebrow={t("workspace.courier")} title={t("workspace.dashboard")} description={t("courierDelivery.assignedHint")} />{error && <section className="mb-4 rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section>}{loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <article className="rounded-kucur-card border border-[var(--kucur-border)] border-l-4 border-l-kucur-green bg-[var(--kucur-surface)] p-4" key={label}><span className="text-xs font-semibold uppercase tracking-wide text-[var(--kucur-text-muted)]">{label}</span><strong className="mt-2 block text-3xl font-bold">{value}</strong></article>)}</section><section className="mt-5 grid gap-4 lg:grid-cols-2"><div><h2 className="mb-3 text-lg font-semibold">{t("courierIa.currentActive")}</h2>{data.current ? <article className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs font-semibold uppercase text-[var(--kucur-text-muted)]">{data.current.order?.storeName}</span><h3 className="mt-1 text-lg font-semibold">#{data.current.order?.orderCode}</h3></div><StatusBadge status={data.current.status} /></div><Button as={Link} className="mt-4" to={`/courier/active-deliveries/${data.current.commerceOrderId}`}>{t("courierIa.openDelivery")}</Button></article> : <EmptyState title={t("courierIa.noActive")} description={t("courierIa.noActiveHint")} />}</div><div><h2 className="mb-3 text-lg font-semibold">{t("courierIa.nextAssignment")}</h2>{data.nextBatch ? <article className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs font-semibold uppercase text-[var(--kucur-text-muted)]">{t("courierIa.next")}</span><h3 className="mt-1 text-lg font-semibold">{formatDate(data.nextBatch.dispatchAt, { dateStyle: "medium", timeStyle: "short" })}</h3><p className="text-sm text-[var(--kucur-text-muted)]">{t("courierIa.orders", { count: data.nextBatch.orders.length })}</p></div><StatusBadge status={data.nextBatch.status} /></div><Button as={Link} className="mt-4" variant="secondary" to="/courier/assignments">{t("courierIa.upcoming")}</Button></article> : <EmptyState title={t("courierIa.noUpcoming")} description={t("courierIa.noUpcomingHint")} />}</div></section><section className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4"><div><h2 className="font-semibold">{t("courierIa.availability")}</h2><StatusBadge className="mt-2" status={data.unavailable ? "INACTIVE" : "ACTIVE"} /></div><Button as={Link} variant="secondary" to="/courier/availability">{t("courierDelivery.availability")}</Button></section></>}</div>;
}
