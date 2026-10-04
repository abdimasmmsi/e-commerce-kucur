import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  merchantTransitions,
  orderService,
} from "../../services/orderService";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import TransactionAttachmentImage from "../../components/TransactionAttachmentImage";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import StatusTimeline from "../../components/ui/StatusTimeline";
import { usePreferences } from "../../context/PreferencesContext";

const lifecycleStatuses = ["pending", "confirmed", "processing", "ready-for-pickup", "courier-assigned", "picked-up", "on-delivery", "delivered", "completed"];

function OrderDetailWorkspace({ storeId, orderId }) {
  const { formatCurrency, formatDate, statusLabel, t } = usePreferences();
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

  if (!order) {
    return <PageContainer><EmptyState title={t("merchantOrderDetail.notFound")} description={error || t("merchantOrderDetail.notFoundHint")} action={<Button as={Link} variant="secondary" to={`/merchant/stores/${storeId}/orders`}>{t("merchantOrderDetail.backOrders")}</Button>} /></PageContainer>;
  }

  const currentIndex = Math.max(0, lifecycleStatuses.indexOf(order.status));
  const timelineSteps = lifecycleStatuses.map((status) => ({ key: status, label: statusLabel(status) }));
  const exceptional = ["cancelled", "failed"].includes(order.status);

  return (
    <>
    <PageContainer className="space-y-5 [&_h2]:text-lg [&_h2]:font-semibold [&_section]:min-w-0 [&_section]:rounded-kucur-card [&_section]:border [&_section]:border-[var(--kucur-border)] [&_section]:bg-[var(--kucur-surface)] [&_section]:p-4 sm:[&_section]:p-5 [&_strong]:break-words [&_p]:break-words [&_textarea]:w-full [&_textarea]:rounded-kucur-control [&_textarea]:border [&_textarea]:border-[var(--kucur-border-strong)] [&_textarea]:bg-[var(--kucur-surface)] [&_textarea]:p-3">
      <PageHeader eyebrow={t("merchantOrderDetail.eyebrow")} title={order.orderNumber} description={t("merchantOrderDetail.created", { date: formatDate(order.createdAt, { dateStyle: "long", timeStyle: "short" }) })} actions={<><StatusBadge status={order.status}/><Button as={Link} variant="secondary" to={`/merchant/stores/${storeId}/orders`}>{t("merchantOrderDetail.back")}</Button></>} />
      {error && <section role="alert"><strong>{t("merchantOrderDetail.processFailed")}</strong><p>{error}</p></section>}

      <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2>{t("merchantOrderDetail.currentStatus")}</h2><StatusBadge status={order.status}/></div><StatusTimeline currentIndex={currentIndex} exception={exceptional} label={t("merchantOrderDetail.currentStatus")} steps={timelineSteps}/></section>

      <div className="grid min-w-0 max-w-full items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.38fr)]">
        <div className="min-w-0 max-w-full">
          <section className="min-w-0 max-w-full grid gap-4">
            <div>
              <span>{t("merchantOrderDetail.currentStatus")}</span>
              <StatusBadge status={order.status} />
            </div>
            <div>
              <span>{t("merchantOrderDetail.orderNumber")}</span>
              <strong>{order.orderNumber}</strong>
            </div>
            <div>
              <span>{t("merchantOrderDetail.orderDate")}</span>
              <strong>{formatDate(order.createdAt, { dateStyle: "long", timeStyle: "short" })}</strong>
            </div>
            <div>
              <span>{t("merchantOrderDetail.paymentMethod")}</span>
              <strong>{order.paymentMethod === "MIDTRANS" ? t("merchantOrderDetail.onlinePayment") : t("merchantOrderDetail.cod")}</strong>
              <small>{order.paymentMethod === "MIDTRANS" ? statusLabel(order.paymentStatus) : t("merchantOrderDetail.paidOnReceipt")}</small>
            </div>
          </section>

          <section className="min-w-0 max-w-full grid gap-4">
            <h2>{t("merchantOrderDetail.customer")}</h2>
            <div className="min-w-0 max-w-full">
              <div>
                <span>{t("merchantOrderDetail.customerName")}</span>
                <strong>{order.recipientName ?? order.customerName}</strong>
              </div>
              <div><span>{t("merchantOrderDetail.phone")}</span><strong>{order.recipientPhone ?? order.customerPhone ?? t("merchantOrderDetail.unavailableValue")}</strong></div>
              <div>
                <span>{t("merchantOrderDetail.deliveryAddress")}</span>
                <p>{order.deliveryAddress}</p>
              </div>
            </div>
          </section>

          {(order.deliveryProof ?? []).length > 0 && <section className="min-w-0 max-w-full grid gap-4"><div><h2>{t("merchantOrderDetail.deliveryProof")}</h2><span>{t("merchantOrderDetail.photos", { count: order.deliveryProof.length })}</span></div><div className="min-w-0 max-w-full grid gap-4">{order.deliveryProof.map((attachment) => <article key={attachment.id}><TransactionAttachmentImage attachment={attachment} /></article>)}</div></section>}

          <section className="min-w-0 max-w-full grid gap-4">
            <h2>{t("merchantOrderDetail.items")}</h2>
            <div className="min-w-0 max-w-full">
              <div className="min-w-0 max-w-full" aria-hidden="true">
                <span>{t("merchantOrderDetail.product")}</span><span>{t("merchantOrderDetail.quantity")}</span><span>{t("merchantOrderDetail.price")}</span><span>{t("merchantOrderDetail.subtotal")}</span>
              </div>
              {order.items.map((item) => (
                <article className="min-w-0 max-w-full" key={`${item.productId}-${item.productName}`}>
                  <strong>{item.productName}</strong>
                  {Object.entries(item.selectedOptions ?? {}).map(([name, value]) => <small key={name}>{name}: {value}</small>)}
                  <div><span>{t("merchantOrderDetail.quantity")}</span>{item.quantity}</div>
                  <div><span>{t("merchantOrderDetail.price")}</span>{formatCurrency(item.unitPrice ?? item.price)}</div>
                  <div><span>{t("merchantOrderDetail.subtotal")}</span><strong>{formatCurrency(item.subtotal)}</strong></div>
                </article>
              ))}
            </div>
          </section>

          <section className="min-w-0 max-w-full grid gap-4">
            <h2>{t("merchantOrderDetail.history")}</h2>
            <div className="min-w-0 max-w-full">
              {order.statusHistory.map((history, index) => (
                <article className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] gap-3 border-l-2 border-emerald-200 pb-5 pl-3" key={`${history.status}-${history.timestamp}-${index}`}>
                  <div className="min-w-0 max-w-full" />
                  <div>
                    <div className="min-w-0 max-w-full">
                      <strong>{statusLabel(history.status)}</strong>
                      <span>{t(`role.${String(history.actorType).toLowerCase()}`)}</span>
                    </div>
                    <p>{history.actorName}</p>
                    <time>{formatDate(history.timestamp, { dateStyle: "long", timeStyle: "short" })}</time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="min-w-0 max-w-full">
          <section className="min-w-0 max-w-full grid gap-4">
            <h2>{t("merchantOrderDetail.paymentSummary")}</h2>
            <dl className="min-w-0 max-w-full">
              <div><dt>{t("merchantOrderDetail.productTotal")}</dt><dd>{formatCurrency(order.productTotal)}</dd></div>
              <div><dt>{t("merchantOrderDetail.deliveryFee")}</dt><dd>{formatCurrency(order.deliveryFee)}</dd></div>
              <div><dt>{t("merchantOrderDetail.courierTip")}</dt><dd>{formatCurrency(order.courierTip)}</dd></div>
              <div className="min-w-0 max-w-full"><dt>{t("merchantOrderDetail.codTotal")}</dt><dd>{formatCurrency(order.totalAmount)}</dd></div>
            </dl>
          </section>

          {order.deliveryBatchOrders?.[0] && (
            <section className="min-w-0 max-w-full grid gap-4">
              <h2>{t("merchantOrderDetail.delivery")}</h2>
              <dl><div><dt>{t("merchantOrderDetail.courier")}</dt><dd>{order.deliveryBatchOrders[0].batch.courier?.fullName ?? t("merchantOrderDetail.unavailableValue")}</dd></div><div><dt>{t("merchantOrderDetail.batch")}</dt><dd>{statusLabel(order.deliveryBatchOrders[0].batch.status)}</dd></div><div><dt>{t("merchantOrderDetail.delivery")}</dt><dd className="font-bold text-emerald-700 dark:text-emerald-300">{statusLabel(order.deliveryBatchOrders[0].status)}</dd></div><div><dt>{t("merchantOrderDetail.schedule")}</dt><dd>{formatDate(order.deliveryBatchOrders[0].batch.deliveryDate, { dateStyle: "long", timeStyle: "short" })}</dd></div><div><dt>{t("merchantOrderDetail.pickupReadiness")}</dt><dd>{order.pickupConfirmations?.[0]?.isReady ? t("merchantOrderDetail.ready") : t("merchantOrderDetail.unconfirmed")}</dd></div></dl>
            </section>
          )}

          {nextStatus && !(order.paymentMethod === "MIDTRANS" && order.paymentStatus !== "paid") && (
            <section className="min-w-0 max-w-full grid gap-4">
              <h2>{t("merchantOrderDetail.merchantAction")}</h2>
              <p>{t("merchantOrderDetail.actionHint")}</p>
              <Button type="button" onClick={() => setConfirmationOpen(true)}>
                {t(nextStatus === "confirmed" ? "merchantOrderDetail.actionConfirmed" : nextStatus === "processing" ? "merchantOrderDetail.actionProcessing" : "merchantOrderDetail.actionReady")}
              </Button>
            </section>
          )}

          {nextStatus && order.paymentMethod === "MIDTRANS" && order.paymentStatus !== "paid" && <section className="min-w-0 max-w-full grid gap-4"><strong>{t("merchantOrderDetail.waitingPayment")}</strong><p>{t("merchantOrderDetail.waitingPaymentHint")}</p></section>}

          {!nextStatus && (
            <section className="min-w-0 max-w-full grid gap-4">
              <strong>{t("merchantOrderDetail.noAction")}</strong>
              <p>{t("merchantOrderDetail.noActionHint")}</p>
            </section>
          )}
        </aside>
      </div>

    </PageContainer>
    <ActionDialog open={confirmationOpen} busy={transitioning} title={t(nextStatus === "confirmed" ? "merchantOrderDetail.confirmConfirmed" : nextStatus === "processing" ? "merchantOrderDetail.confirmProcessing" : "merchantOrderDetail.confirmReady")} description={t("merchantOrderDetail.irreversible")} cancelLabel={t("merchantOrderDetail.cancel")} confirmLabel={transitioning ? t("merchantOrderDetail.processing") : t("merchantOrderDetail.continue")} onCancel={() => setConfirmationOpen(false)} onConfirm={handleTransition} />
    </>
  );
}

function OrderDetail() {
  const { storeId, orderId } = useParams();
  const resolvedStoreId = canonicalStoreId(storeId);
  return (
    <OrderDetailWorkspace
      key={`${resolvedStoreId}-${orderId}`}
      storeId={resolvedStoreId}
      orderId={orderId}
    />
  );
}

export default OrderDetail;
