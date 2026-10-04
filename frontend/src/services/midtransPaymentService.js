import { getOperationalSettings } from "../data/mockOperationalSettings";
import { getOrders, saveOrders } from "../data/mockOrders";
import { determineScheduledDeliveryDate } from "./deliverySchedulingService";
import { apiRequest } from "./apiClient";

const CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
const SNAP_SCRIPT_ID = "midtrans-snap-script";
const finalFailureStatuses = ["failed", "expired", "cancelled"];

export const paymentStatusLabels = { pending: "Menunggu Pembayaran", paid: "Pembayaran Berhasil", failed: "Pembayaran Gagal", expired: "Pembayaran Kedaluwarsa", cancelled: "Pembayaran Dibatalkan", refunded: "Dana Dikembalikan" };
export const midtransClientConfigured = Boolean(CLIENT_KEY) && String(CLIENT_KEY).trim().toUpperCase() !== "PLACEHOLDER";

export function loadMidtransSnap() { if (!CLIENT_KEY) return Promise.reject(new Error("VITE_MIDTRANS_CLIENT_KEY belum dikonfigurasi.")); if (window.snap) return Promise.resolve(window.snap); return new Promise((resolve, reject) => { const existing = document.getElementById(SNAP_SCRIPT_ID); if (existing) { existing.addEventListener("load", () => resolve(window.snap), { once: true }); existing.addEventListener("error", () => reject(new Error("Snap gagal dimuat.")), { once: true }); return; } const script = document.createElement("script"); script.id = SNAP_SCRIPT_ID; script.src = "https://app.sandbox.midtrans.com/snap/snap.js"; script.dataset.clientKey = CLIENT_KEY; script.onload = () => resolve(window.snap); script.onerror = () => reject(new Error("Snap gagal dimuat.")); document.body.appendChild(script); }); }
export const requestSnapToken = ({ checkoutId, orders, customer }) => apiRequest("/api/payments/midtrans/snap-token", { method: "POST", body: { checkoutId, orders: orders.map((order) => ({ id: order.id, amount: order.totalAmount })), grossAmount: orders.reduce((sum, order) => sum + Number(order.totalAmount), 0), customer: { name: customer.fullName, email: customer.email, phone: customer.phone } } });
export const fetchPaymentStatus = (paymentOrderId) => apiRequest(`/api/payments/midtrans/${encodeURIComponent(paymentOrderId)}/status`);
export const getPaymentProviders = () => apiRequest("/api/payments/providers");
export function attachPaymentSession(payment) { const orders = getOrders(); const timestamp = new Date().toISOString(); const updated = orders.map((order) => payment.orderIds.includes(order.id) ? { ...order, paymentOrderId: payment.paymentOrderId, paymentTransactionId: payment.paymentTransactionId, paymentStatus: payment.paymentStatus, midtransSnapToken: payment.snapToken, midtransRedirectUrl: payment.redirectUrl, updatedAt: timestamp } : order); saveOrders(updated); return updated.filter((order) => payment.orderIds.includes(order.id)); }

export function applyVerifiedPayment(payment) {
  const allOrders = getOrders(); const affected = allOrders.filter((order) => payment.orderIds.includes(order.id)); if (!affected.length) return [];
  const settings = getOperationalSettings(); const scheduled = allOrders.filter((order) => !payment.orderIds.includes(order.id)); const timestamp = new Date().toISOString();
  const updated = allOrders.map((order) => { if (!payment.orderIds.includes(order.id) || order.paymentStatus === payment.paymentStatus) return order; let scheduledDeliveryDate = order.scheduledDeliveryDate; if (payment.paymentStatus === "paid" && !scheduledDeliveryDate) { scheduledDeliveryDate = determineScheduledDeliveryDate({ orderCreatedAt: payment.paymentPaidAt ?? timestamp, cutoffTime: order.deliveryCutoffSnapshot ?? settings.deliveryOrderCutoffTime, maxDailyDeliveries: order.maxDailyDeliveriesSnapshot ?? settings.maxDailyDeliveries, existingScheduledOrders: scheduled }); scheduled.push({ ...order, scheduledDeliveryDate }); } const action = { paid: "Payment Successful", failed: "Payment Failed", expired: "Payment Expired", cancelled: "Payment Cancelled", refunded: "Payment Refunded", pending: "Payment Pending" }[payment.paymentStatus]; return { ...order, paymentStatus: payment.paymentStatus, paymentTransactionId: payment.paymentTransactionId, paymentOrderId: payment.paymentOrderId, paymentType: payment.paymentType, paymentPaidAt: payment.paymentPaidAt, paymentExpiredAt: payment.paymentExpiredAt, scheduledDeliveryDate, stockReservationStatus: payment.paymentStatus === "paid" ? "finalized" : finalFailureStatuses.includes(payment.paymentStatus) ? "released" : order.stockReservationStatus, updatedAt: timestamp, statusHistory: [...(order.statusHistory ?? []), { status: order.status, actorType: "system", actorName: "Midtrans Verification", timestamp, action }] }; }); saveOrders(updated); return updated.filter((order) => payment.orderIds.includes(order.id));
}

export async function openSnapPayment(token, callbacks = {}) { if (!midtransClientConfigured) throw new Error("Midtrans Client Key belum dikonfigurasi."); const snap = await loadMidtransSnap(); return snap.pay(token, callbacks); }
