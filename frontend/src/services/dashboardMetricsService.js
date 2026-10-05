import { deliveryApi } from "./deliveryApiService";
import { orderService } from "./orderService";
import { storeService } from "./storeService";

export const ACTIVE_PRODUCT_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready-for-pickup",
  "courier-assigned",
  "picked-up",
  "on-delivery",
  "delivered",
];

/** Build the Admin dashboard exclusively from persisted API resources. */
export async function getAdminDashboardMetrics() {
  const [applications, orders, couriers, eligible, leaves] = await Promise.all([
    storeService.applications(),
    orderService.list({ scope: "admin" }),
    deliveryApi.couriers(),
    deliveryApi.eligible(),
    deliveryApi.leaveRequests().catch(() => []),
  ]);

  return {
    totalMerchants: new Set(applications.map((store) => store.merchantUserId).filter(Boolean)).size,
    pendingMerchants: applications.filter((store) => String(store.approvalStatus).toLowerCase() === "pending").length,
    totalCouriers: couriers.length,
    availableCouriers: couriers.filter((courier) => courier.isActive).length,
    activeOrders: orders.filter((order) => ACTIVE_PRODUCT_ORDER_STATUSES.includes(order.status)).length,
    waitingCourier: Array.isArray(eligible?.items) ? eligible.items.length : 0,
    pendingLeaves: leaves.filter((row) => row.status === "pending").length,
  };
}
