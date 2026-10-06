import { useCallback, useEffect, useMemo, useState } from "react";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { orderService } from "../../services/commerceService";
import { shortOrderCode } from "../../utils/orderCode";
import DeliveryDraftPanel from "../../components/admin/DeliveryDraftPanel";
import { jakartaToday } from "../../utils/deliveryDraft";
import "./AdminDeliveryFinance.css";

const TERMINAL = new Set(["DELIVERED", "FAILED", "CANCELLED"]);
const LOCKED = new Set(["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"]);
const FINISHED_BATCH = new Set(["COMPLETED", "CANCELLED", "FAILED"]);

export default function AdminDeliveryBatches() {
  const { formatDate, language, t } = usePreferences();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  // Pengiriman gagal (mis. pembeli menolak): Admin bisa membatalkan pesanan, stok kembali ke lapak.
  const [failedCancel, setFailedCancel] = useState(null);
  const [failedReason, setFailedReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const batchRows = await deliveryApi.adminBatches();
      setBatches(batchRows);
      setError("");
    } catch { setError(t("adminDelivery.loadFailed")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const failedCopy = language === "id"
    ? { cancel: "Batalkan pesanan", title: "Batalkan pesanan {code}?", text: "Pakai ini kalau pembeli menolak atau pesanan tidak bisa diantar. Stok dikembalikan ke lapak, pembeli dan lapak mendapat notifikasi. Kurir mengembalikan barang ke lapak dan lapak mengembalikan uang talangan ke kurir.", reason: "Alasan pembatalan", reasonHint: "Wajib diisi, terlihat oleh pembeli.", back: "Kembali", orderCancelled: "Pesanan dibatalkan" }
    : { cancel: "Cancel order", title: "Cancel order {code}?", text: "Use this when the buyer refuses or the order cannot be delivered. Stock returns to the store, and the buyer and store are notified. The courier returns the items to the store and the store refunds the courier's advance.", reason: "Cancellation reason", reasonHint: "Required, visible to the buyer.", back: "Go back", orderCancelled: "Order cancelled" };
  const confirmFailedCancel = async () => {
    if (!failedCancel || !failedReason.trim()) return;
    setBusy(true); setError("");
    try { await orderService.cancel(failedCancel.orderId, failedReason.trim()); setFailedCancel(null); await load(); }
    catch (cause) { setError(cause?.message || t("adminDelivery.loadFailed")); setFailedCancel(null); }
    finally { setBusy(false); }
  };
  const mutate = async (action) => {
    setBusy(true); setError("");
    try { await action(); await load(); }
    catch { setError(t("adminDelivery.loadFailed")); }
    finally { setBusy(false); }
  };
  const groupByDate = (rows) => Object.entries(rows.reduce((groups, batch) => {
    const date = String(batch.deliveryDate).slice(0, 10); (groups[date] ||= []).push(batch); return groups;
  }, {})).sort(([left], [right]) => right.localeCompare(left));
  const activeGroups = useMemo(() => groupByDate(batches.filter((batch) => !FINISHED_BATCH.has(batch.status))), [batches]);
  const finishedGroups = useMemo(() => groupByDate(batches.filter((batch) => FINISHED_BATCH.has(batch.status))), [batches]);
  const finishedCount = batches.filter((batch) => FINISHED_BATCH.has(batch.status)).length;
  const historyLabel = language === "id" ? `Riwayat batch selesai (${finishedCount})` : `Finished batch history (${finishedCount})`;
  const noActive = language === "id" ? "Tidak ada batch yang sedang berjalan." : "No batches are in progress.";

  return <><div className="page-container admin-delivery-page min-w-0">
    <PageHeader eyebrow={t("adminDelivery.eyebrow")} title={t("adminDelivery.title")} description={t("adminDelivery.subtitle")} />
    {error && <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{t("adminDelivery.retry")}</Button></section>}
    {loading ? <LoadingPanel label={t("adminDelivery.title")} rows={5} /> : <>
      {/* Penjadwalan batch: draf otomatis dari sistem, Admin memeriksa lalu menyetujui (tanpa persetujuan otomatis). */}
      <DeliveryDraftPanel onApproved={load} />
      <section className="delivery-batches-section">
        <div className="admin-section-heading"><div><h2>{t("adminDelivery.batches")}</h2><p>{t("adminDelivery.batchesHint")}</p></div></div>
        {batches.length ? <>
          {activeGroups.length ? activeGroups.map(([date, dateBatches]) => <section className="batch-date-group" key={date}><h3>{formatDate(`${date}T12:00:00`)}</h3><div className="batch-grid">{dateBatches.map((batch) => {
          const completed = batch.orders.filter((row) => row.status === "DELIVERED").length;
          const failed = batch.orders.filter((row) => ["FAILED", "CANCELLED"].includes(row.status)).length;
          const irreversible = batch.orders.some((row) => LOCKED.has(row.status));
          return <article className={`admin-ops-panel batch-card ${failed ? "has-attention" : ""}`} key={batch.id}>
            <header><div><strong>{batch.courier?.fullName || t("adminDelivery.selectCourier")}</strong><span>{t("adminDelivery.orders", { count: batch.orders.length })} · {t("adminDelivery.completed", { count: completed })}{failed ? ` · ${t("adminDelivery.failed", { count: failed })}` : ""}</span></div><StatusBadge status={batch.status}/></header>
            <dl><div><dt>{t("adminDelivery.dispatch")}</dt><dd>{batch.dispatchAt ? formatDate(batch.dispatchAt, { dateStyle: "short", timeStyle: "short" }) : t("adminFinance.notAvailable")}</dd></div><div><dt>{t("adminDelivery.lastUpdate")}</dt><dd>{formatDate(batch.updatedAt || batch.createdAt, { dateStyle: "short", timeStyle: "short" })}</dd></div></dl>
            <div className="batch-order-list">{batch.orders.map((assignment) => <div className={`batch-order ${["FAILED", "CANCELLED"].includes(assignment.status) ? "needs-attention" : ""}`} key={assignment.id}><span><strong title={assignment.commerceOrder?.orderCode}>{shortOrderCode(assignment.commerceOrder?.orderCode)}</strong><small>{assignment.commerceOrder?.storeName}</small></span><StatusBadge status={assignment.status}/><div>{assignment.commerceOrder?.fulfillmentStatus === "cancelled" ? <span className="text-sm font-semibold text-[var(--kucur-text-muted)]">{failedCopy.orderCancelled}</span> : ["FAILED", "CANCELLED"].includes(assignment.status) ? <span className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => mutate(() => deliveryApi.rebatch(assignment.commerceOrderId, { courierUserId: batch.courierUserId, deliveryDate: jakartaToday(new Date(Date.now() + 86400000)) }))}>{t("adminDelivery.rebatch")}</Button>{assignment.status === "FAILED" && <Button variant="ghost" className="!text-rose-700 dark:!text-rose-300" disabled={busy} onClick={() => { setFailedCancel({ orderId: assignment.commerceOrderId, code: shortOrderCode(assignment.commerceOrder?.orderCode) }); setFailedReason(""); }}>{failedCopy.cancel}</Button>}</span> : ["PLANNED", "READY"].includes(batch.status) && assignment.status === "WAITING_PICKUP" ? <Button variant="ghost" disabled={busy} onClick={() => mutate(() => deliveryApi.removeOrder(batch.id, assignment.commerceOrderId))}>{t("adminDelivery.remove")}</Button> : null}</div></div>)}</div>
            {!irreversible && ["PLANNED", "READY"].includes(batch.status) && !batch.orders.every((row) => TERMINAL.has(row.status)) && <footer><Button variant="danger" disabled={busy} onClick={() => setCancelTarget(batch)}>{t("adminDelivery.cancelBatch")}</Button></footer>}
          </article>;
        })}</div></section>) : <p className="text-[15px] text-[var(--kucur-text-muted)]">{noActive}</p>}
          {finishedCount > 0 && <details className="mt-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-4"><summary className="flex min-h-12 cursor-pointer items-center text-[15px] font-bold">{historyLabel}</summary><div className="pb-4">{finishedGroups.map(([date, dateBatches]) => <section className="batch-date-group" key={date}><h3>{formatDate(`${date}T12:00:00`)}</h3><div className="batch-grid">{dateBatches.map((batch) => {
          const completed = batch.orders.filter((row) => row.status === "DELIVERED").length;
          const failed = batch.orders.filter((row) => ["FAILED", "CANCELLED"].includes(row.status)).length;
          const irreversible = batch.orders.some((row) => LOCKED.has(row.status));
          return <article className={`admin-ops-panel batch-card ${failed ? "has-attention" : ""}`} key={batch.id}>
            <header><div><strong>{batch.courier?.fullName || t("adminDelivery.selectCourier")}</strong><span>{t("adminDelivery.orders", { count: batch.orders.length })} · {t("adminDelivery.completed", { count: completed })}{failed ? ` · ${t("adminDelivery.failed", { count: failed })}` : ""}</span></div><StatusBadge status={batch.status}/></header>
            <dl><div><dt>{t("adminDelivery.dispatch")}</dt><dd>{batch.dispatchAt ? formatDate(batch.dispatchAt, { dateStyle: "short", timeStyle: "short" }) : t("adminFinance.notAvailable")}</dd></div><div><dt>{t("adminDelivery.lastUpdate")}</dt><dd>{formatDate(batch.updatedAt || batch.createdAt, { dateStyle: "short", timeStyle: "short" })}</dd></div></dl>
            <div className="batch-order-list">{batch.orders.map((assignment) => <div className={`batch-order ${["FAILED", "CANCELLED"].includes(assignment.status) ? "needs-attention" : ""}`} key={assignment.id}><span><strong title={assignment.commerceOrder?.orderCode}>{shortOrderCode(assignment.commerceOrder?.orderCode)}</strong><small>{assignment.commerceOrder?.storeName}</small></span><StatusBadge status={assignment.status}/><div>{assignment.commerceOrder?.fulfillmentStatus === "cancelled" ? <span className="text-sm font-semibold text-[var(--kucur-text-muted)]">{failedCopy.orderCancelled}</span> : ["FAILED", "CANCELLED"].includes(assignment.status) ? <span className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => mutate(() => deliveryApi.rebatch(assignment.commerceOrderId, { courierUserId: batch.courierUserId, deliveryDate: jakartaToday(new Date(Date.now() + 86400000)) }))}>{t("adminDelivery.rebatch")}</Button>{assignment.status === "FAILED" && <Button variant="ghost" className="!text-rose-700 dark:!text-rose-300" disabled={busy} onClick={() => { setFailedCancel({ orderId: assignment.commerceOrderId, code: shortOrderCode(assignment.commerceOrder?.orderCode) }); setFailedReason(""); }}>{failedCopy.cancel}</Button>}</span> : ["PLANNED", "READY"].includes(batch.status) && assignment.status === "WAITING_PICKUP" ? <Button variant="ghost" disabled={busy} onClick={() => mutate(() => deliveryApi.removeOrder(batch.id, assignment.commerceOrderId))}>{t("adminDelivery.remove")}</Button> : null}</div></div>)}</div>
            {!irreversible && ["PLANNED", "READY"].includes(batch.status) && !batch.orders.every((row) => TERMINAL.has(row.status)) && <footer><Button variant="danger" disabled={busy} onClick={() => setCancelTarget(batch)}>{t("adminDelivery.cancelBatch")}</Button></footer>}
          </article>;
        })}</div></section>)}</div></details>}
        </> : <EmptyState title={t("adminDelivery.noBatches")} description={t("adminDelivery.noBatchesHint")} />}
      </section>
    </>}
  </div><ActionDialog open={Boolean(cancelTarget)} busy={busy} destructive title={t("adminDelivery.cancelBatch")} description={t("adminDelivery.cancelConfirm")} cancelLabel={language === "id" ? "Kembali" : "Go back"} confirmLabel={t("adminDelivery.cancelBatch")} onCancel={() => setCancelTarget(null)} onConfirm={async () => { if (!cancelTarget) return; await mutate(() => deliveryApi.cancelBatch(cancelTarget.id)); setCancelTarget(null); }}/><ActionDialog open={Boolean(failedCancel)} busy={busy} destructive title={failedCopy.title.replace("{code}", failedCancel?.code ?? "")} description={failedCopy.text} cancelLabel={failedCopy.back} confirmLabel={failedCopy.cancel} confirmDisabled={!failedReason.trim()} onCancel={() => setFailedCancel(null)} onConfirm={confirmFailedCancel}><label className="grid gap-1.5 text-[15px] font-semibold"><span>{failedCopy.reason}</span><textarea className="min-h-24 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-[15px] font-normal" value={failedReason} maxLength={1000} onChange={(event) => setFailedReason(event.target.value)}/><small className="font-normal text-[var(--kucur-text-muted)]">{failedCopy.reasonHint}</small></label></ActionDialog></>;
}
