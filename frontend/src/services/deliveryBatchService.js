import { getCouriers } from "../data/mockCouriers";
import { getOperationalSettings } from "../data/mockOperationalSettings";
import { getOrders, saveOrders } from "../data/mockOrders";
import { getStores } from "../data/mockStores";
import { createNotification } from "./notificationService";
import { determineScheduledDeliveryDate } from "./deliverySchedulingService";
import { optimizeDeliveryRoute, optimizePickupRoute } from "./routeOptimizationService";

export const DELIVERY_BATCHES_KEY = "kucur_delivery_batches";
export const DELIVERY_BATCHES_UPDATED_EVENT = "kucur-delivery-batches-updated";
const terminal = ["cancelled", "delivered", "completed"];
const now = () => new Date().toISOString();
const historyEntry = (action, actor, actorRole, description, reason) => ({ action, actor, actorRole, description, reason: reason || null, timestamp: now() });

export function getDeliveryBatches() {
  try { const value = JSON.parse(localStorage.getItem(DELIVERY_BATCHES_KEY)); return Array.isArray(value) ? value : []; } catch { return []; }
}
function saveBatches(batches) {
  const serialized = JSON.stringify(batches);
  if (localStorage.getItem(DELIVERY_BATCHES_KEY) === serialized) return batches;
  localStorage.setItem(DELIVERY_BATCHES_KEY, serialized);
  window.dispatchEvent(new CustomEvent(DELIVERY_BATCHES_UPDATED_EVENT));
  return batches;
}

const eligibleCouriers = () => getCouriers().filter((courier) => courier.isActive !== false && courier.availability === "available");
const chooseCourier = (batches, couriers) => [...couriers].sort((a, b) => {
  const load = (courier) => batches.filter((batch) => String(batch.courierId) === String(courier.id) && !["completed"].includes(batch.status)).reduce((sum, batch) => sum + batch.orderIds.length, 0) / Math.max(1, Number(courier.maxActiveDeliveries ?? 1));
  return load(a) - load(b) || String(a.id).localeCompare(String(b.id));
})[0] ?? null;

export function syncDeliveryBatches() {
  let batches = getDeliveryBatches();
  const orders = getOrders();
  const stores = getStores();
  const couriers = eligibleCouriers();
  const settings = getOperationalSettings();
  batches = batches.map((batch) => {
    if (batch.pickupStartedAt || batch.deliveryStartedAt || batch.status !== "scheduled") return batch;
    const currentCourierStillEligible = couriers.some((courier) => String(courier.id) === String(batch.courierId));
    if (currentCourierStillEligible) return batch;
    const replacement = chooseCourier(batches.filter((item) => item.id !== batch.id), couriers);
    if (!replacement || String(replacement.id) === String(batch.courierId)) return batch;
    const timestamp = now();
    return { ...batch, courierId: replacement.id, courierName: replacement.name, updatedAt: timestamp, history: [...batch.history, historyEntry("courier-reassigned", "Kucur System", "system", `Batch dialihkan ke ${replacement.name} sebelum pickup dimulai.`)] };
  });
  const dates = [...new Set(orders.filter((order) => order.deliveryWorkflow === "daily-batch" && order.scheduledDeliveryDate && !terminal.includes(order.status)).map((order) => order.scheduledDeliveryDate))].sort();
  dates.forEach((deliveryDate) => {
    const candidates = orders.filter((order) => order.deliveryWorkflow === "daily-batch" && order.scheduledDeliveryDate === deliveryDate && ["ready-for-pickup", "picked-up", "on-delivery"].includes(order.status)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, settings.maxDailyDeliveries);
    if (!candidates.length) return;
    let batch = batches.find((item) => item.deliveryDate === deliveryDate && item.status !== "completed");
    if (!batch) {
      const courier = chooseCourier(batches, couriers);
      const timestamp = now();
      batch = { id: `BATCH-${deliveryDate}-${Date.now()}`, batchNumber: `DB-${deliveryDate.replaceAll("-", "")}-${batches.filter((item) => item.deliveryDate === deliveryDate).length + 1}`, deliveryDate, cutoffTime: candidates[0].deliveryCutoffSnapshot ?? settings.deliveryOrderCutoffTime, dispatchTime: candidates[0].deliveryDispatchTimeSnapshot ?? settings.deliveryDispatchTime, maxDeliveries: candidates[0].maxDailyDeliveriesSnapshot ?? settings.maxDailyDeliveries, courierId: courier?.id ?? null, courierName: courier?.name ?? null, orderIds: [], pickupStops: [], deliveryStops: [], status: "scheduled", createdAt: timestamp, updatedAt: timestamp, pickupStartedAt: null, pickupCompletedAt: null, deliveryStartedAt: null, completedAt: null, history: [historyEntry("batch-created", "Kucur System", "system", "Daily delivery batch dibuat.")] };
      if (courier) batch.history.push(historyEntry("courier-assigned", "Kucur System", "system", `Batch ditugaskan ke ${courier.name}.`));
      batches.push(batch);
    }
    if (["scheduled", "pickup-in-progress"].includes(batch.status)) batch.orderIds = candidates.map((order) => order.id);
    const batchOrders = orders.filter((order) => batch.orderIds.includes(order.id));
    const grouped = new Map();
    batchOrders.forEach((order) => { const store = stores.find((item) => String(item.id) === String(order.storeId)); const key = String(order.storeId); if (!grouped.has(key)) grouped.set(key, { storeId: key, storeName: order.storeName ?? store?.name ?? "Merchant", location: store?.location ?? (store?.coordinates ? { label: store.address, latitude: store.coordinates.lat, longitude: store.coordinates.lng } : { label: store?.address ?? "Alamat belum tersedia" }), merchantContact: store?.phone ?? "-", orderIds: [] }); grouped.get(key).orderIds.push(order.id); });
    batch.pickupStops = optimizePickupRoute({ pickupStops: [...grouped.values()] }).stops;
    batch.deliveryStops = optimizeDeliveryRoute({ deliveryStops: batchOrders.map((order) => ({ orderId: order.id, orderNumber: order.orderNumber, recipientName: order.recipientName ?? order.customerName, recipientPhone: order.recipientPhone ?? order.customerPhone, address: order.deliveryAddress, location: order.deliveryLocation })) }).stops;
  });
  batches = batches.map((batch) => {
    if (batch.status !== "on-delivery") return batch;
    const included = orders.filter((order) => batch.orderIds.includes(order.id));
    if (included.length && included.every((order) => terminal.includes(order.status))) {
      const timestamp = now();
      return { ...batch, status: "completed", completedAt: batch.completedAt ?? timestamp, updatedAt: timestamp, history: batch.completedAt ? batch.history : [...batch.history, historyEntry("batch-completed", "Kucur System", "system", "Semua order aktif dalam batch telah mencapai status terminal.")] };
    }
    return batch;
  });
  saveBatches(batches);
  let ordersChanged = false;
  const assignedOrders = orders.map((order) => {
    const batch = batches.find((item) => item.orderIds.includes(order.id));
    if (!batch?.courierId || (String(order.courierId) === String(batch.courierId) && order.deliveryBatchId === batch.id)) return order;
    ordersChanged = true;
    return { ...order, deliveryBatchId: batch.id, courierId: batch.courierId, courierName: batch.courierName, courierAssignmentStatus: "batch-assigned", assignedAt: order.assignedAt ?? now() };
  });
  if (ordersChanged) saveOrders(assignedOrders);
  return batches;
}

export const getCourierBatches = (courierId) => syncDeliveryBatches().filter((batch) => String(batch.courierId) === String(courierId));
export const getCourierBatch = (batchId, courierId) => getCourierBatches(courierId).find((batch) => String(batch.id) === String(batchId)) ?? null;

export function confirmMerchantHandover({ orderId, storeId, merchantUserId, actorName, confirmed }) {
  const batch = syncDeliveryBatches().find((item) => item.orderIds.includes(orderId));
  if (!batch) return { success: false, message: "Batch tidak ditemukan." };
  if (batch.deliveryStartedAt) return { success: false, message: "Konfirmasi terkunci karena pengantaran sudah dimulai." };
  let changed = null; const timestamp = now();
  const orders = getOrders().map((order) => {
    if (String(order.id) !== String(orderId) || String(order.storeId) !== String(storeId) || order.merchantUserId !== merchantUserId) return order;
    if (confirmed && order.status !== "ready-for-pickup") return order;
    if (!confirmed && order.status !== "picked-up") return order;
    changed = { ...order, status: confirmed ? "picked-up" : "ready-for-pickup", pickupConfirmedAt: confirmed ? timestamp : null, pickupConfirmedByMerchantId: confirmed ? merchantUserId : null, pickupConfirmedByMerchantName: confirmed ? actorName : null, pickupCourierId: confirmed ? batch.courierId : null, updatedAt: timestamp, statusHistory: [...(order.statusHistory ?? []), { status: confirmed ? "picked-up" : "ready-for-pickup", actorType: "merchant", actorName, timestamp, action: confirmed ? "Pickup Handover Confirmed" : "Pickup Handover Reverted", oldStatus: order.status, newStatus: confirmed ? "picked-up" : "ready-for-pickup" }] };
    return changed;
  });
  if (!changed) return { success: false, message: "Order tidak dapat diubah pada status ini." };
  if (confirmed && batch.status === "scheduled") {
    const batches = getDeliveryBatches().map((item) => item.id === batch.id ? { ...item, status: "pickup-in-progress", pickupStartedAt: item.pickupStartedAt ?? timestamp, updatedAt: timestamp, history: [...item.history, historyEntry("pickup-started", actorName, "merchant", "Pickup batch mulai dikonfirmasi Merchant.")] } : item);
    saveBatches(batches);
  }
  saveOrders(orders); return { success: true, order: changed };
}

export function markMerchantNotReady({ orderId, storeId, merchantUserId, actorName, reason }) {
  if (!reason?.trim()) return { success: false, message: "Alasan wajib diisi." };
  const batches = syncDeliveryBatches(); const batch = batches.find((item) => item.orderIds.includes(orderId));
  if (!batch?.deliveryStartedAt) {
    const settings = getOperationalSettings(); const allOrders = getOrders(); let changed;
    const orders = allOrders.map((order) => { if (String(order.id) !== String(orderId) || String(order.storeId) !== String(storeId) || order.merchantUserId !== merchantUserId) return order; const scheduledDeliveryDate = determineScheduledDeliveryDate({ orderCreatedAt: `${batch.deliveryDate}T16:00:00+07:00`, cutoffTime: settings.deliveryOrderCutoffTime, maxDailyDeliveries: settings.maxDailyDeliveries, existingScheduledOrders: allOrders.filter((item) => item.id !== order.id) }); const timestamp = now(); changed = { ...order, scheduledDeliveryDate, pickupConfirmedAt: null, updatedAt: timestamp, statusHistory: [...(order.statusHistory ?? []), { status: order.status, actorType: "merchant", actorName, timestamp, action: "Merchant Not Ready", reason, description: `Dijadwalkan ulang ke ${scheduledDeliveryDate}.` }] }; return changed; });
    if (changed) { saveOrders(orders); batch.orderIds = batch.orderIds.filter((id) => id !== orderId); batch.history.push(historyEntry("order-rolled-over", actorName, "merchant", `Order ${changed.orderNumber} dijadwalkan ulang.`, reason)); saveBatches(batches); createNotification({ recipientUserId: changed.customerId, recipientRole: "customer", type: "order", title: "Jadwal pengiriman berubah", message: `Jadwal pengiriman ${changed.orderNumber} berubah menjadi ${changed.scheduledDeliveryDate}.`, link: `/orders/${changed.id}` }); return { success: true, order: changed }; }
  }
  return { success: false, message: "Order tidak dapat dijadwalkan ulang setelah pengantaran dimulai." };
}

export function startBatchDelivery({ batchId, courierId, actorName }) {
  const batches = syncDeliveryBatches(); const batch = batches.find((item) => String(item.id) === String(batchId) && String(item.courierId) === String(courierId));
  if (!batch || batch.deliveryStartedAt) return { success: false, message: "Batch tidak valid atau sudah dimulai." };
  const orders = getOrders(); const active = orders.filter((order) => batch.orderIds.includes(order.id) && !terminal.includes(order.status));
  if (!active.length || active.some((order) => order.status !== "picked-up" || !order.pickupConfirmedAt)) return { success: false, message: `${active.filter((order) => !order.pickupConfirmedAt).length} pesanan belum dikonfirmasi Merchant.` };
  const timestamp = now(); batch.status = "on-delivery"; batch.deliveryStartedAt = timestamp; batch.pickupCompletedAt = timestamp; batch.updatedAt = timestamp; batch.history.push(historyEntry("delivery-started", actorName, "courier", "Pengantaran batch dimulai."));
  saveOrders(orders.map((order) => batch.orderIds.includes(order.id) && order.status === "picked-up" ? { ...order, status: "on-delivery", updatedAt: timestamp, statusHistory: [...(order.statusHistory ?? []), { status: "on-delivery", actorType: "courier", actorName, timestamp, action: "Delivery Started", oldStatus: "picked-up", newStatus: "on-delivery" }] } : order)); saveBatches(batches); return { success: true, batch };
}
