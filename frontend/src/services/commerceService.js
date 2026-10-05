import { apiData } from "./apiClient";
import { normalizeProduct } from "./productService";

const rows = (value, key) => Array.isArray(value) ? value : value?.[key] ?? [];
export const CART_CHANGED_EVENT = "kucur-commerce-cart-changed";
const announceCart = (cart) => {
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { cart } }));
  return cart;
};
export const normalizeCart = (payload) => ({ ...payload, items: rows(payload, "items").map((item) => ({ ...item, id: String(item.id), quantity: Number(item.quantity), product: item.product ? normalizeProduct(item.product) : null, variant: item.productVariant ?? item.variant ?? null, unitPrice: Number(item.unitPrice ?? item.productVariant?.price ?? item.variant?.price ?? item.product?.price ?? 0), subtotal: Number(item.subtotal ?? 0) })) });
export const cartService = {
  get: async () => announceCart(normalizeCart(await apiData("/api/cart"))),
  add: async ({ productId, productVariantId, quantity }) => announceCart(normalizeCart(await apiData("/api/cart/items", { method: "POST", body: { productId, ...(productVariantId ? { productVariantId } : {}), quantity } }))),
  update: async (id, quantity) => announceCart(normalizeCart(await apiData(`/api/cart/items/${encodeURIComponent(id)}`, { method: "PATCH", body: { quantity } }))),
  remove: async (id) => announceCart(normalizeCart(await apiData(`/api/cart/items/${encodeURIComponent(id)}`, { method: "DELETE" }))),
};
export const checkoutApi = {
  preview: (input) => apiData("/api/checkout/preview", { method: "POST", body: input }),
  create: (input, idempotencyKey) => apiData("/api/checkout/orders", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: { ...input, idempotencyKey } }),
};
export const normalizeOrder = (order) => ({ ...order, id: String(order.id), status: order.fulfillmentStatus ?? order.status, taxPercent: Number(order.taxPercentSnapshot ?? order.taxPercent ?? 0), selectedOptions: order.variantOptions, statusHistory: order.activities ?? order.statusHistory ?? [], items: (order.items ?? []).map((item) => ({ ...item, variantId: item.productVariantId, selectedOptions: item.variantOptions ?? {}, unitPrice: Number(item.unitPrice), subtotal: Number(item.subtotal) })) });
export const orderService = {
  list: async () => rows(await apiData("/api/orders"), "items").map(normalizeOrder),
  get: async (id) => normalizeOrder(await apiData(`/api/orders/${encodeURIComponent(id)}`)),
  cancel: async (id, reason) => normalizeOrder(await apiData(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { reason } })),
  complete: async (id) => normalizeOrder(await apiData(`/api/orders/${encodeURIComponent(id)}/fulfillment`, { method: "PATCH", body: { status: "completed" } })),
};
