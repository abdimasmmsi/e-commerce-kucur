import { useCallback, useEffect, useMemo, useState } from "react";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import "./AdminDeliveryFinance.css";

const TERMINAL = new Set(["DELIVERED", "FAILED", "CANCELLED"]);
const LOCKED = new Set(["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"]);

export default function AdminDeliveryBatches() {
  const { formatDate, language, t } = usePreferences();
  const [batches, setBatches] = useState([]);
  const [eligible, setEligible] = useState({ deliveryDate: "", items: [] });
  const [couriers, setCouriers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [courierUserId, setCourier] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRows, eligibleRows, courierRows] = await Promise.all([deliveryApi.adminBatches(), deliveryApi.eligible(), deliveryApi.couriers()]);
      const activeCouriers = courierRows.filter((row) => row.isActive);
      setBatches(batchRows); setEligible(eligibleRows); setCouriers(activeCouriers);
      setCourier((current) => activeCouriers.some((row) => row.userId === current) ? current : activeCouriers[0]?.userId || "");
      setError("");
    } catch { setError(t("adminDelivery.loadFailed")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const mutate = async (action) => {
    setBusy(true); setError("");
    try { await action(); setSelected([]); await load(); }
    catch { setError(t("adminDelivery.loadFailed")); }
    finally { setBusy(false); }
  };
  const groupedBatches = useMemo(() => Object.entries(batches.reduce((groups, batch) => {
    const date = String(batch.deliveryDate).slice(0, 10); (groups[date] ||= []).push(batch); return groups;
  }, {})).sort(([left], [right]) => right.localeCompare(left)), [batches]);
  const allSelected = eligible.items.length > 0 && eligible.items.every((order) => selected.includes(order.id));

  return <><div className="page-container admin-delivery-page min-w-0">
    <PageHeader eyebrow={t("adminDelivery.eyebrow")} title={t("adminDelivery.title")} description={t("adminDelivery.subtitle")} />
    {error && <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{t("adminDelivery.retry")}</Button></section>}
    {loading ? <LoadingPanel label={t("adminDelivery.title")} rows={5} /> : <>
      <section className="admin-ops-panel assignment-panel">
        <div className="admin-section-heading"><div><h2>{t("adminDelivery.eligible")}</h2><p>{t("adminDelivery.eligibleHint")}</p></div><strong className="admin-count-pill">{eligible.items.length}</strong></div>
        <div className="assignment-toolbar">
          <label><span>{t("adminDelivery.deliveryDate")}</span><input type="date" value={eligible.deliveryDate} onChange={(event) => { setSelected([]); void deliveryApi.eligible(event.target.value).then(setEligible).catch(() => setError(t("adminDelivery.loadFailed"))); }} /></label>
          <label><span>{t("adminDelivery.courier")}</span><select value={courierUserId} onChange={(event) => setCourier(event.target.value)}><option value="">{t("adminDelivery.selectCourier")}</option>{couriers.map((row) => <option value={row.userId} key={row.userId}>{row.user.fullName}</option>)}</select></label>
          <div className="assignment-actions"><span>{t("adminDelivery.selected", { count: selected.length })}</span><Button disabled={busy || !selected.length || !courierUserId} onClick={() => mutate(() => deliveryApi.createBatch({ courierUserId, deliveryDate: eligible.deliveryDate, commerceOrderIds: selected }))}>{busy ? t("adminDelivery.creating") : t("adminDelivery.createBatch")}</Button></div>
        </div>
        {eligible.items.length ? <div className="eligible-list"><label className="eligible-select-all"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? eligible.items.map((order) => order.id) : [])} /><span>{t("adminDelivery.selectAll")}</span></label>{eligible.items.map((order) => <label className="eligible-order" key={order.id}><input type="checkbox" checked={selected.includes(order.id)} onChange={(event) => setSelected((rows) => event.target.checked ? [...rows, order.id] : rows.filter((id) => id !== order.id))}/><span><strong>{order.orderCode}</strong><small>{order.storeName}</small><small>{t("adminDelivery.orderAddress", { address: order.deliveryAddress })}</small></span><StatusBadge status={order.fulfillmentStatus}/></label>)}</div> : <EmptyState title={t("adminDelivery.noEligible")} description={t("adminDelivery.noEligibleHint")} />}
      </section>
      <section className="delivery-batches-section">
        <div className="admin-section-heading"><div><h2>{t("adminDelivery.batches")}</h2><p>{t("adminDelivery.batchesHint")}</p></div></div>
        {groupedBatches.length ? groupedBatches.map(([date, dateBatches]) => <section className="batch-date-group" key={date}><h3>{formatDate(`${date}T12:00:00`)}</h3><div className="batch-grid">{dateBatches.map((batch) => {
          const completed = batch.orders.filter((row) => row.status === "DELIVERED").length;
          const failed = batch.orders.filter((row) => ["FAILED", "CANCELLED"].includes(row.status)).length;
          const irreversible = batch.orders.some((row) => LOCKED.has(row.status));
          return <article className={`admin-ops-panel batch-card ${failed ? "has-attention" : ""}`} key={batch.id}>
            <header><div><strong>{batch.courier?.fullName || t("adminDelivery.selectCourier")}</strong><span>{t("adminDelivery.orders", { count: batch.orders.length })} · {t("adminDelivery.completed", { count: completed })}{failed ? ` · ${t("adminDelivery.failed", { count: failed })}` : ""}</span></div><StatusBadge status={batch.status}/></header>
            <dl><div><dt>{t("adminDelivery.dispatch")}</dt><dd>{batch.dispatchAt ? formatDate(batch.dispatchAt, { dateStyle: "short", timeStyle: "short" }) : t("adminFinance.notAvailable")}</dd></div><div><dt>{t("adminDelivery.lastUpdate")}</dt><dd>{formatDate(batch.updatedAt || batch.createdAt, { dateStyle: "short", timeStyle: "short" })}</dd></div></dl>
            <div className="batch-order-list">{batch.orders.map((assignment) => <div className={`batch-order ${["FAILED", "CANCELLED"].includes(assignment.status) ? "needs-attention" : ""}`} key={assignment.id}><span><strong>{assignment.commerceOrder?.orderCode}</strong><small>{assignment.commerceOrder?.storeName}</small></span><StatusBadge status={assignment.status}/><div>{["FAILED", "CANCELLED"].includes(assignment.status) ? <Button variant="secondary" disabled={busy || !courierUserId} onClick={() => mutate(() => deliveryApi.rebatch(assignment.commerceOrderId, { courierUserId, deliveryDate: eligible.deliveryDate }))}>{t("adminDelivery.rebatch")}</Button> : <Button variant="ghost" disabled={busy || !["PLANNED", "READY"].includes(batch.status) || assignment.status !== "WAITING_PICKUP"} onClick={() => mutate(() => deliveryApi.removeOrder(batch.id, assignment.commerceOrderId))}>{t("adminDelivery.remove")}</Button>}</div></div>)}</div>
            <footer><Button variant="danger" disabled={busy || irreversible || !["PLANNED", "READY"].includes(batch.status) || batch.orders.every((row) => TERMINAL.has(row.status))} onClick={() => setCancelTarget(batch)}>{t("adminDelivery.cancelBatch")}</Button></footer>
          </article>;
        })}</div></section>) : <EmptyState title={t("adminDelivery.noBatches")} description={t("adminDelivery.noBatchesHint")} />}
      </section>
    </>}
  </div><ActionDialog open={Boolean(cancelTarget)} busy={busy} destructive title={t("adminDelivery.cancelBatch")} description={t("adminDelivery.cancelConfirm")} cancelLabel={language === "id" ? "Kembali" : "Go back"} confirmLabel={t("adminDelivery.cancelBatch")} onCancel={() => setCancelTarget(null)} onConfirm={async () => { if (!cancelTarget) return; await mutate(() => deliveryApi.cancelBatch(cancelTarget.id)); setCancelTarget(null); }}/></>;
}
