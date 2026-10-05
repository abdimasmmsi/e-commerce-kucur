import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { batchTime, useCourierBatches } from "./courierDeliveryModel";
import { shortOrderCode } from "../../utils/orderCode";

export default function History() {
  const { formatDate, t } = usePreferences();
  const { history, loading, error } = useCourierBatches();
  const rows = [...history].sort((a, b) => batchTime(b.batch) - batchTime(a.batch));
  return <div className="page-container min-w-0 text-[var(--kucur-text)]"><PageHeader eyebrow={t("workspace.courierEyebrow")} title={t("courierIa.history")} description={t("courierIa.historyHint")} />{loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : error ? <section className="rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section> : rows.length ? <section className="grid gap-3">{rows.map((assignment) => <Link className="flex min-w-0 items-center justify-between gap-3 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 hover:border-[var(--kucur-green)]" to={`/courier/batches/${assignment.batch.id}`} key={assignment.id}><div className="grid min-w-0 gap-0.5"><h2 className="break-words text-base font-semibold">{assignment.order?.storeName}</h2><span className="text-sm text-[var(--kucur-text-muted)]">{shortOrderCode(assignment.order?.orderCode || assignment.order?.orderNumber)} · {formatDate(assignment.batch.completedAt || assignment.batch.dispatchAt, { dateStyle: "medium", timeStyle: "short" })}</span></div><div className="flex shrink-0 items-center gap-2"><StatusBadge status={assignment.status} /><span className="text-xl text-[var(--kucur-text-muted)]" aria-hidden="true">›</span></div></Link>)}</section> : <EmptyState title={t("courierIa.noHistory")} description={t("courierIa.noHistoryHint")} />}</div>;
}
