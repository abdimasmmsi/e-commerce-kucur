import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { merchantTransitions, orderService } from "../../services/orderService";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import ProductImage from "../../components/ProductImage";
import TransactionAttachmentImage from "../../components/TransactionAttachmentImage";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import DetailSection from "../../components/ui/DetailSection";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import StatusTimeline from "../../components/ui/StatusTimeline";
import { usePreferences } from "../../context/PreferencesContext";
import { shortOrderCode } from "../../utils/orderCode";

// Tahap timeline (5) dari sudut pandang lapak.
const stages = { pending: 0, confirmed: 1, processing: 1, "ready-for-pickup": 2, "courier-assigned": 2, "picked-up": 3, "on-delivery": 3, delivered: 4, completed: 4, cancelled: 0, failed: 3 };
const actionKeys = { confirmed: ["actionConfirmed", "confirmConfirmed"], processing: ["actionProcessing", "confirmProcessing"], "ready-for-pickup": ["actionReady", "confirmReady"] };

function OrderDetailWorkspace({ storeId, orderId }) {
  const { formatCurrency, formatDate, language, statusLabel, t } = usePreferences();
  const copy = language === "id" ? {
    back: "Pesanan", title: "Pesanan {code}", steps: ["Masuk", "Dikemas", "Siap diambil", "Diantar", "Sampai"],
    next: { pending: "Pesanan baru. Terima supaya pembeli tahu pesanannya diproses.", confirmed: "Pesanan diterima. Mulai siapkan barangnya.", processing: "Sedang dikemas. Tandai siap kalau barang sudah lengkap.", "ready-for-pickup": "Barang siap. Kurir akan mengambil sesuai jadwal pengiriman.", "courier-assigned": "Kurir sudah ditugaskan untuk mengambil barang.", "picked-up": "Barang sudah diambil kurir.", "on-delivery": "Sedang diantar ke pembeli.", delivered: "Pesanan sudah sampai ke pembeli.", completed: "Pesanan selesai.", cancelled: "Pesanan dibatalkan.", failed: "Pengiriman gagal." },
    prepare: "Barang yang disiapkan", quantity: "{count} × {price}", receive: "Kamu menerima {amount} dari kurir saat barang diambil.", receiveDone: "Harga barang {amount} sudah dibayar kurir.", money: "Uang",
    history: "Riwayat status", buyer: "Pembeli",
  } : {
    back: "Orders", title: "Order {code}", steps: ["New", "Packing", "Ready", "On the way", "Arrived"],
    next: { pending: "New order. Accept it so the buyer knows it is being prepared.", confirmed: "Order accepted. Start preparing the items.", processing: "Packing in progress. Mark it ready when everything is complete.", "ready-for-pickup": "Ready. The courier will pick it up on the delivery schedule.", "courier-assigned": "A courier has been assigned to pick it up.", "picked-up": "The courier has picked up the items.", "on-delivery": "On the way to the buyer.", delivered: "The order reached the buyer.", completed: "Order completed.", cancelled: "Order cancelled.", failed: "Delivery failed." },
    prepare: "Items to prepare", quantity: "{count} × {price}", receive: "You receive {amount} from the courier at pickup.", receiveDone: "The courier has paid {amount} for the items.", money: "Money",
    history: "Status history", buyer: "Buyer",
  };
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const nextStatus = order ? merchantTransitions[order.status] : null;

  useEffect(() => {
    let active = true;
    orderService.get(orderId).then((row) => { if (!active) return; if (row.storeId !== String(storeId)) setError(t("merchantOrderDetail.unavailable")); else setOrder(row); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, storeId, t]);

  const handleTransition = async () => {
    if (!order || !nextStatus) return;
    setTransitioning(true); setError("");
    try { setOrder(await orderService.transitionFulfillment(order.id, nextStatus)); setConfirmationOpen(false); }
    catch (caught) { setError(caught.message); }
    finally { setTransitioning(false); }
  };

  if (loading) return <PageContainer><LoadingPanel label={t("merchantOrderDetail.loading")} rows={5} /></PageContainer>;
  if (!order) return <PageContainer><EmptyState title={t("merchantOrderDetail.notFound")} description={error || t("merchantOrderDetail.notFoundHint")} action={<Button as={Link} variant="secondary" to={`/merchant/stores/${storeId}/orders`}>{t("merchantOrderDetail.backOrders")}</Button>} /></PageContainer>;

  const code = order.orderNumber ?? order.orderCode;
  const exceptional = ["cancelled", "failed"].includes(order.status);
  const finished = ["delivered", "completed"].includes(order.status);
  const waitingPayment = nextStatus && order.paymentMethod === "MIDTRANS" && order.paymentStatus !== "paid";
  const pickedUp = ["picked-up", "on-delivery", "delivered", "completed"].includes(order.status);
  const assignment = order.deliveryBatchOrders?.[0];
  const breakdown = [[t("merchantOrderDetail.productTotal"), order.productTotal], ...(order.taxAmount > 0 ? [[t("merchantOrderDetail.tax", { percent: order.taxPercent }), order.taxAmount]] : []), [t("merchantOrderDetail.deliveryFee"), order.deliveryFee], ...(order.courierTip > 0 ? [[t("merchantOrderDetail.courierTip"), order.courierTip]] : []), [t("merchantOrderDetail.codTotal"), order.totalAmount]];

  return <>
    <PageContainer className="space-y-4">
      <header className="grid gap-1">
        <Link className="w-fit text-[15px] font-bold text-[var(--kucur-green-ink)] hover:underline" to={`/merchant/stores/${storeId}/orders`}>← {copy.back}</Link>
        <h1 className="text-2xl font-extrabold text-[var(--kucur-text)] sm:text-3xl">{copy.title.replace("{code}", shortOrderCode(code))}</h1>
        <p className="text-sm text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.created", { date: formatDate(order.createdAt, { dateStyle: "medium", timeStyle: "short" }) })}</p>
        <p className="break-all text-[13px] text-[var(--kucur-text-muted)]">{code}</p>
      </header>
      {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert"><strong className="block">{t("merchantOrderDetail.processFailed")}</strong>{error}</p>}

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
        <main className="grid min-w-0 gap-4">
          <section className="grid min-w-0 gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-label={t("merchantOrderDetail.currentStatus")}>
            <StatusBadge status={order.status} />
            <p className="text-lg font-bold leading-snug">{copy.next[order.status] ?? statusLabel(order.status)}</p>
            <StatusTimeline currentIndex={finished ? copy.steps.length : stages[order.status] ?? 0} exception={exceptional} label={t("merchantOrderDetail.currentStatus")} steps={copy.steps.map((label, index) => ({ key: index, label }))} />
            {nextStatus && !waitingPayment && <Button className="w-full sm:w-auto" type="button" onClick={() => setConfirmationOpen(true)}>{t(`merchantOrderDetail.${actionKeys[nextStatus][0]}`)}</Button>}
            {waitingPayment && <p className="rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"><strong className="block">{t("merchantOrderDetail.waitingPayment")}</strong>{t("merchantOrderDetail.waitingPaymentHint")}</p>}
          </section>

          <DetailSection title={copy.prepare}>
            <div className="divide-y divide-[var(--kucur-border)]">{order.items.map((item) => <article className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0" key={`${item.productId}-${item.productName}`}>
              <span className="block size-14 overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={{ name: item.productName, category: item.product?.category ?? item.productName }} image={item.imageUrl ? { url: item.imageUrl } : undefined} alt="" /></span>
              <div className="min-w-0"><strong className="block break-words text-[15px]">{item.productName}</strong>{Object.keys(item.selectedOptions ?? {}).length > 0 && <span className="block text-sm text-[var(--kucur-text-muted)]">{Object.entries(item.selectedOptions).map(([name, value]) => `${name}: ${value}`).join(" · ")}</span>}<span className="text-sm text-[var(--kucur-text-muted)]">{copy.quantity.replace("{count}", item.quantity).replace("{price}", formatCurrency(item.unitPrice ?? item.price))}</span></div>
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--kucur-green-soft)] text-lg font-extrabold text-[var(--kucur-green-ink)]" aria-label={t("merchantOrderDetail.quantity")}>{item.quantity}</span>
            </article>)}</div>
          </DetailSection>

          <DetailSection title={copy.buyer}>
            <div className="grid gap-1 text-[15px]"><strong>{order.recipientName ?? order.customerName}</strong><span className="text-[var(--kucur-text-muted)]">{order.recipientPhone ?? order.customerPhone ?? t("merchantOrderDetail.unavailableValue")}</span><span className="leading-6">{order.deliveryAddress}</span></div>
          </DetailSection>

          {(order.deliveryProof ?? []).length > 0 && <DetailSection title={t("merchantOrderDetail.deliveryProof")}><div className="grid gap-4 sm:grid-cols-2">{order.deliveryProof.map((attachment) => <article key={attachment.id}><TransactionAttachmentImage attachment={attachment} /></article>)}</div></DetailSection>}

          <details className="group rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-lg font-extrabold">{copy.history}<svg className="size-6 text-[var(--kucur-text-muted)] transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
            <ol className="mt-3 grid">{order.statusHistory.map((history, index) => <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0" key={`${history.status}-${history.timestamp}-${index}`}><span className="relative z-10 mt-1 size-3 rounded-full bg-[var(--kucur-green)] ring-4 ring-[var(--kucur-green-soft)]" />{index < order.statusHistory.length - 1 && <i className="absolute bottom-0 left-[5px] top-4 w-px bg-[var(--kucur-border-strong)]" />}<div><strong className="text-[15px]">{statusLabel(history.status)}</strong><p className="text-sm text-[var(--kucur-text-muted)]">{[history.actorType && t(`role.${String(history.actorType).toLowerCase()}`), history.actorName, formatDate(history.timestamp, { dateStyle: "medium", timeStyle: "short" })].filter(Boolean).join(" · ")}</p></div></li>)}</ol>
          </details>
        </main>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="merchant-order-money">
            <h2 className="text-lg font-extrabold" id="merchant-order-money">{copy.money}</h2>
            {order.status !== "cancelled" && <p className="rounded-xl bg-[var(--kucur-green-soft)] p-3 text-[15px] font-semibold">{(pickedUp ? copy.receiveDone : copy.receive).replace("{amount}", formatCurrency(order.productTotal))}</p>}
            <dl className="grid gap-2 text-[15px]">{breakdown.map(([label, value], index) => <div className={`flex justify-between gap-3 ${index === breakdown.length - 1 ? "border-t border-[var(--kucur-border)] pt-2 font-bold" : ""}`} key={label}><dt className={index === breakdown.length - 1 ? "" : "text-[var(--kucur-text-muted)]"}>{label}</dt><dd className="font-semibold">{formatCurrency(Number(value || 0))}</dd></div>)}</dl>
          </section>
          {assignment && <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="merchant-order-delivery">
            <h2 className="text-lg font-extrabold" id="merchant-order-delivery">{t("merchantOrderDetail.delivery")}</h2>
            <dl className="grid gap-2 text-[15px] [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dt]:text-[var(--kucur-text-muted)] [&_dd]:text-right [&_dd]:font-semibold">
              <div><dt>{t("merchantOrderDetail.courier")}</dt><dd>{assignment.batch.courier?.fullName ?? t("merchantOrderDetail.unavailableValue")}</dd></div>
              <div><dt>{t("merchantOrderDetail.schedule")}</dt><dd>{formatDate(assignment.batch.deliveryDate, { dateStyle: "medium" })}</dd></div>
              <div><dt>{t("merchantOrderDetail.delivery")}</dt><dd>{statusLabel(assignment.status)}</dd></div>
              <div><dt>{t("merchantOrderDetail.pickupReadiness")}</dt><dd>{order.pickupConfirmations?.[0]?.isReady ? t("merchantOrderDetail.ready") : t("merchantOrderDetail.unconfirmed")}</dd></div>
            </dl>
          </section>}
        </aside>
      </div>
    </PageContainer>
    <ActionDialog open={confirmationOpen} busy={transitioning} title={nextStatus ? t(`merchantOrderDetail.${actionKeys[nextStatus][1]}`) : ""} description={t("merchantOrderDetail.irreversible")} cancelLabel={t("merchantOrderDetail.cancel")} confirmLabel={transitioning ? t("merchantOrderDetail.processing") : t("merchantOrderDetail.continue")} onCancel={() => setConfirmationOpen(false)} onConfirm={handleTransition} />
  </>;
}

function OrderDetail() {
  const { storeId, orderId } = useParams();
  const resolvedStoreId = canonicalStoreId(storeId);
  return <OrderDetailWorkspace key={`${resolvedStoreId}-${orderId}`} storeId={resolvedStoreId} orderId={orderId} />;
}

export default OrderDetail;
