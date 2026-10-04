import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import StatusTimeline from "../../components/ui/StatusTimeline";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";

const lifecycle = ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"];

export default function BatchDetail() {
  const { batchId } = useParams();
  const { formatCurrency, formatDate, statusLabel, t } = usePreferences();
  const [batch, setBatch] = useState(null);
  const [state, setState] = useState({ loading: true, busy: "", error: "" });
  const [proofs, setProofs] = useState({});
  const [failure, setFailure] = useState({ orderId: "", reason: "" });
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try { setBatch(await deliveryApi.courierBatch(batchId)); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, loading: false })); }
  }, [batchId]);
  useEffect(() => { void load(); }, [load]);
  const mutate = async (key, action) => {
    setState((value) => ({ ...value, busy: key, error: "" }));
    try { await action(); setFailure({ orderId: "", reason: "" }); await load(); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: "" })); }
  };

  if (state.loading && !batch) return <PageContainer><LoadingPanel label={t("courierDelivery.loading")} rows={4}/></PageContainer>;
  if (!batch) return <PageContainer><EmptyState title={t("courierDelivery.empty")} description={state.error || t("courierDelivery.emptyHint")} action={<Button as={Link} to="/courier/batches" variant="secondary">{t("courierDelivery.allBatches")}</Button>}/></PageContainer>;

  const completedCount = batch.orders.filter((item) => item.status === "DELIVERED").length;
  const problemCount = batch.orders.filter((item) => ["FAILED", "CANCELLED"].includes(item.status)).length;

  return <><PageContainer as="main" className="text-[var(--kucur-text)]">
    <Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-kucur-forest" to="/courier/batches"><span aria-hidden="true">←</span>{t("courierDelivery.allBatches")}</Link>
    <PageHeader eyebrow={t("workspace.courier")} title={t("courierDelivery.batchTitle", { date: formatDate(batch.deliveryDate) })} description={t("courierDelivery.dispatch", { date: formatDate(batch.dispatchAt, { dateStyle: "medium", timeStyle: "short" }) })} actions={<StatusBadge status={batch.status}/>} />
    <section className="mb-5 grid gap-3 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.courier")}</span><strong className="mt-1 block">{batch.courier?.fullName || t("workspace.courier")}</strong></div><div><span className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.orderCount")}</span><strong className="mt-1 block">{batch.orders.length}</strong></div><div><span className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.delivered")}</span><strong className="mt-1 block">{completedCount}</strong></div><div><span className="text-xs text-[var(--kucur-text-muted)]">{t("courierIa.issueFailed")}</span><strong className="mt-1 block">{problemCount}</strong></div></section>
    {state.error && <section className="mb-4 rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</section>}
    {["PLANNED", "READY"].includes(batch.status) && <div className="mb-5"><Button disabled={Boolean(state.busy)} onClick={() => void mutate(`batch-${batch.id}`, () => deliveryApi.startBatch(batch.id))}>{t("courierDelivery.start")}</Button></div>}
    <section className="grid gap-4">
      {batch.orders.map(({ commerceOrder: order, ...assignment }) => {
        const proof = proofs[order.id] || "";
        return <article className="grid min-w-0 gap-4 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" key={assignment.id}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--kucur-border)] pb-4">
            <div className="min-w-0"><span className="text-xs font-bold uppercase tracking-wide text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.orderNumber")}</span><h2 className="break-words text-lg font-semibold text-kucur-ink">#{order.orderCode || order.orderNumber}</h2><p className="mt-1 break-words text-sm text-[var(--kucur-text-muted)]">{order.storeName}</p></div>
            <StatusBadge status={assignment.status}/>
          </div>
          {!['FAILED', 'CANCELLED'].includes(assignment.status) && <StatusTimeline currentIndex={Math.max(0, lifecycle.indexOf(assignment.status))} label={statusLabel(assignment.status)} steps={lifecycle.map((step) => ({ key: step, label: statusLabel(step) }))}/>} 
          <dl className="grid gap-3 rounded-xl bg-kucur-sand p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.customerName")}</dt><dd className="mt-1 break-words text-sm font-semibold">{order.recipientName || t("merchantOrderDetail.unavailableValue")}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.deliveryAddress")}</dt><dd className="mt-1 break-words text-sm font-semibold">{order.deliveryAddress || t("merchantOrderDetail.unavailableValue")}</dd></div>
            <div><dt className="text-xs text-[var(--kucur-text-muted)]">{t("courierDelivery.pickupSequence")}</dt><dd className="mt-1 text-sm font-semibold">{assignment.pickupSequence || "—"}</dd></div>
            <div><dt className="text-xs text-[var(--kucur-text-muted)]">{t("courierDelivery.tip")}</dt><dd className="mt-1 text-sm font-semibold">{formatCurrency(order.courierTip)}</dd></div>
          </dl>
          {assignment.status === "OUT_FOR_DELIVERY" && <section className="grid gap-3 rounded-xl border border-[var(--kucur-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold">{t("merchantOrderDetail.deliveryProof")}<input className="min-h-11 w-full rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[var(--kucur-text)]" placeholder={t("courierDelivery.proofPlaceholder")} value={proof} onChange={(event) => setProofs((rows) => ({ ...rows, [order.id]: event.target.value }))}/></label>
            <Button className="self-end" disabled={!proof.trim() || Boolean(state.busy)} onClick={() => void mutate(`proof-${order.id}`, () => deliveryApi.proof(order.id, { photoUrl: proof }))}>{t("courierDelivery.completeWithProof")}</Button>
            {proof && <img className="max-h-48 w-full rounded-xl border border-[var(--kucur-border)] object-contain sm:col-span-2" src={proof} alt={t("merchantOrderDetail.deliveryProof")} onError={(event) => { event.currentTarget.hidden = true; }}/>} 
          </section>}
          <div className="flex flex-wrap gap-2">
            <Button as={Link} variant="secondary" to={`/courier/active-deliveries/${order.id}`}>{t("courierIa.openDelivery")}</Button>
            {assignment.status === "WAITING_PICKUP" && <Button disabled={Boolean(state.busy)} onClick={() => void mutate(`pickup-${order.id}`, () => deliveryApi.pickup(order.id))}>{t("courierDelivery.confirmPickup")}</Button>}
            {assignment.status === "PICKED_UP" && <Button disabled={Boolean(state.busy)} onClick={() => void mutate(`delivery-${order.id}`, () => deliveryApi.outForDelivery(order.id))}>{t("courierDelivery.startDelivery")}</Button>}
            {["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(assignment.status) && failure.orderId !== order.id && <Button variant="danger" disabled={Boolean(state.busy)} onClick={() => setFailure({ orderId: order.id, reason: "" })}>{t("courierDelivery.markFailed")}</Button>}
          </div>
        </article>;
      })}
    </section>
    {!batch.orders.length && <EmptyState title={t("courierDelivery.empty")} description={t("courierDelivery.emptyHint")}/>} 
  </PageContainer><ActionDialog open={Boolean(failure.orderId)} busy={Boolean(state.busy)} destructive confirmDisabled={!failure.reason.trim()} title={t("courierDelivery.markFailed")} description={t("courierDelivery.reason")} cancelLabel={t("merchantPickup.cancel")} confirmLabel={t("courierDelivery.markFailed")} onCancel={() => setFailure({ orderId: "", reason: "" })} onConfirm={() => void mutate(`fail-${failure.orderId}`, () => deliveryApi.failed(failure.orderId, failure.reason))}><label className="grid gap-1.5 text-sm font-semibold text-kucur-ink">{t("courierDelivery.reason")}<textarea autoFocus className="min-h-24 w-full resize-y rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-[var(--kucur-text)]" required maxLength="1000" value={failure.reason} onChange={(event) => setFailure((value) => ({ ...value, reason: event.target.value }))}/></label></ActionDialog></>;
}
