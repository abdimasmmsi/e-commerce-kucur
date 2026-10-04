import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { useCourierBatches } from "./courierDeliveryModel";

export default function ActiveDeliveries() {
  const { t } = usePreferences();
  const { active, loading, error } = useCourierBatches();
  return <div className="page-container min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.courier")} title={t("courierIa.active")} description={t("courierIa.activeHint")} />
    {loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : error ? <section className="rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section> : active.length ? <section className="grid gap-3">{active.map((assignment) => <article className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" key={assignment.id}><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="text-xs font-semibold uppercase tracking-wide text-[var(--kucur-text-muted)]">{assignment.order?.storeName || t("customerOrders.fallbackStore")}</span><h2 className="mt-1 break-words text-lg font-semibold">#{assignment.order?.orderCode || assignment.order?.orderNumber}</h2><p className="mt-1 break-words text-sm text-[var(--kucur-text-muted)]">{assignment.order?.recipientName} · {assignment.order?.deliveryAddress}</p></div><StatusBadge status={assignment.status} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kucur-border)] pt-3"><span className="text-xs text-[var(--kucur-text-muted)]">{t("courierDelivery.pickupSequence")}: {assignment.pickupSequence || "—"}</span><Button as={Link} to={`/courier/active-deliveries/${assignment.commerceOrderId}`}>{t("courierIa.openDelivery")}</Button></div></article>)}</section> : <EmptyState title={t("courierIa.noActive")} description={t("courierIa.noActiveHint")} />}
  </div>;
}
