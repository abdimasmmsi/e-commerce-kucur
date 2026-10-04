import { useEffect, useMemo, useState } from "react";
import { deliveryApi } from "../../services/deliveryApiService";

export const ACTIONABLE_STATUSES = new Set(["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"]);
export const TERMINAL_STATUSES = new Set(["DELIVERED", "FAILED", "CANCELLED"]);
export const TERMINAL_BATCH_STATUSES = new Set(["COMPLETED", "CANCELLED", "FAILED"]);

export const batchTime = (batch) => new Date(batch.dispatchAt || batch.deliveryDate || batch.createdAt || 0).getTime();
export const isFutureBatch = (batch, now = Date.now()) => batchTime(batch) > now;
export const flattenAssignments = (batches) => batches.flatMap((batch) => (batch.orders || []).map((assignment) => ({ ...assignment, batch, order: assignment.commerceOrder })));

export function classifyCourierDeliveries(batches, now = Date.now()) {
  const assignments = flattenAssignments(batches);
  return {
    active: assignments.filter((item) => ACTIONABLE_STATUSES.has(item.status) && !isFutureBatch(item.batch, now)),
    upcomingBatches: batches.filter((batch) => !TERMINAL_BATCH_STATUSES.has(batch.status) && isFutureBatch(batch, now) && (batch.orders || []).some((item) => ACTIONABLE_STATUSES.has(item.status))),
    history: assignments.filter((item) => TERMINAL_STATUSES.has(item.status)),
    scheduledBatches: batches.filter((batch) => !TERMINAL_BATCH_STATUSES.has(batch.status)),
  };
}

export function useCourierBatches() {
  const [state, setState] = useState({ rows: [], loading: true, error: "" });
  useEffect(() => {
    let mounted = true;
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Delivery request timed out.")), 15000));
    Promise.race([deliveryApi.courierBatches(), timeout])
      .then((rows) => { if (mounted) setState({ rows, loading: false, error: "" }); })
      .catch((error) => { if (mounted) setState({ rows: [], loading: false, error: error.message }); });
    return () => { mounted = false; };
  }, []);
  const classified = useMemo(() => classifyCourierDeliveries(state.rows), [state.rows]);
  return { ...state, ...classified };
}

export function dateGroup(value, t) {
  const target = new Date(value); target.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  if (days === 0) return t("courierIa.today");
  if (days === 1) return t("courierIa.tomorrow");
  return days > 1 ? t("courierIa.later") : t("courierIa.past");
}
