import { apiData } from "./apiClient";

export const orderStatusLabels = {
  pending: "Pending", confirmed: "Confirmed", processing: "Processing",
  "ready-for-pickup": "Ready for Pickup", "courier-assigned": "Courier Assigned",
  "picked-up": "Picked Up", "on-delivery": "On Delivery", delivered: "Delivered",
  completed: "Completed", cancelled: "Cancelled",
};
export const paymentStatusLabels = { pending: "Menunggu Pembayaran", paid: "Pembayaran Berhasil", failed: "Pembayaran Gagal", expired: "Pembayaran Kedaluwarsa", cancelled: "Pembayaran Dibatalkan", refunded: "Dana Dikembalikan" };
export const merchantTransitions = { pending: "confirmed", confirmed: "processing", processing: "ready-for-pickup" };

export const normalizeOrder = (order) => ({
  ...order,
  id: String(order.id),
  status: order.fulfillmentStatus ?? order.status,
  storeId: String(order.storeId ?? order.store?.id ?? ""),
  storeName: order.storeName ?? order.store?.name,
  customerName: order.customerName ?? order.customer?.fullName ?? order.recipientName ?? "-",
  productTotal: Number(order.productTotal ?? order.subtotal ?? 0),
  taxPercent: Number(order.taxPercentSnapshot ?? order.taxPercent ?? 0),
  taxAmount: Number(order.taxAmount ?? 0),
  deliveryFee: Number(order.deliveryFee ?? 0),
  courierTip: Number(order.courierTip ?? 0),
  totalAmount: Number(order.totalAmount ?? order.total ?? 0),
  items: (order.items ?? []).map((item) => ({ ...item, variantId: item.productVariantId ?? item.variantId, selectedOptions: item.variantOptions ?? item.selectedOptions ?? {}, unitPrice: Number(item.unitPrice ?? item.price ?? 0), subtotal: Number(item.subtotal ?? 0) })),
  statusHistory: (order.statusHistory ?? order.activities ?? []).map((activity) => ({ ...activity, status: activity.status ?? activity.toStatus ?? order.fulfillmentStatus, timestamp: activity.timestamp ?? activity.createdAt })),
});
const normalizeList = (data) => (Array.isArray(data) ? data : data?.items ?? data?.orders ?? []).map(normalizeOrder);

export const orderService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") params.set(key, value); });
    return normalizeList(await apiData(`/api/orders${params.size ? `?${params}` : ""}`));
  },
  get: async (orderId) => normalizeOrder(await apiData(`/api/orders/${encodeURIComponent(orderId)}`)),
  transitionFulfillment: async (orderId, status) => normalizeOrder(await apiData(`/api/orders/${encodeURIComponent(orderId)}/fulfillment`, { method: "PATCH", body: { status } })),
};
