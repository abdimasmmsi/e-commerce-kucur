import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import ReviewForm from "../../components/ReviewForm";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import DetailSection from "../../components/ui/DetailSection";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import StatusTimeline from "../../components/ui/StatusTimeline";
import { useChat } from "../../context/ChatContext";
import { usePreferences } from "../../context/PreferencesContext";
import { orderService } from "../../services/commerceService";
import { shortOrderCode } from "../../utils/orderCode";

const cancellable = ["pending", "confirmed", "processing"];
// Tahap timeline (5) dan kalimat status, sama dengan daftar Pesanan Saya.
const stages = {
  pending: [0, "stepPending"], confirmed: [1, "stepConfirmed"], processing: [1, "stepProcessing"],
  "ready-for-pickup": [2, "stepReady"], "courier-assigned": [2, "stepReady"], "picked-up": [3, "stepPicked"],
  "on-delivery": [3, "stepOnDelivery"], delivered: [4, "stepDone"], completed: [4, "stepDone"], cancelled: [0, "stepCancelled"], failed: [3, "stepCancelled"],
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { startSellerChat } = useChat();
  const { errorMessage, formatCurrency, formatDate, language, statusLabel, t } = usePreferences();
  const copy = language === "id" ? {
    back: "Pesanan Saya", title: "Pesanan {code}",
    loading: "Memuat detail pesanan", missing: "Pesanan tidak ditemukan", missingDescription: "Pesanan ini tidak tersedia atau Anda tidak memiliki akses.",
    lifecycle: "Status pesanan", created: "Dibuat", processing: "Diproses", pickup: "Siap diambil", deliveryStep: "Diantar", delivered: "Sampai",
    schedule: "Jadwal kirim", courier: "Kurir", noBatch: "Kurir akan dijadwalkan setelah lapak menyiapkan pesanan.",
    items: "Isi pesanan", quantity: "{count} × {price}",
    recipient: "Dikirim ke",
    proof: "Bukti pengiriman", proofAlt: "Bukti pesanan telah diterima", proofMissing: "Foto bukti tidak dapat ditampilkan.", received: "Diterima", by: "oleh",
    activity: "Riwayat pengiriman", noActivity: "Belum ada aktivitas pengiriman.",
    reviews: "Beri ulasan", summary: "Pembayaran", payOnArrival: "Bayar tunai saat barang sampai", paid: "Sudah dibayar", productTotal: "Total produk", tax: "PPN", shipping: "Ongkir", tip: "Tip kurir", total: "Total",
    chat: "Chat penjual", cancel: "Batalkan pesanan", cancelTitle: "Batalkan pesanan?", cancelDescription: "Pesanan yang dibatalkan tidak dapat dilanjutkan kembali.", reason: "Alasan pembatalan", reasonPlaceholder: "Jelaskan alasan pembatalan", keep: "Kembali", cancelling: "Membatalkan...",
  } : {
    back: "My Orders", title: "Order {code}",
    loading: "Loading order details", missing: "Order not found", missingDescription: "This order is unavailable or you do not have access.",
    lifecycle: "Order status", created: "Placed", processing: "Processing", pickup: "Ready for pickup", deliveryStep: "On the way", delivered: "Arrived",
    schedule: "Delivery date", courier: "Courier", noBatch: "A courier will be scheduled once the store has prepared your order.",
    items: "Order items", quantity: "{count} × {price}",
    recipient: "Deliver to",
    proof: "Delivery proof", proofAlt: "Proof that the order was received", proofMissing: "The proof photo cannot be shown.", received: "Received", by: "by",
    activity: "Delivery history", noActivity: "No delivery activity yet.",
    reviews: "Write a review", summary: "Payment", payOnArrival: "Pay cash when it arrives", paid: "Paid", productTotal: "Product total", tax: "VAT", shipping: "Delivery fee", tip: "Courier tip", total: "Total",
    chat: "Chat with seller", cancel: "Cancel order", cancelTitle: "Cancel this order?", cancelDescription: "A cancelled order cannot be resumed.", reason: "Cancellation reason", reasonPlaceholder: "Explain why you are cancelling", keep: "Keep order", cancelling: "Cancelling...",
  };

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    orderService.get(orderId)
      .then((value) => { if (active) setOrder(value); })
      .catch((caught) => { if (active) setError(errorMessage(caught.code, caught.message)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [errorMessage, orderId]);

  const assignment = useMemo(() => order?.deliveryBatchOrders?.find((item) => ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(item.status)) || order?.deliveryBatchOrders?.[0], [order]);
  const timeline = [copy.created, copy.processing, copy.pickup, copy.deliveryStep, copy.delivered].map((label, index) => ({ key: index, label }));
  const [stageIndex, stageKey] = stages[order?.fulfillmentStatus] ?? [0, "stepPending"];
  const exceptional = ["cancelled", "failed"].includes(order?.fulfillmentStatus);
  const finished = ["delivered", "completed"].includes(order?.fulfillmentStatus);
  const [proofBroken, setProofBroken] = useState(false);

  const cancelOrder = async () => {
    setBusy(true); setError("");
    try {
      setOrder(await orderService.cancel(order.id, reason));
      setReason(""); setCancelOpen(false);
    } catch (caught) {
      setError(errorMessage(caught.code, caught.message));
    } finally { setBusy(false); }
  };
  const chat = async () => {
    try {
      const conversation = await startSellerChat({ order });
      navigate(`/messages/${conversation.id}`);
    } catch (cause) { setError(errorMessage(cause.code, cause.message)); }
  };

  if (loading) return <PageContainer><LoadingPanel label={copy.loading} rows={5} /></PageContainer>;
  if (!order) return <PageContainer><EmptyState title={copy.missing} description={error || copy.missingDescription} action={<Button as={Link} to="/orders" variant="secondary">{copy.back}</Button>} /></PageContainer>;

  const fullCode = order.orderCode ?? order.orderNumber;
  const isPaid = order.paymentStatus === "paid";
  const breakdown = [[copy.productTotal, order.productTotal], ...(order.taxAmount > 0 ? [[`${copy.tax} (${order.taxPercent}%)`, order.taxAmount]] : []), [copy.shipping, order.deliveryFee], ...(order.courierTip > 0 ? [[copy.tip, order.courierTip]] : [])];

  return <PageContainer className="space-y-4">
    <header className="grid gap-1">
      <Link className="w-fit text-[15px] font-bold text-[var(--kucur-green-ink)] hover:underline" to="/orders">← {copy.back}</Link>
      <h1 className="text-2xl font-extrabold text-[var(--kucur-text)] sm:text-3xl">{copy.title.replace("{code}", shortOrderCode(fullCode))}</h1>
      <p className="text-sm text-[var(--kucur-text-muted)]">{order.storeName} · {formatDate(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
      <p className="break-all text-[13px] text-[var(--kucur-text-muted)]">{fullCode}</p>
    </header>
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}

    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.65fr)]">
      <main className="grid min-w-0 gap-4">
        <section className="grid min-w-0 gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-label={copy.lifecycle}>
          <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={order.fulfillmentStatus} /></div>
          <p className="text-lg font-bold leading-snug text-[var(--kucur-text)]">{t(`customerOrders.${stageKey}`)}</p>
          <StatusTimeline currentIndex={finished ? timeline.length : stageIndex} exception={exceptional} label={copy.lifecycle} steps={timeline} />
          {!exceptional && <dl className="grid gap-2 rounded-xl bg-[var(--kucur-surface-muted)] p-3 text-[15px] sm:grid-cols-2">
            {assignment ? <><div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.schedule}</dt><dd className="font-semibold">{formatDate(assignment.batch.deliveryDate, { dateStyle: "long" })}</dd></div>{assignment.batch.courier?.fullName && <div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.courier}</dt><dd className="font-semibold">{assignment.batch.courier.fullName}</dd></div>}</> : <p className="text-sm text-[var(--kucur-text-muted)] sm:col-span-2">{copy.noBatch}</p>}
          </dl>}
          <div className="grid gap-2 sm:flex"><Button variant="secondary" onClick={chat}>{copy.chat}</Button>{cancellable.includes(order.fulfillmentStatus) && <Button variant="ghost" className="!text-rose-700 dark:!text-rose-300" onClick={() => setCancelOpen(true)}>{copy.cancel}</Button>}</div>
        </section>

        {order.deliveryProof && <DetailSection title={copy.proof}>
          <div className="grid gap-4 sm:grid-cols-[minmax(180px,280px)_minmax(0,1fr)]">{proofBroken ? <div className="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-[var(--kucur-border-strong)] bg-[var(--kucur-surface-muted)] p-4 text-center text-sm text-[var(--kucur-text-muted)]">{copy.proofMissing}</div> : <img className="aspect-[4/3] w-full rounded-xl border border-[var(--kucur-border)] object-cover" src={order.deliveryProof.photoUrl} alt={copy.proofAlt} onError={() => setProofBroken(true)}/>}<div className="text-[15px] leading-6 text-[var(--kucur-text-muted)]"><p>{copy.received} {formatDate(order.deliveryProof.deliveredAt, { dateStyle: "medium", timeStyle: "short" })}{order.deliveryProof.recipientName ? ` ${copy.by} ${order.deliveryProof.recipientName}` : ""}.</p>{order.deliveryProof.note && <p className="mt-2 text-[var(--kucur-text)]">{order.deliveryProof.note}</p>}</div></div>
        </DetailSection>}

        {order.fulfillmentStatus === "completed" && <DetailSection><div className="grid gap-4" aria-label={copy.reviews}>{order.items.map((item) => <ReviewForm targetType="product" targetId={item.productId} transactionId={order.id} transactionContext={{ title: item.productName }} key={item.id}/>)}</div></DetailSection>}

        <DetailSection title={copy.items}>
          <div className="divide-y divide-[var(--kucur-border)]">
            {order.items.map((item) => <article className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0" key={item.id}>
              <span className="block size-14 overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={{ name: item.productName, category: item.product?.category ?? item.productName }} image={item.imageUrl ? { url: item.imageUrl } : undefined} alt=""/></span>
              <div className="min-w-0"><h3 className="break-words text-[15px] font-semibold text-[var(--kucur-text)]">{item.productName}</h3>{Object.keys(item.selectedOptions ?? {}).length > 0 && <p className="text-sm text-[var(--kucur-text-muted)]">{Object.values(item.selectedOptions).join(" · ")}</p>}<p className="text-sm text-[var(--kucur-text-muted)]">{copy.quantity.replace("{count}", item.quantity).replace("{price}", formatCurrency(Number(item.unitPrice || 0)))}</p></div>
              <strong className="text-[15px]">{formatCurrency(Number(item.subtotal || 0))}</strong>
            </article>)}
          </div>
        </DetailSection>

        <DetailSection title={copy.recipient}>
          <div className="grid gap-1 text-[15px]"><strong>{order.recipientName}</strong><span className="text-[var(--kucur-text-muted)]">{order.recipientPhone}</span><span className="leading-6">{order.deliveryAddress}</span></div>
        </DetailSection>

        <details className="group rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-lg font-extrabold">{copy.activity}<svg className="size-6 text-[var(--kucur-text-muted)] transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
          <div className="mt-3">{order.deliveryActivities?.length ? <ol className="grid gap-0">{order.deliveryActivities.map((item, index) => <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0" key={item.id}><span className="relative z-10 mt-1 size-3 rounded-full bg-[var(--kucur-green)] ring-4 ring-[var(--kucur-green-soft)]" />{index < order.deliveryActivities.length - 1 && <i className="absolute bottom-0 left-[5px] top-4 w-px bg-[var(--kucur-border-strong)]" />}<div><strong className="text-[15px]">{statusLabel(item.status)}</strong><p className="text-sm text-[var(--kucur-text-muted)]">{formatDate(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p></div></li>)}</ol> : <p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.noActivity}</p>}</div>
        </details>
      </main>

      <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5 lg:sticky lg:top-24" aria-labelledby="order-payment">
        <h2 className="text-lg font-extrabold" id="order-payment">{copy.summary}</h2>
        <div className={`rounded-xl p-3 ${isPaid ? "bg-[var(--kucur-green-soft)]" : "bg-[var(--kucur-surface-muted)]"}`}><span className="block text-sm font-semibold text-[var(--kucur-text-muted)]">{isPaid ? copy.paid : order.fulfillmentStatus === "cancelled" ? copy.total : copy.payOnArrival}</span><strong className="text-2xl font-extrabold">{formatCurrency(Number(order.totalAmount || 0))}</strong></div>
        <dl className="grid gap-2 text-[15px]">{breakdown.map(([label, value]) => <div className="flex justify-between gap-3" key={label}><dt className="text-[var(--kucur-text-muted)]">{label}</dt><dd className="font-semibold">{formatCurrency(Number(value || 0))}</dd></div>)}</dl>
      </section>
    </div>

    <ActionDialog open={cancelOpen} busy={busy} destructive title={copy.cancelTitle} description={copy.cancelDescription} cancelLabel={copy.keep} confirmLabel={busy ? copy.cancelling : copy.cancel} onCancel={() => { setCancelOpen(false); setReason(""); }} onConfirm={cancelOrder}>
      <label className="grid gap-2 text-[15px] font-medium">{copy.reason}<textarea className="min-h-24 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2 text-base text-[var(--kucur-text)] outline-none focus:border-[var(--kucur-green)] focus:ring-2 focus:ring-[var(--kucur-green-soft)]" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.reasonPlaceholder} /></label>
    </ActionDialog>
  </PageContainer>;
}
