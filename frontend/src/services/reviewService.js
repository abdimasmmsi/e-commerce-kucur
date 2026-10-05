import { apiData } from "./apiClient";
const enc = encodeURIComponent;
export const reviewService = {
  publicForTarget: (_type, id) => apiData(`/api/products/${enc(id)}/reviews`),
  publicForStore: (id) => apiData(`/api/stores/${enc(id)}/reviews`), mine: () => apiData("/api/reviews/me"),
  merchant: (storeId) => apiData(`/api/merchant/reviews${storeId && storeId !== "all" ? `?storeId=${enc(storeId)}` : ""}`),
  admin: (filters = {}) => { const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== "all")); return apiData(`/api/admin/reviews${query.size ? `?${query}` : ""}`); },
  create: (_type, sourceId, input) => apiData(`/api/reviews/product/${enc(sourceId)}`, { method: "POST", body: input }),
  reply: (id, text, editing = false) => apiData(`/api/merchant/reviews/${enc(id)}/reply`, { method: editing ? "PATCH" : "POST", body: { text } }),
  moderate: (id, hidden, reason) => apiData(`/api/admin/reviews/${enc(id)}/${hidden ? "hide" : "show"}`, { method: "PATCH", body: { reason } }),
};
export const getAverageRating = (reviews) => reviews.length ? Math.round(reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length * 10) / 10 : null;
export const getRatingDistribution = (reviews) => [5,4,3,2,1].map((rating) => ({ rating, count: reviews.filter((row) => row.rating === rating).length }));
