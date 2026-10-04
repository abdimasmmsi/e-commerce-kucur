import { apiData } from "./apiClient";
const body = (value) => ({ method: "POST", body: value });
export const deliveryApi = {
  profile: () => apiData("/api/courier/profile"), availability: () => apiData("/api/courier/availability"),
  unavailable: (input) => apiData("/api/courier/availability", body(input)), endUnavailable: (id) => apiData(`/api/courier/availability/${id}/end`, { method: "PATCH" }),
  courierBatches: () => apiData("/api/courier/batches"), courierBatch: (id) => apiData(`/api/courier/batches/${id}`), startBatch: (id) => apiData(`/api/courier/batches/${id}/start`, body({})),
  pickup: (id, note = "") => apiData(`/api/courier/deliveries/${id}/pickup`, { method: "PATCH", body: { note } }),
  outForDelivery: (id, note = "") => apiData(`/api/courier/deliveries/${id}/out-for-delivery`, { method: "PATCH", body: { note } }),
  failed: (id, reason) => apiData(`/api/courier/deliveries/${id}/failed`, { method: "PATCH", body: { reason } }),
  proof: (id, input) => apiData(`/api/courier/deliveries/${id}/proof`, body(input)),
  merchantOrders: () => apiData("/api/merchant/delivery-orders"),
  ready: (id, input) => apiData(`/api/merchant/orders/${id}/pickup-confirmation`, body(input)),
  eligible: (deliveryDate) => apiData(`/api/admin/delivery/eligible-orders${deliveryDate ? `?deliveryDate=${encodeURIComponent(deliveryDate)}` : ""}`),
  couriers: () => apiData("/api/admin/delivery/couriers"), adminBatches: () => apiData("/api/admin/delivery/batches"),
  createBatch: (input) => apiData("/api/admin/delivery/batches", body(input)), completeBatch: (id) => apiData(`/api/admin/delivery/batches/${id}/complete`, { method: "PATCH" }),
  removeOrder: (batchId, orderId) => apiData(`/api/admin/delivery/batches/${batchId}/orders/${orderId}`, { method: "DELETE" }),
  cancelBatch: (batchId) => apiData(`/api/admin/delivery/batches/${batchId}/cancel`, { method: "PATCH" }),
  rebatch: (orderId, input) => apiData(`/api/admin/delivery/orders/${orderId}/rebatch`, body(input)),
};
