import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { orderService } from "../../services/commerceService";
import { shortOrderCode } from "../../utils/orderCode";

const customerCancellableStatuses = ["pending", "confirmed"];
const doneStatuses = ["delivered", "completed"];
const tabs = [
  { key: "active", label: "customerOrders.tabActive", matches: (status) => !doneStatuses.includes(status) && status !== "cancelled" },
  { key: "done", label: "customerOrders.tabDone", matches: (status) => doneStatuses.includes(status) },
  { key: "cancelled", label: "customerOrders.tabCancelled", matches: (status) => status === "cancelled" },
];
// Tahap untuk garis kemajuan (5 bagian) dan kalimat status yang mudah dipahami.
const progress = {
  pending: [0, "stepPending"], confirmed: [1, "stepConfirmed"], processing: [1, "stepProcessing"],
  "ready-for-pickup": [2, "stepReady"], "courier-assigned": [2, "stepReady"], "picked-up": [3, "stepPicked"],
  "on-delivery": [3, "stepOnDelivery"], delivered: [4, "stepDone"], completed: [4, "stepDone"], cancelled: [-1, "stepCancelled"],
};

function OrderSkeleton() {
  return <article className="animate-pulse rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" aria-hidden="true">
    <div className="flex justify-between gap-4"><span className="h-5 w-40 rounded bg-[var(--kucur-surface-elevated)]"/><span className="h-6 w-24 rounded-full bg-[var(--kucur-surface-elevated)]"/></div>
    <div className="mt-4 flex gap-3"><span className="size-14 rounded-xl bg-[var(--kucur-surface-elevated)]"/><span className="h-4 w-44 rounded bg-[var(--kucur-surface-elevated)]"/></div>
    <div className="mt-4 flex items-end justify-between border-t border-[var(--kucur-border)] pt-3"><span className="h-7 w-28 rounded bg-[var(--kucur-surface-elevated)]"/><span className="h-11 w-24 rounded-xl bg-[var(--kucur-surface-elevated)]"/></div>
  </article>;
}

function Orders() {
  const { formatCurrency, formatDate, t } = usePreferences();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("active");
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    orderService.list().then((value) => { if (active) setOrders(value); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(tabs.map((item) => [item.key, orders.filter((order) => item.matches(order.status)).length])), [orders]);
  const rows = useMemo(() => {
    const current = tabs.find((item) => item.key === tab);
    return orders.filter((order) => current.matches(order.status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, tab]);

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

  return <PageContainer className="space-y-4">
    <header className="flex min-w-0 items-end justify-between gap-3">
      <h1 className="text-2xl font-extrabold text-[var(--kucur-text)] sm:text-3xl">{t("customerOrders.title")}</h1>
      {!loading && <span className="text-sm font-semibold text-[var(--kucur-text-muted)]">{t("customerOrders.count", { count: orders.length })}</span>}
    </header>

    <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface-muted)] p-1 sm:max-w-md" role="tablist" aria-label={t("customerOrders.tabsLabel")}>
      {tabs.map((item) => <button className={`min-h-11 whitespace-nowrap rounded-lg px-1 text-[13px] font-bold transition sm:text-sm ${tab === item.key ? "bg-[var(--kucur-surface)] text-[var(--kucur-text)] shadow-sm" : "text-[var(--kucur-text-muted)]"}`} type="button" role="tab" aria-selected={tab === item.key} key={item.key} onClick={() => setTab(item.key)}>{t(item.label)}{!loading && counts[item.key] > 0 && ` (${counts[item.key]})`}</button>)}
    </div>

    {error && !cancelling && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}

    <section className="grid min-w-0 gap-3 lg:grid-cols-2" aria-live="polite" aria-busy={loading}>
      {loading && Array.from({ length: 4 }, (_, index) => <OrderSkeleton key={index}/>)}
      {!loading && !error && rows.map((order) => {
        const storeName = order.storeName ?? order.store?.name ?? t("customerOrders.fallbackStore");
        const [firstItem, ...otherItems] = order.items ?? [];
        const [stepIndex, stepKey] = progress[order.status] ?? [0, "stepPending"];
        const isPaid = order.paymentStatus === "paid";
        const canCancel = customerCancellableStatuses.includes(order.status);
        const isMoving = ["picked-up", "on-delivery", "courier-assigned", "ready-for-pickup"].includes(order.status);
        return <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" key={order.id}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-base font-bold text-[var(--kucur-text)]" title={storeName}>{storeName}</h2><p className="text-[13px] text-[var(--kucur-text-muted)]"><span title={order.orderCode ?? order.orderNumber}>{t("customerOrders.orderReference", { number: shortOrderCode(order.orderCode ?? order.orderNumber).slice(1) })}</span> · <time dateTime={order.createdAt}>{formatDate(order.createdAt, { dateStyle: "medium" })}</time></p></div>
            <StatusBadge className="shrink-0" status={order.status}/>
          </div>
          {firstItem && <div className="flex min-w-0 items-center gap-3">
            <span className="block size-14 shrink-0 overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={{ name: firstItem.productName, category: firstItem.product?.category ?? firstItem.productName, image: firstItem.imageUrl }} image={firstItem.imageUrl ? { url: firstItem.imageUrl } : undefined} alt=""/></span>
            <p className="min-w-0 text-[15px] font-semibold leading-snug"><span className="break-words">{firstItem.productName} ×{firstItem.quantity}</span>{otherItems.length > 0 && <small className="block text-[13px] font-medium text-[var(--kucur-text-muted)]">{t("customerOrders.moreItems", { count: otherItems.length })}</small>}</p>
          </div>}
          {stepIndex >= 0 && <div className="grid grid-cols-5 gap-1" aria-hidden="true">{[0, 1, 2, 3, 4].map((index) => <i className={`h-1.5 rounded-full ${index <= stepIndex ? "bg-[var(--kucur-green)]" : "bg-[var(--kucur-border)]"}`} key={index}/>)}</div>}
          <p className="text-sm text-[var(--kucur-text-muted)]">{t(`customerOrders.${stepKey}`)}</p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--kucur-border)] pt-3">
            <div className="min-w-0 flex-1"><span className="block text-[13px] text-[var(--kucur-text-muted)]">{order.status === "cancelled" ? t("customerOrders.total") : isPaid ? t("customerOrders.paid") : t("customerOrders.payOnArrival")}</span><strong className="block text-lg font-extrabold text-[var(--kucur-text)]">{formatCurrency(order.totalAmount)}</strong></div>
            <div className={`${canCancel ? "grid w-full grid-cols-2" : "flex shrink-0"} gap-2`}>
              {canCancel && <button className="min-h-11 rounded-xl border border-rose-300 px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950" type="button" onClick={() => { setCancelling(order.id); setReason(""); setError(""); }}>{t("customerOrders.cancel")}</button>}
              <Link className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold ${isMoving ? "bg-[var(--kucur-green)] text-[var(--kucur-forest-dark)]" : "border border-[var(--kucur-border-strong)] text-[var(--kucur-text)] hover:border-[var(--kucur-green)]"}`} to={`/orders/${order.id}`} aria-label={`${t("customerOrders.details")} ${shortOrderCode(order.orderCode ?? order.orderNumber)}`}>{isMoving ? t("customerOrders.track") : t("customerOrders.details")}</Link>
            </div>
          </div>
          {cancelling === order.id && <div className="grid gap-3 rounded-xl border border-rose-300 bg-[var(--kucur-surface-elevated)] p-3 dark:border-rose-800"><label className="grid gap-1.5 text-[15px] font-semibold text-[var(--kucur-text)]"><span>{t("customerOrders.cancellationReason")}</span><textarea className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2 text-base text-[var(--kucur-text)]" rows="3" value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder={t("customerOrders.cancellationPlaceholder")}/></label>{error && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}<div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><button className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-sm font-bold text-[var(--kucur-text)]" type="button" onClick={() => { setCancelling(null); setError(""); }}>{t("customerOrders.back")}</button><button className="min-h-11 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white" type="button" onClick={() => cancel(order.id)}>{t("customerOrders.confirmCancellation")}</button></div></div>}
        </article>;
      })}
    </section>

    {!loading && !error && !rows.length && <section className="grid min-h-56 justify-items-center content-center gap-2 rounded-2xl border border-dashed border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-6 text-center"><span className="grid size-12 place-items-center rounded-xl bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" aria-hidden="true"><svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg></span><h2 className="text-lg font-bold text-[var(--kucur-text)]">{orders.length ? t("customerOrders.filteredEmpty") : t("customerOrders.empty")}</h2><p className="text-[15px] text-[var(--kucur-text-muted)]">{orders.length ? t("customerOrders.filteredEmptyHint") : t("customerOrders.emptyHint")}</p><Link className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-5 text-base font-bold text-[var(--kucur-forest-dark)]" to="/products">{t("customerOrders.shop")}</Link></section>}
  </PageContainer>;
}

export default Orders;
