import {
  acceptCourierAssignment,
  assignCourierToOrder,
  recordCourierAssignmentExit,
} from "../services/courierAssignmentService";
import { decrementCourierDeliveries, getCouriers } from "./mockCouriers";
import { createNotification } from "../services/notificationService";
import { getOperationalSettings } from "./mockOperationalSettings";

export const ORDERS_STORAGE_KEY = "kucur_merchant_orders";
export const ORDERS_UPDATED_EVENT = "kucur-orders-updated";

export const orderStatusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  "ready-for-pickup": "Ready for Pickup",
  "courier-assigned": "Courier Assigned",
  "picked-up": "Picked Up",
  "on-delivery": "On Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const merchantTransitions = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "ready-for-pickup",
};

export const courierTransitions = {
  "courier-assigned": "picked-up",
  "picked-up": "on-delivery",
  "on-delivery": "delivered",
};

export const customerCancellableStatuses = ["pending", "confirmed", "processing"];

const createHistory = (entries) => entries.map(([status, actorType, actorName, timestamp]) => ({
  status,
  actorType,
  actorName,
  timestamp,
}));

const orderSeeds = [
  {
    id: "ORDER-001",
    orderNumber: "KUC-2026-1001",
    customerId: "CUS-001",
    customerName: "Budi Santoso",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [
      { productId: "PRD-001", productName: "Keripik Tempe Kucur", quantity: 2, price: 35000, subtotal: 70000 },
      { productId: "PRD-002", productName: "Kopi Robusta Lereng Kawi", quantity: 1, price: 68000, subtotal: 68000 },
    ],
    productTotal: 138000,
    deliveryFee: 18000,
    courierTip: 5000,
    totalAmount: 161000,
    paymentMethod: "COD",
    deliveryAddress: "Jl. Melati No. 12, Kecamatan Dau, Kabupaten Malang, Jawa Timur",
    status: "pending",
    createdAt: "2026-08-21T08:15:00+07:00",
    updatedAt: "2026-08-21T08:15:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Budi Santoso", "2026-08-21T08:15:00+07:00"],
    ]),
  },
  {
    id: "ORDER-002",
    orderNumber: "KUC-2026-1002",
    customerId: "CUS-002",
    customerName: "Siti Aminah",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{ productId: "PRD-003", productName: "Anyaman Bambu Mini", quantity: 2, price: 45000, subtotal: 90000 }],
    productTotal: 90000,
    deliveryFee: 15000,
    courierTip: 0,
    totalAmount: 105000,
    paymentMethod: "COD",
    deliveryAddress: "Perumahan Griya Asri Blok C-7, Kota Malang, Jawa Timur",
    status: "confirmed",
    createdAt: "2026-08-20T14:10:00+07:00",
    updatedAt: "2026-08-20T14:30:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Siti Aminah", "2026-08-20T14:10:00+07:00"],
      ["confirmed", "merchant", "Merchant Kucur", "2026-08-20T14:30:00+07:00"],
    ]),
  },
  {
    id: "ORDER-003",
    orderNumber: "KUC-2026-1003",
    customerId: "CUS-003",
    customerName: "Rina Wijaya",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{ productId: "PRD-002", productName: "Kopi Robusta Lereng Kawi", quantity: 3, price: 68000, subtotal: 204000 }],
    productTotal: 204000,
    deliveryFee: 22000,
    courierTip: 10000,
    totalAmount: 236000,
    paymentMethod: "COD",
    deliveryAddress: "Jl. Soekarno Hatta No. 88, Lowokwaru, Kota Malang",
    status: "processing",
    createdAt: "2026-08-20T09:00:00+07:00",
    updatedAt: "2026-08-20T10:00:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Rina Wijaya", "2026-08-20T09:00:00+07:00"],
      ["confirmed", "merchant", "Merchant Kucur", "2026-08-20T09:20:00+07:00"],
      ["processing", "merchant", "Merchant Kucur", "2026-08-20T10:00:00+07:00"],
    ]),
  },
  {
    id: "ORDER-004",
    orderNumber: "KUC-2026-1004",
    customerId: "CUS-004",
    customerName: "Dewi Lestari",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{ productId: "PRD-001", productName: "Keripik Tempe Kucur", quantity: 4, price: 35000, subtotal: 140000 }],
    productTotal: 140000,
    deliveryFee: 16000,
    courierTip: 5000,
    totalAmount: 161000,
    paymentMethod: "COD",
    deliveryAddress: "Dusun Sumberbendo, Desa Kucur, Kabupaten Malang",
    status: "ready-for-pickup",
    createdAt: "2026-08-19T11:30:00+07:00",
    updatedAt: "2026-08-19T13:00:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Dewi Lestari", "2026-08-19T11:30:00+07:00"],
      ["confirmed", "merchant", "Merchant Kucur", "2026-08-19T11:45:00+07:00"],
      ["processing", "merchant", "Merchant Kucur", "2026-08-19T12:05:00+07:00"],
      ["ready-for-pickup", "merchant", "Merchant Kucur", "2026-08-19T13:00:00+07:00"],
    ]),
  },
  {
    id: "ORDER-005",
    orderNumber: "KUC-2026-1005",
    customerId: "CUS-005",
    customerName: "Ahmad Hidayat",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{ productId: "PRD-001", productName: "Keripik Tempe Kucur", quantity: 1, price: 35000, subtotal: 35000 }],
    productTotal: 35000,
    deliveryFee: 12000,
    courierTip: 0,
    totalAmount: 47000,
    paymentMethod: "COD",
    deliveryAddress: "Jl. Veteran No. 21, Kota Malang",
    status: "completed",
    createdAt: "2026-08-17T08:00:00+07:00",
    updatedAt: "2026-08-17T15:40:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Ahmad Hidayat", "2026-08-17T08:00:00+07:00"],
      ["confirmed", "merchant", "Merchant Kucur", "2026-08-17T08:15:00+07:00"],
      ["processing", "merchant", "Merchant Kucur", "2026-08-17T08:40:00+07:00"],
      ["ready-for-pickup", "merchant", "Merchant Kucur", "2026-08-17T09:10:00+07:00"],
      ["courier-assigned", "system", "Assignment System", "2026-08-17T09:20:00+07:00"],
      ["picked-up", "courier", "Agus Setiawan", "2026-08-17T09:45:00+07:00"],
      ["on-delivery", "courier", "Agus Setiawan", "2026-08-17T10:00:00+07:00"],
      ["delivered", "courier", "Agus Setiawan", "2026-08-17T11:00:00+07:00"],
      ["completed", "system", "Kucur System", "2026-08-17T15:40:00+07:00"],
    ]),
  },
  {
    id: "ORDER-006",
    orderNumber: "KUC-2026-1006",
    customerId: "CUS-006",
    customerName: "Nabila Putri",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    items: [{ productId: "PRD-002", productName: "Kopi Robusta Lereng Kawi", quantity: 1, price: 68000, subtotal: 68000 }],
    productTotal: 68000,
    deliveryFee: 18000,
    courierTip: 0,
    totalAmount: 86000,
    paymentMethod: "COD",
    deliveryAddress: "Jl. Candi Panggung No. 5, Kota Malang",
    status: "cancelled",
    createdAt: "2026-08-18T16:20:00+07:00",
    updatedAt: "2026-08-18T16:35:00+07:00",
    statusHistory: createHistory([
      ["pending", "customer", "Nabila Putri", "2026-08-18T16:20:00+07:00"],
      ["cancelled", "customer", "Nabila Putri", "2026-08-18T16:35:00+07:00"],
    ]),
  },
];

const normalizeAssignmentFields = (order) => ({
  ...order,
  completedAt: order.completedAt ?? (order.status === "completed"
    ? order.statusHistory?.findLast?.((history) => history.status === "completed")?.timestamp ?? order.updatedAt
    : null),
  rejectedCourierIds: Array.isArray(order.rejectedCourierIds) ? order.rejectedCourierIds : [],
  timedOutCourierIds: Array.isArray(order.timedOutCourierIds) ? order.timedOutCourierIds : [],
  assignmentRound: Number(order.assignmentRound) > 0 ? Number(order.assignmentRound) : 1,
  courierAssignmentHistory: Array.isArray(order.courierAssignmentHistory)
    ? order.courierAssignmentHistory
    : [],
});

export const mockOrders = orderSeeds.map(normalizeAssignmentFields);

const readStoredOrders = () => {
  const storedValue = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (storedValue === null) return null;
  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function getOrders() {
  const storedOrders = readStoredOrders();
  if (storedOrders !== null) {
    const normalizedOrders = storedOrders.map(normalizeAssignmentFields);
    const requiresMigration = storedOrders.some(
      (order) => !Array.isArray(order.rejectedCourierIds)
        || !Array.isArray(order.timedOutCourierIds)
        || !Array.isArray(order.courierAssignmentHistory)
        || !(Number(order.assignmentRound) > 0),
    );
    if (requiresMigration) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(normalizedOrders));
    }
    return normalizedOrders;
  }
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(mockOrders));
  return [...mockOrders];
}

export function saveOrders(orders) {
  const previousOrders = readStoredOrders() ?? [];
  const previousById = new Map(previousOrders.map((order) => [String(order.id), order]));
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  orders.forEach((order) => {
    const previous = previousById.get(String(order.id));
    if (!previous) return;
    if (previous.status !== order.status) {
      createNotification({ recipientUserId: order.customerId, recipientRole: "customer", type: "order", title: `Status ${order.orderNumber} diperbarui`, message: `Status pesanan sekarang ${orderStatusLabels[order.status] ?? order.status}.`, link: `/orders/${order.id}` });
      if (order.status === "cancelled" && previous.status !== "cancelled") createNotification({ recipientUserId: order.merchantUserId, recipientRole: "merchant", type: "order", title: "Pesanan dibatalkan", message: `${order.orderNumber} telah dibatalkan.`, link: `/merchant/stores/${order.storeId}/orders/${order.id}` });
    }
    if (order.courierId && String(order.courierId) !== String(previous.courierId)) {
      const courier = getCouriers().find((item) => String(item.id) === String(order.courierId));
      if (courier?.userId) createNotification({ recipientUserId: courier.userId, recipientRole: "courier", type: "assignment", title: order.deliveryWorkflow === "daily-batch" ? "Batch pengiriman baru" : "Assignment baru", message: order.deliveryWorkflow === "daily-batch" ? `${order.orderNumber} masuk batch pengiriman Anda.` : `${order.orderNumber} menunggu respons Anda.`, link: order.deliveryWorkflow === "daily-batch" ? `/courier/batches/${order.deliveryBatchId}` : `/courier/active-deliveries/${order.id}` });
    }
  });
  return orders;
}

export function getStoreOrders(storeId, merchantUserId) {
  return getOrders().filter(
    (order) => String(order.storeId) === String(storeId)
      && order.merchantUserId === merchantUserId,
  );
}

export function getCustomerOrders(customerId) {
  return getOrders().filter((order) => String(order.customerId) === String(customerId));
}

export function getCustomerOrder(orderId, customerId) {
  return getCustomerOrders(customerId).find((order) => String(order.id) === String(orderId)) ?? null;
}

export function cancelCustomerOrder({ orderId, customerId, reason, actorName }) {
  const cancellationReason = reason?.trim();
  if (!cancellationReason) return { success: false, message: "Alasan cancel wajib diisi." };

  const orders = getOrders();
  const order = orders.find((item) => String(item.id) === String(orderId) && String(item.customerId) === String(customerId));
  if (!order) return { success: false, message: "Order tidak ditemukan." };
  if (!customerCancellableStatuses.includes(order.status)) return { success: false, message: "Order pada status ini tidak dapat dibatalkan." };

  const timestamp = new Date().toISOString();
  const updatedOrder = {
    ...order,
    status: "cancelled",
    cancellationReason,
    cancelledBy: "customer",
    cancelledAt: timestamp,
    updatedAt: timestamp,
    statusHistory: [...(order.statusHistory ?? []), {
      status: "cancelled",
      actorType: "customer",
      actorName,
      timestamp,
      oldStatus: order.status,
      newStatus: "cancelled",
      reason: cancellationReason,
    }],
  };
  saveOrders(orders.map((item) => String(item.id) === String(orderId) ? updatedOrder : item));
  return { success: true, order: updatedOrder };
}

export function getMerchantOrder(orderId, storeId, merchantUserId) {
  return getStoreOrders(storeId, merchantUserId).find(
    (order) => String(order.id) === String(orderId),
  ) ?? null;
}

export function transitionMerchantOrder({ orderId, storeId, merchantUserId, nextStatus, actorName }) {
  let updatedOrder = null;
  const timestamp = new Date().toISOString();
  const orders = getOrders().map((order) => {
    const isOwnedOrder = String(order.id) === String(orderId)
      && String(order.storeId) === String(storeId)
      && order.merchantUserId === merchantUserId;
    if (!isOwnedOrder || merchantTransitions[order.status] !== nextStatus) return order;
    if (order.paymentMethod === "MIDTRANS" && order.paymentStatus !== "paid") return order;

    const merchantUpdatedOrder = {
      ...order,
      status: nextStatus,
      updatedAt: timestamp,
      statusHistory: [
        ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
        { status: nextStatus, actorType: "merchant", actorName, timestamp },
      ],
    };
    // Batch-based orders wait for their scheduled batch. Legacy orders keep their
    // existing assignment data, but new ready orders are no longer assigned here.
    updatedOrder = order.deliveryWorkflow === "daily-batch"
      ? merchantUpdatedOrder
      : nextStatus === "ready-for-pickup" ? assignCourierToOrder(merchantUpdatedOrder) : merchantUpdatedOrder;
    return updatedOrder;
  });

  if (!updatedOrder) return null;
  saveOrders(orders);
  return updatedOrder;
}

export function getCourierAssignments(courierId) {
  return getOrders().filter((order) => String(order.courierId) === String(courierId));
}

export function getCourierOrder(orderId, courierId) {
  return getOrders().find(
    (order) => String(order.id) === String(orderId)
      && String(order.courierId) === String(courierId),
  ) ?? null;
}

export function acceptOrderAssignment(orderId, courierId) {
  let acceptedOrder = null;
  const orders = getOrders().map((order) => {
    if (String(order.id) !== String(orderId)) return order;
    acceptedOrder = acceptCourierAssignment(order, courierId);
    return acceptedOrder ?? order;
  });
  if (!acceptedOrder) return null;
  saveOrders(orders);
  return acceptedOrder;
}

function exitOrderAssignment(orderId, courierId, reason, action) {
  const currentOrders = getOrders();
  const currentOrder = currentOrders.find((order) => String(order.id) === String(orderId));
  const rejectedOrder = currentOrder
    ? recordCourierAssignmentExit(currentOrder, courierId, reason, action)
    : null;
  if (!rejectedOrder) return null;

  // Persist the excluded courier and complete history before recalculating eligibility.
  saveOrders(currentOrders.map((order) => (
    String(order.id) === String(orderId) ? rejectedOrder : order
  )));

  if (["released", "pickup-timed-out"].includes(action)
    && currentOrder.courierAssignmentStatus === "accepted") {
    decrementCourierDeliveries(courierId);
  }

  const persistedOrders = getOrders();
  const persistedRejectedOrder = persistedOrders.find(
    (order) => String(order.id) === String(orderId),
  );
  const reassignedOrder = assignCourierToOrder(persistedRejectedOrder, { action: "reassigned" });
  saveOrders(persistedOrders.map((order) => (
    String(order.id) === String(orderId) ? reassignedOrder : order
  )));
  return reassignedOrder;
}

export function rejectOrderAssignment(orderId, courierId, reason) {
  return exitOrderAssignment(orderId, courierId, reason, "rejected");
}

export function releaseOrderAssignment(orderId, courierId, reason) {
  return exitOrderAssignment(orderId, courierId, reason, "released");
}

export function timeoutOrderAssignment(orderId, courierId) {
  return exitOrderAssignment(orderId, courierId, "Assignment response timeout", "timed-out");
}

export function timeoutOrderPickup(orderId, courierId, currentTime = Date.now()) {
  const currentOrder = getOrders().find((order) => String(order.id) === String(orderId));
  const assignedAt = new Date(currentOrder?.assignedAt ?? "").getTime();
  const timeoutMilliseconds = getOperationalSettings().pickupTimeoutHours * 60 * 60 * 1000;
  const canTimeout = currentOrder
    && String(currentOrder.courierId) === String(courierId)
    && currentOrder.status === "courier-assigned"
    && currentOrder.courierAssignmentStatus === "accepted"
    && Number.isFinite(assignedAt)
    && currentTime - assignedAt >= timeoutMilliseconds;
  if (!canTimeout) return null;
  return exitOrderAssignment(orderId, courierId, "Pickup timeout", "pickup-timed-out");
}

export function transitionCourierOrder({ orderId, courierId, nextStatus, actorName, deliveryProof = [] }) {
  const currentOrders = getOrders();
  const currentOrder = currentOrders.find((order) => String(order.id) === String(orderId));
  const validTransition = currentOrder
    && String(currentOrder.courierId) === String(courierId)
    && (currentOrder.courierAssignmentStatus === "accepted"
      || (currentOrder.deliveryWorkflow === "daily-batch" && currentOrder.courierAssignmentStatus === "batch-assigned"))
    && courierTransitions[currentOrder.status] === nextStatus;
  if (!validTransition) return null;
  if (nextStatus === "delivered" && !deliveryProof.length) return null;

  const timestamp = new Date().toISOString();
  const updatedOrder = {
    ...currentOrder,
    status: nextStatus,
    deliveryProof: nextStatus === "delivered" ? deliveryProof : currentOrder.deliveryProof,
    deliveredAt: nextStatus === "delivered" ? (currentOrder.deliveredAt ?? timestamp) : currentOrder.deliveredAt,
    updatedAt: timestamp,
    statusHistory: [
      ...(currentOrder.statusHistory ?? []),
      {
        status: nextStatus,
        actorType: "courier",
        actorName,
        timestamp,
        oldStatus: currentOrder.status,
        newStatus: nextStatus,
      },
    ],
    courierAssignmentHistory: [
      ...(currentOrder.courierAssignmentHistory ?? []),
      {
        courierId,
        courierName: actorName,
        action: nextStatus,
        reason: null,
        timestamp,
        oldStatus: currentOrder.status,
        newStatus: nextStatus,
      },
    ],
  };

  saveOrders(currentOrders.map((order) => (
    String(order.id) === String(orderId) ? updatedOrder : order
  )));
  if (nextStatus === "delivered") decrementCourierDeliveries(courierId);
  return updatedOrder;
}

export function completeCustomerOrder({ orderId, customerId, actorName }) {
  const orders = getOrders();
  const currentOrder = orders.find((order) => String(order.id) === String(orderId) && String(order.customerId) === String(customerId));
  if (!currentOrder || currentOrder.status !== "delivered") return null;
  const timestamp = new Date().toISOString();
  const completedOrder = {
    ...currentOrder,
    status: "completed",
    completedAt: currentOrder.completedAt ?? timestamp,
    updatedAt: timestamp,
    statusHistory: [...(currentOrder.statusHistory ?? []), { status: "completed", actorType: "customer", actorName, timestamp, oldStatus: "delivered", newStatus: "completed" }],
  };
  saveOrders(orders.map((order) => String(order.id) === String(orderId) ? completedOrder : order));
  createNotification({ recipientUserId: completedOrder.merchantUserId, recipientRole: "merchant", type: "order", title: "Pesanan selesai", message: `${completedOrder.orderNumber} telah diselesaikan customer.`, link: `/merchant/stores/${completedOrder.storeId}/orders/${completedOrder.id}` });
  const courier = getCouriers().find((item) => String(item.id) === String(completedOrder.courierId));
  if (courier?.userId) createNotification({ recipientUserId: courier.userId, recipientRole: "courier", type: "order", title: "Pengiriman selesai", message: `${completedOrder.orderNumber} telah dikonfirmasi customer.`, link: `/courier/history` });
  return completedOrder;
}

export function restartOrderAssignmentRound(orderId, currentTime = Date.now()) {
  const currentOrders = getOrders();
  const currentOrder = currentOrders.find((order) => String(order.id) === String(orderId));
  const retryAt = new Date(currentOrder?.nextAssignmentRoundAt ?? "").getTime();
  const canRestart = currentOrder
    && currentOrder.courierAssignmentStatus === "waiting"
    && currentOrder.status === "ready-for-pickup"
    && Number.isFinite(retryAt)
    && retryAt <= currentTime;
  if (!canRestart) return null;

  const timestamp = new Date(currentTime).toISOString();
  const restartedOrder = {
    ...currentOrder,
    assignmentRound: (currentOrder.assignmentRound ?? 1) + 1,
    rejectedCourierIds: [],
    timedOutCourierIds: [],
    nextAssignmentRoundAt: null,
    updatedAt: timestamp,
    courierAssignmentHistory: [
      ...(currentOrder.courierAssignmentHistory ?? []),
      {
        courierId: null,
        courierName: "System",
        action: "round-restarted",
        reason: `Assignment round ${(currentOrder.assignmentRound ?? 1) + 1}`,
        timestamp,
        oldStatus: "ready-for-pickup",
        newStatus: "ready-for-pickup",
      },
    ],
  };
  saveOrders(currentOrders.map((order) => (
    String(order.id) === String(orderId) ? restartedOrder : order
  )));

  const persistedOrders = getOrders();
  const persistedOrder = persistedOrders.find((order) => String(order.id) === String(orderId));
  const assignedOrder = assignCourierToOrder(persistedOrder, { action: "round-reassigned" });
  saveOrders(persistedOrders.map((order) => (
    String(order.id) === String(orderId) ? assignedOrder : order
  )));
  return assignedOrder;
}

export function processCourierAssignmentTimers(currentTime = Date.now()) {
  const expiredAssignments = getOrders().filter((order) => {
    const deadline = new Date(order.assignmentResponseDeadline ?? "").getTime();
    return order.courierAssignmentStatus === "pending"
      && Number.isFinite(deadline)
      && deadline <= currentTime;
  });
  expiredAssignments.forEach((order) => timeoutOrderAssignment(order.id, order.courierId));

  const expiredRounds = getOrders().filter((order) => {
    const retryAt = new Date(order.nextAssignmentRoundAt ?? "").getTime();
    return order.courierAssignmentStatus === "waiting"
      && Number.isFinite(retryAt)
      && retryAt <= currentTime;
  });
  expiredRounds.forEach((order) => restartOrderAssignmentRound(order.id, currentTime));
  return getOrders();
}
