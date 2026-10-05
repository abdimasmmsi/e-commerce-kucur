import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { paginate } from "../../utils/pagination";
import "./PickupToday.css";
import { shortOrderCode } from "../../utils/orderCode";

const urgency = (left, right) => {
  const byDate = new Date(left.batch.deliveryDate) - new Date(right.batch.deliveryDate);
  if (byDate) return byDate;
  const bySequence = Number(left.pickupSequence || Number.MAX_SAFE_INTEGER)
    - Number(right.pickupSequence || Number.MAX_SAFE_INTEGER);
  if (bySequence) return bySequence;
  return new Date(left.commerceOrder.createdAt) - new Date(right.commerceOrder.createdAt);
};

const rowKey = ({ batch, commerceOrder }) => `${batch.id}-${commerceOrder.id}`;
const HISTORY_PAGE_SIZE = 10;

export default function PickupToday() {
  const { activeStore, activeStoreId } = useStore();
  const { errorMessage, formatDate, language, t } = usePreferences();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notReadyOrder, setNotReadyOrder] = useState(null);
  const [notReadyReason, setNotReadyReason] = useState("");
  const [notReadyError, setNotReadyError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await deliveryApi.merchantOrders();
      setRows(items.filter((row) => String(row.commerceOrder.storeId) === String(activeStoreId)));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause.code, t("merchantPickup.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, errorMessage, t]);

  useEffect(() => {
    let active = true;
    deliveryApi.merchantOrders()
      .then((items) => {
        if (!active) return;
        setRows(items.filter((row) => String(row.commerceOrder.storeId) === String(activeStoreId)));
        setError("");
      })
      .catch((cause) => { if (active) setError(errorMessage(cause.code, t("merchantPickup.loadFailed"))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeStoreId, errorMessage, t]);

  useEffect(() => {
    if (!notReadyOrder) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busyOrderId) setNotReadyOrder(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busyOrderId, notReadyOrder]);

  const activeRows = useMemo(
    () => rows.filter((row) => row.status === "WAITING_PICKUP").sort(urgency),
    [rows],
  );
  const historyRows = useMemo(
    () => rows.filter((row) => row.status !== "WAITING_PICKUP")
      .sort((a, b) => new Date(b.batch.deliveryDate) - new Date(a.batch.deliveryDate)),
    [rows],
  );
  const visibleHistory = useMemo(() => paginate(historyRows, historyPage, HISTORY_PAGE_SIZE), [historyPage, historyRows]);

  const confirmReady = async (order) => {
    setBusyOrderId(order.id);
    setMessage("");
    setError("");
    try {
      await deliveryApi.ready(order.id, { isReady: true, note: t("merchantPickup.readyNote") });
      setMessage(t("merchantPickup.saved"));
      await load();
    } catch (cause) {
      setError(errorMessage(cause.code, t("merchantPickup.saveFailed")));
    } finally {
      setBusyOrderId("");
    }
  };

  const openNotReady = (order) => {
    setNotReadyOrder(order);
    setNotReadyReason("");
    setNotReadyError("");
  };
  const closeNotReady = () => {
    if (busyOrderId) return;
    setNotReadyOrder(null);
    setNotReadyReason("");
    setNotReadyError("");
  };
  const submitNotReady = async (event) => {
    event.preventDefault();
    const note = notReadyReason.trim();
    if (note.length < 5) {
      setNotReadyError(t("merchantPickup.reasonRequired"));
      return;
    }
    const order = notReadyOrder;
    setBusyOrderId(order.id);
    setNotReadyError("");
    setMessage("");
    setError("");
    try {
      await deliveryApi.ready(order.id, { isReady: false, note });
      setNotReadyOrder(null);
      setNotReadyReason("");
      setMessage(t("merchantPickup.notReadySaved"));
      await load();
    } catch (cause) {
      setNotReadyError(errorMessage(cause.code, t("merchantPickup.saveFailed")));
    } finally {
      setBusyOrderId("");
    }
  };

  if (activeStoreId === "all" || activeStore?.type !== "product") {
    return <div className="page-container merchant-standard-page"><EmptyState title={t("merchantPickup.selectStore")} description={t("merchantPickup.selectStoreHint")}/></div>;
  }

  const courierName = (batch) => batch.courier?.fullName || t("merchantPickup.courierUnavailable");

  return <div className="page-container merchant-standard-page min-w-0">
    <PageHeader title={t("merchantPickup.title")} description={language === "id" ? "Pesanan yang diambil kurir hari ini dan riwayatnya." : "Orders picked up by the courier today and past pickups."}/>
    {message && <p className="merchant-status-feedback mb-5 rounded-kucur-control border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" role="status">{message}</p>}
    {error && <section className="mb-5 grid gap-2 rounded-kucur-card border border-rose-300 bg-kucur-paper p-4" role="alert"><strong>{t("merchantPickup.loadFailed")}</strong><p>{error}</p><button className="secondary-button w-fit" type="button" onClick={load}>{t("orderManagement.retry")}</button></section>}

    <section className="mb-7 overflow-hidden rounded-kucur-card border border-[var(--kucur-border)] bg-kucur-paper">
      <header className="border-b border-[var(--kucur-border)] bg-[var(--kucur-surface-elevated)] px-4 py-3.5"><h2 className="text-lg font-bold">{t("merchantPickup.active")}</h2><p className="mt-1 text-sm text-[var(--kucur-text-muted)]">{t("merchantPickup.subtitle")}</p></header>
      {loading
        ? <LoadingPanel label={t("common.loading")} rows={3} />
        : activeRows.length
          ? <div className="divide-y divide-[var(--kucur-border)]">{activeRows.map(({ commerceOrder: order, batch, pickupSequence, status }) => <article className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={`${batch.id}-${order.id}`}>
            <div className="grid min-w-0 gap-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><strong className="break-words" title={order.orderCode}>{shortOrderCode(order.orderCode)}</strong><StatusBadge status={status}/></div><p className="text-sm text-[var(--kucur-text-muted)]">{order.recipientName}{" \u00B7 "}{formatDate(batch.deliveryDate, { dateStyle: "medium" })}{" \u00B7 "}{t("merchantPickup.courier")} {courierName(batch)}</p><small className="text-[var(--kucur-text-muted)]">#{pickupSequence}</small></div>
            <div className="flex flex-wrap gap-2"><button className="primary-button" type="button" disabled={busyOrderId === order.id} onClick={() => confirmReady(order)}>{t("merchantPickup.confirmReady")}</button><button className="secondary-button" type="button" disabled={busyOrderId === order.id} onClick={() => openNotReady(order)}>{t("merchantPickup.notReady")}</button></div>
          </article>)}</div>
          : <div className="p-4"><EmptyState title={t("merchantPickup.empty")} description={t("merchantPickup.emptyHint")}/></div>}
    </section>

    <section className="grid gap-3"><header><h2 className="text-lg font-bold">{t("merchantPickup.history")}</h2><p className="mt-1 text-sm text-[var(--kucur-text-muted)]">{t("merchantPickup.historyHint")}</p></header>
      {!loading && historyRows.length ? <>
        <div className="hidden overflow-hidden rounded-kucur-card border border-[var(--kucur-border)] bg-kucur-paper md:block"><table className="w-full border-collapse text-left text-sm"><thead className="bg-[var(--kucur-surface-elevated)] text-xs text-[var(--kucur-text-muted)]"><tr><th className="p-3">{t("orderManagement.orderCode")}</th><th className="p-3">{t("orderManagement.customer")}</th><th className="p-3">{t("orderManagement.orderDate")}</th><th className="p-3">{t("merchantPickup.courier")}</th><th className="p-3">{t("orderManagement.status")}</th></tr></thead><tbody>{visibleHistory.map(({ commerceOrder: order, batch, status }) => <tr className="border-t border-[var(--kucur-border)] hover:bg-[var(--kucur-surface-elevated)]" key={rowKey({ commerceOrder: order, batch })}><td className="p-3 font-bold" title={order.orderCode}>{shortOrderCode(order.orderCode)}</td><td className="p-3">{order.recipientName}</td><td className="p-3">{formatDate(batch.deliveryDate, { dateStyle: "medium" })}</td><td className="p-3">{courierName(batch)}</td><td className="p-3"><StatusBadge status={status}/></td></tr>)}</tbody></table></div>
        <div className="grid gap-3 md:hidden">{visibleHistory.map(({ commerceOrder: order, batch, status }) => <article className="grid gap-3 rounded-kucur-card border border-[var(--kucur-border)] bg-kucur-paper p-4" key={rowKey({ commerceOrder: order, batch })}><div className="flex flex-wrap items-start justify-between gap-2"><strong title={order.orderCode}>{shortOrderCode(order.orderCode)}</strong><StatusBadge status={status}/></div><p className="text-sm text-[var(--kucur-text-muted)]">{order.recipientName}{" \u00B7 "}{formatDate(batch.deliveryDate, { dateStyle: "medium" })}</p><small>{t("merchantPickup.courier")} {courierName(batch)}</small></article>)}</div>
        <Pagination page={historyPage} pageSize={HISTORY_PAGE_SIZE} totalItems={historyRows.length} onPageChange={setHistoryPage}/>
      </> : !loading && <EmptyState title={t("merchantPickup.emptyHistory")} description={t("merchantPickup.historyHint")}/>} 
    </section>

    {notReadyOrder && <div className="pickup-reason-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeNotReady(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="pickup-reason-title" onSubmit={submitNotReady}>
        <header><div><span>{notReadyOrder.orderCode}</span><h2 id="pickup-reason-title">{t("merchantPickup.reasonTitle")}</h2></div><button type="button" aria-label={t("merchantPickup.closeModal")} disabled={Boolean(busyOrderId)} onClick={closeNotReady}>{"\u00D7"}</button></header>
        <p>{t("merchantPickup.reasonHint", { customer: notReadyOrder.recipientName })}</p>
        <label><span>{t("merchantPickup.reasonLabel")}</span><textarea autoFocus required rows="5" minLength="5" maxLength="500" value={notReadyReason} placeholder={t("merchantPickup.reasonDefault")} onChange={(event) => { setNotReadyReason(event.target.value); setNotReadyError(""); }}/><small>{t("merchantPickup.reasonCount", { count: notReadyReason.length })}</small></label>
        {notReadyError && <p className="pickup-reason-error" role="alert">{notReadyError}</p>}
        <footer><button type="button" disabled={Boolean(busyOrderId)} onClick={closeNotReady}>{t("merchantPickup.cancel")}</button><button className="is-primary" type="submit" disabled={Boolean(busyOrderId) || notReadyReason.trim().length < 5}>{t(busyOrderId ? "merchantPickup.saving" : "merchantPickup.confirmNotReady")}</button></footer>
      </form>
    </div>}
  </div>;
}
