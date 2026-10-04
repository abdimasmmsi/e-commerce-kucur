const DAY_MS = 86400000;

export const toDeliveryDateKey = (value) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const nextDateKey = (dateKey) => toDeliveryDateKey(new Date(`${dateKey}T12:00:00+07:00`).getTime() + DAY_MS);

export function determineScheduledDeliveryDate({ orderCreatedAt, cutoffTime, maxDailyDeliveries, existingScheduledOrders = [] }) {
  const created = new Date(orderCreatedAt);
  const today = toDeliveryDateKey(created);
  const [hour, minute] = String(cutoffTime).split(":").map(Number);
  const localTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(created);
  const [createdHour, createdMinute] = localTime.split(":").map(Number);
  let candidate = createdHour * 60 + createdMinute >= hour * 60 + minute ? nextDateKey(today) : today;
  const limit = Math.max(1, Math.floor(Number(maxDailyDeliveries)));
  const counts = existingScheduledOrders.reduce((map, order) => {
    if (order.scheduledDeliveryDate && !["cancelled", "delivered", "completed"].includes(order.status)) map[order.scheduledDeliveryDate] = (map[order.scheduledDeliveryDate] ?? 0) + 1;
    return map;
  }, {});
  while ((counts[candidate] ?? 0) >= limit) candidate = nextDateKey(candidate);
  return candidate;
}

export function getDeliverySchedulePreview({ orderCreatedAt = new Date().toISOString(), settings, existingScheduledOrders = [] }) {
  const today = toDeliveryDateKey(orderCreatedAt);
  const scheduledDeliveryDate = determineScheduledDeliveryDate({ orderCreatedAt, cutoffTime: settings.deliveryOrderCutoffTime, maxDailyDeliveries: settings.maxDailyDeliveries, existingScheduledOrders });
  const sameDayFull = scheduledDeliveryDate !== today && new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(orderCreatedAt)) < settings.deliveryOrderCutoffTime;
  return { scheduledDeliveryDate, sameDayFull };
}

export function getDeliverySchedulePreviews({ count, orderCreatedAt = new Date().toISOString(), settings, existingScheduledOrders = [] }) {
  const reservations = [...existingScheduledOrders];
  return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) => {
    const preview = getDeliverySchedulePreview({ orderCreatedAt, settings, existingScheduledOrders: reservations });
    reservations.push({ id: `checkout-preview-${index}`, scheduledDeliveryDate: preview.scheduledDeliveryDate, status: "pending" });
    return preview;
  });
}

export const formatDeliveryDate = (dateKey) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(`${dateKey}T12:00:00+07:00`));
