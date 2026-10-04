export const COURIERS_STORAGE_KEY = "kucur_couriers";
export const COURIERS_UPDATED_EVENT = "kucur-couriers-updated";

export const mockCouriers = [
  {
    id: "CR-001",
    userId: "USR-COURIER-001",
    name: "Agus Setiawan",
    phone: "0812-4000-1001",
    availability: "available",
    activeDeliveries: 1,
    maxActiveDeliveries: 3,
    lastAssignedAt: null,
    isActive: true,
  },
  {
    id: "CR-002",
    userId: "USR-COURIER-002",
    name: "Rini Wulandari",
    phone: "0812-4000-1002",
    availability: "available",
    activeDeliveries: 0,
    maxActiveDeliveries: 2,
    lastAssignedAt: null,
    isActive: true,
  },
  {
    id: "CR-003",
    userId: "USR-COURIER-003",
    name: "Dedi Firmansyah",
    phone: "0812-4000-1003",
    availability: "available",
    activeDeliveries: 2,
    maxActiveDeliveries: 4,
    lastAssignedAt: null,
    isActive: true,
  },
];

const readStoredCouriers = () => {
  const storedValue = localStorage.getItem(COURIERS_STORAGE_KEY);
  if (storedValue === null) return null;
  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const applyOperationalLimit = (couriers) => {
  const { maximumActiveDeliveries } = getOperationalSettings();
  return couriers.map((courier) => ({ ...courier, maxActiveDeliveries: maximumActiveDeliveries }));
};

export function getCouriers() {
  const storedCouriers = readStoredCouriers();
  if (storedCouriers !== null) return applyOperationalLimit(storedCouriers);
  const seededCouriers = applyOperationalLimit(mockCouriers);
  localStorage.setItem(COURIERS_STORAGE_KEY, JSON.stringify(seededCouriers));
  return seededCouriers;
}

export function saveCouriers(couriers) {
  localStorage.setItem(COURIERS_STORAGE_KEY, JSON.stringify(couriers));
  window.dispatchEvent(new CustomEvent(COURIERS_UPDATED_EVENT));
  return couriers;
}

export function getCourierByUserId(userId) {
  return getCouriers().find((courier) => courier.userId === userId) ?? null;
}

export function updateCourier(courierId, changes) {
  let updatedCourier = null;
  const couriers = getCouriers().map((courier) => {
    if (String(courier.id) !== String(courierId)) return courier;
    updatedCourier = { ...courier, ...changes };
    return updatedCourier;
  });
  if (!updatedCourier) return null;
  saveCouriers(couriers);
  return updatedCourier;
}

export function updateCourierAvailability(courierId, availability) {
  if (!["available", "out-of-office"].includes(availability)) return null;
  return updateCourier(courierId, { availability });
}

export function incrementCourierDeliveries(courierId) {
  const courier = getCouriers().find((item) => String(item.id) === String(courierId));
  if (!courier || courier.activeDeliveries >= courier.maxActiveDeliveries) return null;
  return updateCourier(courierId, { activeDeliveries: courier.activeDeliveries + 1 });
}

export function decrementCourierDeliveries(courierId) {
  const courier = getCouriers().find((item) => String(item.id) === String(courierId));
  if (!courier) return null;
  return updateCourier(courierId, {
    activeDeliveries: Math.max(0, courier.activeDeliveries - 1),
  });
}
import { getOperationalSettings } from "./mockOperationalSettings";
