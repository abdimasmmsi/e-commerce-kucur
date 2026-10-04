import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { batchTime, dateGroup, useCourierBatches } from "./courierDeliveryModel";

const PAGE_SIZE = 6;
export default function DeliveryBatches() {
  const { formatDate, t } = usePreferences();
  const [page, setPage] = useState(1);
  const { scheduledBatches, loading, error } = useCourierBatches();
  const rows = [...scheduledBatches].sort((a, b) => batchTime(a) - batchTime(b));
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="page-container min-w-0 text-[var(--kucur-text)]"><PageHeader eyebrow={t("workspace.courier")} title={t("courierIa.batches")} description={t("courierIa.batchesHint")} />{loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : error ? <section className="rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</section> : visibleRows.length ? <section className="grid gap-4 lg:grid-cols-2">{visibleRows.map((batch) => { const completed = batch.orders.filter((item) => item.status === "DELIVERED").length; const failed = batch.orders.filter((item) => ["FAILED", "CANCELLED"].includes(item.status)).length; return <article className="flex min-w-0 flex-col rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" key={batch.id}><div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--kucur-border)] pb-3"><div className="min-w-0"><span className="text-xs font-bold uppercase tracking-wide text-[var(--kucur-green-hover)]">{dateGroup(batch.dispatchAt, t)}</span><h2 className="mt-1 break-words text-lg font-semibold">{formatDate(batch.deliveryDate, { dateStyle: "full" })}</h2><span className="mt-1 block text-sm text-[var(--kucur-text-muted)]">{t("courierDelivery.dispatchAt", { time: formatDate(batch.dispatchAt, { hour: "2-digit", minute: "2-digit" }) })}</span></div><StatusBadge status={batch.status} /></div><dl className="my-4 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.orderCount")}</dt><dd className="mt-1 font-semibold">{batch.orders.length}</dd></div><div><dt className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.delivered")}</dt><dd className="mt-1 font-semibold">{completed}</dd></div><div><dt className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.issueFailed")}</dt><dd className="mt-1 font-semibold">{failed}</dd></div></dl>{batch.courier?.fullName && <p className="mb-3 text-sm text-[var(--kucur-text-muted)]">{t("courierIa.courier")}: <strong className="text-[var(--kucur-text)]">{batch.courier.fullName}</strong></p>}<Button as={Link} className="mt-auto self-start" to={`/courier/batches/${batch.id}`}>{t("courierIa.openBatch")}</Button></article>; })}</section> : <EmptyState title={t("courierDelivery.empty")} description={t("courierDelivery.emptyHint")} />}{!loading && !error && rows.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} />}</div>;
}
