import { apiData } from "./apiClient";
export const notificationService = { list: (query = {}) => { const search = new URLSearchParams(Object.entries(query).filter(([,value]) => value !== undefined && value !== "")); return apiData(`/api/notifications${search.size ? `?${search}` : ""}`); }, unreadCount: () => apiData("/api/notifications/unread-count"), markRead: (id) => apiData(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }), markUnread: (id) => apiData(`/api/notifications/${encodeURIComponent(id)}/unread`, { method: "PATCH" }), markAllRead: () => apiData("/api/notifications/read-all", { method: "PATCH" }) };
// Halaman tujuan saat notifikasi diklik, menurut jenis entitas dan peran yang sedang aktif.
export function resolveNotificationRoute(notification, role = "customer") {
  const id = notification.entityId;
  const meta = notification.metadata ?? {};
  switch (notification.entityType) {
    case "CONVERSATION": return id ? (role === "admin" ? `/admin/support-chats/${id}` : `/messages/${id}`) : (role === "admin" ? "/admin/support-chats" : "/messages");
    case "COMMERCE_ORDER": return role === "merchant" ? (meta.storeId && id ? `/merchant/stores/${meta.storeId}/orders/${id}` : "/merchant/orders") : role === "admin" ? (id ? `/admin/orders/${id}` : "/admin/transactions") : role === "courier" ? "/courier/batches" : (id ? `/orders/${id}` : "/orders");
    case "PRODUCT": return role === "merchant" ? (meta.storeId && id ? `/merchant/stores/${meta.storeId}/products/${id}/edit` : "/merchant/stores") : role === "admin" ? "/admin/products" : (id ? `/products/${id}` : "/products");
    case "STORE": return role === "merchant" ? (id ? `/merchant/stores/${id}` : "/merchant/stores") : role === "admin" ? (id ? `/admin/merchant-approval/${id}` : "/admin/merchant-approval") : null;
    case "STORE_FINANCE": case "ADMIN_FEE_OBLIGATION": case "STORE_INSTALLMENT": return role === "admin" ? (id && notification.entityType === "STORE_FINANCE" ? `/admin/finance/${id}` : "/admin/finance") : role === "merchant" ? (id && notification.entityType === "STORE_FINANCE" ? `/merchant/stores/${id}/finance` : "/merchant/finance") : null;
    case "REVIEW": return role === "merchant" ? "/merchant/reviews" : role === "admin" ? "/admin/reviews" : "/my-reviews";
    case "DELIVERY_BATCH": return role === "courier" ? (id ? `/courier/batches/${id}` : "/courier/batches") : role === "admin" ? "/admin/delivery-batches" : null;
    case "DELIVERY_DRAFT": return role === "admin" ? "/admin/delivery-batches" : null;
    case "COURIER_LEAVE": return role === "admin" ? "/admin/couriers" : role === "courier" ? "/courier/availability" : null;
    default: return null;
  }
}
// Dikirim saat sesuatu menandai notifikasi terbaca di server (mis. membuka chat) supaya lonceng ikut diperbarui.
export const NOTIFICATIONS_REFRESH_EVENT = "kucur:notifications-refresh";
export const isValidNotificationTarget = (path) => typeof path === "string" && path.startsWith("/");
// Legacy prototype producers cannot select recipients through the authenticated API.
export const createNotification = () => null;
export const markNotificationsByLink = async () => false;
