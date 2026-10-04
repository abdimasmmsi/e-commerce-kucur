import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { orderService } from "../../services/commerceService";
import { matchesStatusFilter } from "../../utils/statusFilter";

const customerCancellableStatuses = ["pending", "confirmed", "processing"];
const statuses = ["all", "uncompleted", "pending", "confirmed", "processing", "ready-for-pickup", "courier-assigned", "picked-up", "on-delivery", "delivered", "completed", "cancelled"];
const orderStatusPriority = { pending: 0, confirmed: 1, processing: 2, "ready-for-pickup": 3, "courier-assigned": 4, "picked-up": 5, "on-delivery": 6, delivered: 10, completed: 11, cancelled: 12 };

function OrderSkeleton() {
  return <article className="animate-pulse rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" aria-hidden="true">
    <div className="flex justify-between gap-4"><span className="h-5 w-40 rounded bg-[var(--kucur-surface-elevated)]"/><span className="h-6 w-24 rounded-full bg-[var(--kucur-surface-elevated)]"/></div>
    <div className="mt-3 h-3 w-52 max-w-full rounded bg-[var(--kucur-surface-elevated)]"/><div className="mt-2 h-3 w-32 rounded bg-[var(--kucur-surface-elevated)]"/>
    <div className="mt-4 flex items-end justify-between border-t border-[var(--kucur-border)] pt-3"><span className="h-7 w-28 rounded bg-[var(--kucur-surface-elevated)]"/><span className="h-9 w-28 rounded-lg bg-[var(--kucur-surface-elevated)]"/></div>
  </article>;
}

function Orders() {
  const { formatCurrency, formatDate, statusLabel, t } = usePreferences();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("all");
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    orderService.list().then((value) => { if (active) setOrders(value); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => orders
    .filter((order) => matchesStatusFilter(order.status, status))
    .sort((a, b) => {
      const statusDifference = (orderStatusPriority[a.status] ?? 9) - (orderStatusPriority[b.status] ?? 9);
      return statusDifference || new Date(b.createdAt) - new Date(a.createdAt);
    }), [orders, status]);

  const cancel = async (orderId) => {
    try {
      const result = await orderService.cancel(orderId, reason);
      setOrders((current) => current.map((order) => order.id === orderId ? result : order));
      setCancelling(null);
      setReason("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-5 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
    <header className="flex min-w-0 flex-col gap-2 border-b border-[var(--kucur-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[var(--kucur-text)] sm:text-3xl">{t("customerOrders.title")}</h1><p className="mt-1 text-sm leading-6 text-[var(--kucur-text-muted)] sm:text-base">{t("customerOrders.subtitle")}</p></div>
      {!loading && <span className="text-sm font-semibold text-[var(--kucur-text-muted)]">{t("customerOrders.count", { count: orders.length })}</span>}
    </header>

    <div className="flex min-h-10 min-w-0 items-center gap-3 border-b border-[var(--kucur-border)] pb-3">
      <label className="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold text-[var(--kucur-text)] sm:flex-none"><span className="shrink-0">{t("customerOrders.filterStatus")}</span><select className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-sm text-[var(--kucur-text)] sm:w-64" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option value={item} key={item}>{item === "all" ? t("customerOrders.allStatuses") : item === "uncompleted" ? t("common.uncompleted") : statusLabel(item)}</option>)}</select></label>
      {!loading && <span className="ml-auto hidden text-xs text-[var(--kucur-text-muted)] sm:block">{t("customerOrders.filteredCount", { count: rows.length })}</span>}
    </div>

    {error && !cancelling && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}

    <section className="grid min-w-0 gap-3 lg:grid-cols-2" aria-live="polite" aria-busy={loading}>
      {loading && Array.from({ length: 4 }, (_, index) => <OrderSkeleton key={index}/>)}
      {!loading && !error && rows.map((order) => {
        const orderNumber = order.orderNumber ?? t("customerOrders.fallbackOrder");
        const storeName = order.storeName ?? order.store?.name ?? t("customerOrders.fallbackStore");
        return <article className="flex min-w-0 flex-col rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 shadow-[0_4px_16px_rgba(30,48,34,0.035)]" key={order.id}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-base font-bold text-[var(--kucur-text)]" title={storeName}>{storeName}</h2><p className="mt-1 truncate text-xs text-[var(--kucur-text-muted)]" title={orderNumber}>{t("customerOrders.orderReference", { number: orderNumber })}</p></div>
            <StatusBadge className="shrink-0" status={order.status}/>
          </div>
          <time className="mt-1.5 text-xs text-[var(--kucur-text-muted)]" dateTime={order.createdAt}>{formatDate(order.createdAt, { dateStyle: "medium" })} <span aria-hidden="true">·</span> {formatDate(order.createdAt, { timeStyle: "short" })}</time>
          <div className="mt-3 flex min-w-0 flex-col gap-2 border-t border-[var(--kucur-border)] pt-2.5 sm:flex-row sm:items-end sm:justify-between">
            <div><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--kucur-text-muted)]">{t("customerOrders.total")}</span><strong className="mt-0.5 block text-lg font-extrabold text-[var(--kucur-text)]">{formatCurrency(order.totalAmount)}</strong></div>
            <div className="flex min-w-0 flex-col-reverse gap-2 min-[390px]:flex-row sm:justify-end">
              {customerCancellableStatuses.includes(order.status) && <button className="min-h-10 rounded-xl border border-rose-300 px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950" type="button" onClick={() => { setCancelling(order.id); setReason(""); setError(""); }}>{t("customerOrders.cancel")}</button>}
              <Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold text-[var(--kucur-text)] transition hover:border-kucur-forest hover:text-kucur-forest" to={`/orders/${order.id}`}>{t("customerOrders.details")} <span className="ml-1" aria-hidden="true">→</span></Link>
            </div>
          </div>
          {cancelling === order.id && <div className="mt-4 grid gap-3 rounded-xl border border-rose-300 bg-[var(--kucur-surface-elevated)] p-3 dark:border-rose-800"><label className="grid gap-1.5 text-sm font-semibold text-[var(--kucur-text)]"><span>{t("customerOrders.cancellationReason")}</span><textarea className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2 text-[var(--kucur-text)]" rows="3" value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={t("customerOrders.cancellationPlaceholder")}/></label>{error && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><button className="min-h-10 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-sm font-semibold text-[var(--kucur-text)]" type="button" onClick={() => { setCancelling(null); setError(""); }}>{t("customerOrders.back")}</button><button className="min-h-10 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white" type="button" onClick={() => cancel(order.id)}>{t("customerOrders.confirmCancellation")}</button></div></div>}
        </article>;
      })}
    </section>

    {!loading && !error && !rows.length && <section className="grid min-h-56 justify-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-6 text-center"><span className="grid size-11 place-items-center rounded-xl bg-kucur-sand text-kucur-forest" aria-hidden="true"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg></span><h2 className="mt-1 text-lg font-bold text-[var(--kucur-text)]">{t("customerOrders.filteredEmpty")}</h2><p className="max-w-md text-sm text-[var(--kucur-text-muted)]">{t("customerOrders.filteredEmptyHint")}</p><Link className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-kucur-forest px-4 text-sm font-bold !text-white" to="/products">{t("customerOrders.shop")}</Link></section>}
  </div>;
}

export default Orders;
