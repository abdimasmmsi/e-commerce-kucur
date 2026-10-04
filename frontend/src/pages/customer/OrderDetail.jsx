import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReviewForm from "../../components/ReviewForm";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import DetailSection from "../../components/ui/DetailSection";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import StatusTimeline from "../../components/ui/StatusTimeline";
import { useChat } from "../../context/ChatContext";
import { usePreferences } from "../../context/PreferencesContext";
import { orderService } from "../../services/commerceService";

const cancellable = ["pending", "confirmed", "processing"];
const lifecycleOrder = ["pending", "confirmed", "processing", "ready-for-pickup", "courier-assigned", "picked-up", "on-delivery", "delivered", "completed"];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { startSellerChat } = useChat();
  const { errorMessage, formatCurrency, formatDate, language, statusLabel } = usePreferences();
  const isId = language === "id";
  const copy = isId ? {
    eyebrow: "Detail pesanan",
    description: "Lacak pemrosesan, pengiriman, dan ringkasan pembayaran pesanan Anda.",
    back: "Kembali ke pesanan",
    loading: "Memuat detail pesanan",
    missing: "Pesanan tidak ditemukan",
    missingDescription: "Pesanan ini tidak tersedia atau Anda tidak memiliki akses.",
    lifecycle: "Status pesanan",
    lifecycleDescription: "Perkembangan pesanan dari dibuat hingga selesai.",
    created: "Dibuat", payment: "Pembayaran", processing: "Diproses", pickup: "Siap diambil", deliveryStep: "Dikirim", delivered: "Terkirim", review: "Ulasan",
    items: "Produk", quantity: "Jumlah", unitPrice: "Harga satuan", subtotal: "Subtotal",
    recipient: "Penerima", address: "Alamat pengiriman", phone: "Nomor telepon",
    delivery: "Pengiriman", orderStatus: "Status pesanan", deliveryStatus: "Status pengiriman", schedule: "Jadwal", courier: "Kurir", noBatch: "Pesanan belum dijadwalkan ke batch pengiriman.",
    proof: "Bukti pengiriman", proofAlt: "Bukti pesanan telah diterima", received: "Diterima", by: "oleh",
    activity: "Riwayat aktivitas", noActivity: "Belum ada aktivitas pengiriman.",
    reviews: "Ulasan produk", summary: "Ringkasan pembayaran", productTotal: "Total produk", shipping: "Ongkir", tip: "Tip kurir", total: "Total",
    chat: "Chat penjual", cancel: "Batalkan pesanan", cancelTitle: "Batalkan pesanan?", cancelDescription: "Pesanan yang dibatalkan tidak dapat dilanjutkan kembali.", reason: "Alasan pembatalan", reasonPlaceholder: "Jelaskan alasan pembatalan", keep: "Kembali", cancelling: "Membatalkan...",
  } : {
    eyebrow: "Order details",
    description: "Track processing, delivery, and the payment summary for your order.",
    back: "Back to orders",
    loading: "Loading order details",
    missing: "Order not found",
    missingDescription: "This order is unavailable or you do not have access.",
    lifecycle: "Order status",
    lifecycleDescription: "Your order's progress from creation to completion.",
    created: "Created", payment: "Payment", processing: "Processing", pickup: "Ready for pickup", deliveryStep: "In delivery", delivered: "Delivered", review: "Review",
    items: "Products", quantity: "Quantity", unitPrice: "Unit price", subtotal: "Subtotal",
    recipient: "Recipient", address: "Delivery address", phone: "Phone number",
    delivery: "Delivery", orderStatus: "Order status", deliveryStatus: "Delivery status", schedule: "Schedule", courier: "Courier", noBatch: "This order has not been scheduled into a delivery batch.",
    proof: "Delivery proof", proofAlt: "Proof that the order was received", received: "Received", by: "by",
    activity: "Activity history", noActivity: "No delivery activity yet.",
    reviews: "Product reviews", summary: "Payment summary", productTotal: "Product total", shipping: "Delivery fee", tip: "Courier tip", total: "Total",
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
  const timeline = useMemo(() => [copy.created, copy.payment, copy.processing, copy.pickup, copy.deliveryStep, copy.delivered, copy.review].map((label, index) => ({ key: index, label })), [copy.created, copy.delivered, copy.deliveryStep, copy.payment, copy.pickup, copy.processing, copy.review]);
  const rawStatusIndex = lifecycleOrder.indexOf(order?.fulfillmentStatus);
  const timelineIndex = rawStatusIndex < 0 ? 0 : rawStatusIndex <= 1 ? rawStatusIndex : rawStatusIndex === 2 ? 2 : rawStatusIndex <= 5 ? 3 : rawStatusIndex === 6 ? 4 : rawStatusIndex === 7 ? 5 : 6;
  const exceptional = ["cancelled", "failed"].includes(order?.fulfillmentStatus);

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

  return <PageContainer>
    <PageHeader eyebrow={copy.eyebrow} title={order.orderNumber} description={`${order.storeName} · ${copy.description}`} actions={<><StatusBadge status={order.fulfillmentStatus} /><Button as={Link} to="/orders" variant="secondary">← {copy.back}</Button></>} />
    {error && <p className="mb-5 rounded-kucur-control border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}

    <DetailSection title={copy.lifecycle} description={copy.lifecycleDescription} className="mb-5">
      <StatusTimeline currentIndex={timelineIndex} exception={exceptional} label={copy.lifecycle} steps={timeline} />
    </DetailSection>

    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.65fr)]">
      <main className="grid min-w-0 gap-5">
        <DetailSection title={copy.items}>
          <div className="divide-y divide-[var(--kucur-border)]">
            {order.items.map((item) => <article className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" key={item.id}>
              <div className="min-w-0"><h3 className="break-words font-semibold text-kucur-ink">{item.productName}</h3><p className="mt-1 text-xs text-[var(--kucur-muted)]">{copy.quantity}: {item.quantity}</p></div>
              <div className="text-sm sm:text-right"><span className="text-xs text-[var(--kucur-muted)] sm:block">{copy.unitPrice}</span>{formatCurrency(Number(item.unitPrice || 0))}</div>
              <strong className="text-sm sm:min-w-28 sm:text-right"><span className="block text-xs font-normal text-[var(--kucur-muted)]">{copy.subtotal}</span>{formatCurrency(Number(item.subtotal || 0))}</strong>
            </article>)}
          </div>
        </DetailSection>

        <div className="grid gap-5 md:grid-cols-2">
          <DetailSection title={copy.recipient}>
            <dl className="grid gap-4 text-sm"><div><dt className="text-[var(--kucur-muted)]">{copy.recipient}</dt><dd className="mt-1 font-semibold text-kucur-ink">{order.recipientName}</dd></div><div><dt className="text-[var(--kucur-muted)]">{copy.phone}</dt><dd className="mt-1 text-kucur-ink">{order.recipientPhone}</dd></div><div><dt className="text-[var(--kucur-muted)]">{copy.address}</dt><dd className="mt-1 leading-6 text-kucur-ink">{order.deliveryAddress}</dd></div></dl>
          </DetailSection>
          <DetailSection title={copy.delivery}>
            <dl className="grid gap-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><dt className="text-[var(--kucur-muted)]">{copy.orderStatus}</dt><dd><StatusBadge status={order.fulfillmentStatus} /></dd></div>
              {assignment ? <><div className="flex flex-wrap items-center justify-between gap-3"><dt className="text-[var(--kucur-muted)]">{copy.deliveryStatus}</dt><dd><StatusBadge status={assignment.status} /></dd></div><div className="flex flex-wrap justify-between gap-3"><dt className="text-[var(--kucur-muted)]">{copy.schedule}</dt><dd className="font-medium text-kucur-ink">{formatDate(assignment.batch.deliveryDate, { dateStyle: "long" })}</dd></div>{assignment.batch.courier?.fullName && <div className="flex flex-wrap justify-between gap-3"><dt className="text-[var(--kucur-muted)]">{copy.courier}</dt><dd className="font-medium text-kucur-ink">{assignment.batch.courier.fullName}</dd></div>}</> : <p className="text-sm text-[var(--kucur-muted)]">{copy.noBatch}</p>}
            </dl>
          </DetailSection>
        </div>

        {order.deliveryProof && <DetailSection title={copy.proof}>
          <div className="grid gap-4 sm:grid-cols-[minmax(180px,280px)_minmax(0,1fr)]"><img className="aspect-[4/3] w-full rounded-kucur-control border border-[var(--kucur-border)] object-cover" src={order.deliveryProof.photoUrl} alt={copy.proofAlt}/><div className="text-sm leading-6 text-[var(--kucur-muted)]"><p>{copy.received} {formatDate(order.deliveryProof.deliveredAt, { dateStyle: "medium", timeStyle: "short" })}{order.deliveryProof.recipientName ? ` ${copy.by} ${order.deliveryProof.recipientName}` : ""}.</p>{order.deliveryProof.note && <p className="mt-3 text-kucur-ink">{order.deliveryProof.note}</p>}</div></div>
        </DetailSection>}

        <DetailSection title={copy.activity}>
          {order.deliveryActivities?.length ? <ol className="grid gap-0">{order.deliveryActivities.map((item, index) => <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0" key={item.id}><span className="relative z-10 mt-1 size-3 rounded-full bg-[var(--kucur-green)] ring-4 ring-[var(--kucur-green-soft)]" />{index < order.deliveryActivities.length - 1 && <i className="absolute bottom-0 left-[5px] top-4 w-px bg-[var(--kucur-border-strong)]" />}<div><strong className="text-sm text-kucur-ink">{statusLabel(item.status)}</strong><p className="mt-1 text-xs text-[var(--kucur-muted)]">{formatDate(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p></div></li>)}</ol> : <p className="text-sm text-[var(--kucur-muted)]">{copy.noActivity}</p>}
        </DetailSection>

        {order.fulfillmentStatus === "completed" && <DetailSection title={copy.reviews}><div className="grid gap-4">{order.items.map((item) => <ReviewForm targetType="product" targetId={item.productId} transactionId={order.id} transactionContext={{ title: item.productName }} key={item.id}/>)}</div></DetailSection>}
      </main>

      <DetailSection title={copy.summary} className="lg:sticky lg:top-24">
        <dl className="grid gap-3 text-sm">{[[copy.productTotal, order.productTotal], [copy.shipping, order.deliveryFee], [copy.tip, order.courierTip]].map(([label, value]) => <div className="flex justify-between gap-3" key={label}><dt className="text-[var(--kucur-muted)]">{label}</dt><dd className="font-medium text-kucur-ink">{formatCurrency(Number(value || 0))}</dd></div>)}<div className="mt-1 flex justify-between gap-3 border-t border-[var(--kucur-border)] pt-4 text-base"><dt className="font-semibold text-kucur-ink">{copy.total}</dt><dd className="font-bold text-kucur-ink">{formatCurrency(Number(order.totalAmount || 0))}</dd></div></dl>
        <div className="mt-5 grid gap-2"><Button onClick={chat}>{copy.chat}</Button>{cancellable.includes(order.fulfillmentStatus) && <Button variant="danger" onClick={() => setCancelOpen(true)}>{copy.cancel}</Button>}</div>
      </DetailSection>
    </div>

    <ActionDialog open={cancelOpen} busy={busy} destructive title={copy.cancelTitle} description={copy.cancelDescription} cancelLabel={copy.keep} confirmLabel={busy ? copy.cancelling : copy.cancel} onCancel={() => { setCancelOpen(false); setReason(""); }} onConfirm={cancelOrder}>
      <label className="grid gap-2 text-sm font-medium text-kucur-ink">{copy.reason}<textarea className="min-h-24 w-full rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2 text-kucur-ink outline-none focus:border-[var(--kucur-green)] focus:ring-2 focus:ring-[var(--kucur-green-soft)]" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.reasonPlaceholder} /></label>
    </ActionDialog>
  </PageContainer>;
}
