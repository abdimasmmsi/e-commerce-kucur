import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
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
  return <div className="page-container min-w-0 text-[var(--kucur-text)]"><PageHeader eyebrow={t("workspace.courier")} title={t("courierIa.history")} description={t("courierIa.historyHint")} />{loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : error ? <section className="rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section> : rows.length ? <section className="grid gap-3">{rows.map((assignment) => <article className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" key={assignment.id}><div className="min-w-0"><span className="text-xs text-[var(--kucur-text-muted)]">{formatDate(assignment.batch.completedAt || assignment.batch.dispatchAt, { dateStyle: "medium", timeStyle: "short" })} · {t("courierIa.batch")} #{String(assignment.batch.id).slice(0, 8)}</span><h2 className="mt-1 break-words text-base font-semibold">{assignment.order?.storeName}</h2><p className="break-words text-sm text-[var(--kucur-text-muted)]">{shortOrderCode(assignment.order?.orderCode || assignment.order?.orderNumber)}</p></div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={assignment.status} /><Button as={Link} variant="secondary" to={`/courier/batches/${assignment.batch.id}`}>{t("courierIa.openBatch")}</Button></div></article>)}</section> : <EmptyState title={t("courierIa.noHistory")} description={t("courierIa.noHistoryHint")} />}</div>;
}
