import {
  getCouriers,
  incrementCourierDeliveries,
  mockCouriers as courierSeeds,
  updateCourier,
} from "../data/mockCouriers";
import { getOperationalSettings } from "../data/mockOperationalSettings";

export const COURIER_ASSIGNMENT_STATE_KEY = "kucur_courier_assignment_state";

// Compatibility export for the existing dashboard/delivery simulation pages.
export const mockCouriers = courierSeeds.map((courier) => ({
  ...courier,
  status: courier.availability === "available" ? "Available" : "Out of Office",
  maximumActiveDeliveries: courier.maxActiveDeliveries,
  lastAssignedOrder: null,
}));

const readAssignmentState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COURIER_ASSIGNMENT_STATE_KEY));
    return parsed && typeof parsed === "object" ? parsed : { lastAssignedCourierId: null };
  } catch {
    return { lastAssignedCourierId: null };
  }
};

const saveLastAssignedCourier = (courierId) => {
  localStorage.setItem(COURIER_ASSIGNMENT_STATE_KEY, JSON.stringify({
    ...readAssignmentState(),
    lastAssignedCourierId: courierId,
  }));
};

const getAvailability = (courier) => courier.availability
  ?? (courier.status === "Available" ? "available" : "out-of-office");
const getMaximumDeliveries = (courier) => courier.maxActiveDeliveries
  ?? courier.maximumActiveDeliveries
  ?? 0;

export const isCourierEligible = (courier, orderId, rejectedCourierIds = []) => {
  // Keep orderId in the public signature for existing callers; eligibility is
  // determined by the order's persisted rejection list.
  void orderId;
  return courier.isActive === true
    && getAvailability(courier) === "available"
    && courier.activeDeliveries < getMaximumDeliveries(courier)
    && !rejectedCourierIds.includes(courier.id);
};

export function selectNextCourier({
  couriers = mockCouriers,
  orderId,
  rejectedCourierIds = [],
  timedOutCourierIds = [],
  currentCourierId = null,
}) {
  if (!couriers.length) return { status: "Waiting for Courier", courier: null };

  const excludedCourierIds = [...new Set([...rejectedCourierIds, ...timedOutCourierIds])];
  const currentIndex = couriers.findIndex((courier) => courier.id === currentCourierId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let offset = 0; offset < couriers.length; offset += 1) {
    const courier = couriers[(startIndex + offset) % couriers.length];
    if (isCourierEligible(courier, orderId, excludedCourierIds)) {
      return { status: "Assigned", courier: { ...courier, lastAssignedOrder: orderId } };
    }
  }

  return { status: "Waiting for Courier", courier: null };
}

export function assignCourierToOrder(order, { action = "assigned" } = {}) {
  const couriers = getCouriers();
  const operationalSettings = getOperationalSettings();
  const { lastAssignedCourierId } = readAssignmentState();
  const assignment = selectNextCourier({
    couriers,
    orderId: order.id,
    rejectedCourierIds: order.rejectedCourierIds ?? [],
    timedOutCourierIds: order.timedOutCourierIds ?? [],
    currentCourierId: lastAssignedCourierId,
  });

  if (!assignment.courier) {
    const timestamp = new Date().toISOString();
    const statusHistory = order.statusHistory ?? [];
    const waitingHistory = statusHistory.at(-1)?.status === "ready-for-pickup"
      ? statusHistory
      : [
          ...statusHistory,
          { status: "ready-for-pickup", actorType: "system", actorName: "System", timestamp },
        ];
    return {
      ...order,
      status: "ready-for-pickup",
      courierId: null,
      courierName: null,
      courierAssignmentStatus: "waiting",
      assignedAt: null,
      assignmentResponseDeadline: null,
      nextAssignmentRoundAt: new Date(
        Date.now() + operationalSettings.assignmentCycleCooldownMinutes * 60 * 1000,
      ).toISOString(),
      statusHistory: waitingHistory,
      updatedAt: timestamp,
    };
  }

  const timestamp = new Date().toISOString();
  const courier = assignment.courier;
  updateCourier(courier.id, { lastAssignedAt: timestamp });
  saveLastAssignedCourier(courier.id);

  return {
    ...order,
    status: "courier-assigned",
    courierId: courier.id,
    courierName: courier.name,
    courierAssignmentStatus: "pending",
    assignedAt: timestamp,
    assignmentResponseDeadline: new Date(
      Date.now() + operationalSettings.assignmentResponseMinutes * 60 * 1000,
    ).toISOString(),
    nextAssignmentRoundAt: null,
    courierAssignmentHistory: [
      ...(order.courierAssignmentHistory ?? []),
      { courierId: courier.id, courierName: courier.name, action, reason: null, timestamp },
    ],
    statusHistory: [
      ...(order.statusHistory ?? []),
      {
        status: "courier-assigned",
        actorType: "system",
        actorName: "System",
        timestamp,
        oldStatus: order.status,
        newStatus: "courier-assigned",
      },
    ],
    updatedAt: timestamp,
  };
}

export function acceptCourierAssignment(order, courierId) {
  const validAssignment = order.courierAssignmentStatus === "pending"
    && String(order.courierId) === String(courierId)
    && order.status === "courier-assigned";
  if (!validAssignment) return null;

  const courier = incrementCourierDeliveries(courierId);
  if (!courier) return null;
  const timestamp = new Date().toISOString();
  return {
    ...order,
    courierAssignmentStatus: "accepted",
    assignmentResponseDeadline: null,
    updatedAt: timestamp,
    courierAssignmentHistory: [
      ...(order.courierAssignmentHistory ?? []),
      {
        courierId: courier.id,
        courierName: courier.name,
        action: "accepted",
        reason: null,
        timestamp,
        oldStatus: order.status,
        newStatus: order.status,
      },
    ],
  };
}

export function recordCourierAssignmentExit(order, courierId, reason, action) {
  const validAction = ["rejected", "released", "timed-out", "pickup-timed-out"].includes(action);
  const validAssignmentStatus = ["rejected", "timed-out"].includes(action)
    ? order.courierAssignmentStatus === "pending"
    : action === "pickup-timed-out"
      ? order.courierAssignmentStatus === "accepted"
      : ["pending", "accepted"].includes(order.courierAssignmentStatus);
  const validAssignment = validAction
    && validAssignmentStatus
    && String(order.courierId) === String(courierId)
    && order.status === "courier-assigned"
    && reason?.trim();
  if (!validAssignment) return null;

  const timestamp = new Date().toISOString();
  const isTimeout = ["timed-out", "pickup-timed-out"].includes(action);
  const rejectedCourierIds = isTimeout
    ? [...(order.rejectedCourierIds ?? [])]
    : [...new Set([...(order.rejectedCourierIds ?? []), courierId])];
  const timedOutCourierIds = isTimeout
    ? [...new Set([...(order.timedOutCourierIds ?? []), courierId])]
    : [...(order.timedOutCourierIds ?? [])];
  const rejectedOrder = {
    ...order,
    status: "ready-for-pickup",
    courierId: null,
    courierName: null,
    courierAssignmentStatus: "waiting",
    assignedAt: null,
    assignmentResponseDeadline: null,
    rejectedCourierIds,
    timedOutCourierIds,
    updatedAt: timestamp,
    courierAssignmentHistory: [
      ...(order.courierAssignmentHistory ?? []),
      {
        courierId,
        courierName: order.courierName,
        action,
        reason: reason.trim(),
        timestamp,
        oldStatus: order.status,
        newStatus: "ready-for-pickup",
      },
    ],
  };

  return rejectedOrder;
}

export function recordCourierRejection(order, courierId, reason) {
  return recordCourierAssignmentExit(order, courierId, reason, "rejected");
}

export function rejectAndReassignCourierOrder(order, courierId, reason) {
  const rejectedOrder = recordCourierRejection(order, courierId, reason);
  if (!rejectedOrder) return null;
  return assignCourierToOrder(rejectedOrder, { action: "reassigned" });
}

export function reassignAfterRejection({
  couriers = mockCouriers,
  orderId,
  rejectedCourierIds = [],
  rejectingCourierId,
}) {
  const updatedRejectedIds = [...new Set([...rejectedCourierIds, rejectingCourierId])];
  return {
    rejectedCourierIds: updatedRejectedIds,
    assignment: selectNextCourier({
      couriers,
      orderId,
      rejectedCourierIds: updatedRejectedIds,
      currentCourierId: rejectingCourierId,
    }),
  };
}

export function simulatePickupTimeout({
  assignment,
  couriers = mockCouriers,
  pickupTimeoutHours,
  now = Date.now(),
}) {
  const configuredPickupTimeout = pickupTimeoutHours
    ?? getOperationalSettings().pickupTimeoutHours;
  const assignedAt = new Date(assignment.assignedAt).getTime();
  const timedOut = Number.isFinite(assignedAt)
    && !["Picked Up", "On Delivery", "Delivered"].includes(assignment.status)
    && now - assignedAt >= configuredPickupTimeout * 60 * 60 * 1000;

  if (!timedOut) return { timedOut: false, assignment, activity: null, reassignment: null };
  const rejectedCourierIds = [...new Set([...(assignment.rejectedCourierIds ?? []), assignment.courierId])];
  const reassignment = selectNextCourier({
    couriers,
    orderId: assignment.orderId,
    rejectedCourierIds,
    currentCourierId: assignment.courierId,
  });
  return {
    timedOut: true,
    assignment: { ...assignment, status: "Timed Out", timeoutReason: "Pickup timeout", rejectedCourierIds },
    activity: {
      actor: "System",
      action: "Assignment Timed Out",
      details: "Pickup timeout",
      timestamp: new Date(now).toISOString(),
    },
    reassignment,
  };
}
