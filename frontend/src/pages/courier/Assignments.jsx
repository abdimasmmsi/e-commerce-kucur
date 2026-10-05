import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { batchTime, dateGroup, useCourierBatches } from "./courierDeliveryModel";
import { shortOrderCode } from "../../utils/orderCode";

export default function Assignments() {
  const { formatDate, t } = usePreferences();
  const { upcomingBatches, loading, error } = useCourierBatches();
  const rows = [...upcomingBatches].sort((a, b) => batchTime(a) - batchTime(b));
  return <div className="page-container min-w-0 text-[var(--kucur-text)]"><PageHeader eyebrow={t("workspace.courierEyebrow")} title={t("courierIa.upcoming")} description={t("courierIa.upcomingHint")} />{loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : error ? <section className="rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section> : rows.length ? <section className="grid gap-4">{rows.map((batch) => <article className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" key={batch.id}><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kucur-border)] pb-3"><div><span className="text-xs font-bold uppercase tracking-wide text-[var(--kucur-green-hover)]">{dateGroup(batch.dispatchAt, t)}</span><h2 className="mt-1 text-lg font-semibold">{formatDate(batch.dispatchAt, { dateStyle: "medium", timeStyle: "short" })}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{t("courierIa.batch")} #{String(batch.id).slice(0, 8)} · {t("courierIa.orders", { count: batch.orders.length })}</p></div><StatusBadge status={batch.status} /></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{batch.orders.map((assignment) => <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-kucur-sand p-3" key={assignment.id}><span className="min-w-0"><strong className="block truncate text-sm">{assignment.commerceOrder?.storeName}</strong><small className="block truncate text-[var(--kucur-text-muted)]">{shortOrderCode(assignment.commerceOrder?.orderCode)}</small></span><StatusBadge status={assignment.status} /></div>)}</div><Button as={Link} className="mt-4" to={`/courier/batches/${batch.id}`}>{t("courierIa.openBatch")}</Button></article>)}</section> : <EmptyState title={t("courierIa.noUpcoming")} description={t("courierIa.noUpcomingHint")} />}</div>;
}
