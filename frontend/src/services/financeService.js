import { apiData } from "./apiClient";
export const financeService = {
  summary: (storeId) => apiData(`/api/stores/${storeId}/finance`), setup: (storeId, planType) => apiData(`/api/stores/${storeId}/finance/initial-fee/setup`, { method: "POST", body: { planType } }),
  payInstallment: (storeId, installmentId, amount) => apiData(`/api/stores/${storeId}/finance/installments/${installmentId}/pay`, { method: "POST", body: { amount, provider: "MANUAL" } }),
  settle: (storeId, obligationIds, amount) => apiData(`/api/stores/${storeId}/finance/admin-fees/settlements`, { method: "POST", body: { obligationIds, amount, provider: "MANUAL" } }),
  contributions: () => apiData("/api/users/me/contributions"), contribute: (amount) => apiData("/api/users/me/contributions", { method: "POST", body: { amount, provider: "MANUAL" } }),
  collectAdminFees: (storeId, { obligationIds, method, note }) => apiData(`/api/admin/finance/stores/${storeId}/admin-fees/collect`, { method: "POST", body: { obligationIds, method, ...(note ? { note } : {}) } }),
  monitor: () => apiData("/api/admin/finance"), reconcileInstallments: () => apiData("/api/admin/finance/reconcile-installments", { method: "POST" }), reconcileAdminFees: () => apiData("/api/admin/finance/reconcile-admin-fees", { method: "POST" }), remind: (storeId) => apiData("/api/admin/finance/remind", { method: "POST", body: storeId ? { storeId } : {} }), confirm: (kind, id, approved = true) => apiData(`/api/admin/finance/payments/${kind}/${id}/confirm`, { method: "POST", body: { approved } }),
};
