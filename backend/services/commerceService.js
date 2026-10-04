const crypto = require("node:crypto");
const { errors } = require("../errors/AppError");
const { requiredString } = require("../validation/sharedValidation");
const midtransConfig = require("../midtransConfig");
const { sellable, quantity } = require("./cartService");
const { generateCommerceFinance } = require("./financeService");

const fulfillmentToDb = { "ready-for-pickup": "readyForPickup", "picked-up": "pickedUp", "on-delivery": "onDelivery" };
const allowedTransitions = { pending: ["confirmed", "processing", "cancelled"], confirmed: ["processing", "cancelled"], processing: ["ready-for-pickup", "cancelled"], "ready-for-pickup": ["picked-up"], "picked-up": ["on-delivery"], "on-delivery": ["delivered"], delivered: ["completed"], completed: [], cancelled: [] };
const money = (value, field) => { const parsed = Number(value ?? 0); if (!Number.isFinite(parsed) || parsed < 0) throw errors.validation({ [field]: "Nilai harus non-negatif." }); return parsed; };
const coordinateDistanceKm = (origin, destination) => {
  const values = [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [lat1, lon1, lat2, lon2] = values.map((value) => value * Math.PI / 180);
  const latitudeDelta = lat2 - lat1; const longitudeDelta = lon2 - lon1;
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function createCommerceService(repository) {
  const resolveSelection = async (input, actor, source = repository) => {
    let selections;
    let selectedCartIds = [];
    if (Array.isArray(input.cartItemIds)) {
      const cart = await source.commerce.ensureCart(actor.id); const requested = new Set(input.cartItemIds.map(String));
      selections = cart.items.filter((item) => requested.has(item.id)).map((item) => ({ productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, cartItemId: item.id }));
      selectedCartIds = selections.map((item) => item.cartItemId);
      if (!requested.size || selections.length !== requested.size) throw errors.validation({ cartItemIds: "Pilihan Cart tidak valid." });
    } else selections = Array.isArray(input.items) ? input.items : [];
    if (!selections.length) throw errors.validation({ items: "Minimal satu item wajib dipilih." });
    const resolved = [];
    for (const selection of selections) {
      const product = await source.products.findById(String(selection.productId || "")); const requested = quantity(selection.quantity);
      const variantId = selection.productVariantId ? String(selection.productVariantId) : null; const variant = sellable(product, variantId, requested);
      const unitPrice = variant ? variant.price : product.price;
      resolved.push({ product, variant, productId: product.id, productVariantId: variant?.id || null, quantity: requested, unitPrice, subtotal: unitPrice * requested, cartItemId: selection.cartItemId || null });
    }
    return { resolved, selectedCartIds };
  };
  const quote = async (input, actor, source = repository) => {
    const { resolved, selectedCartIds } = await resolveSelection(input, actor, source); const settings = await source.settings.get();
    const paymentMethod = String(input.paymentMethod || "COD").toUpperCase();
    if (!["COD", "MIDTRANS"].includes(paymentMethod)) throw errors.validation({ paymentMethod: "Metode pembayaran tidak valid." });
    if (paymentMethod === "MIDTRANS" && !midtransConfig.midtransConfigured) { const error = new Error("Midtrans belum dikonfigurasi."); error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED"; error.statusCode = 503; throw error; }
    const delivery = input.delivery || {}; const address = requiredString(delivery.address || input.deliveryAddress, "deliveryAddress", { max: 1000 });
    const recipientName = requiredString(delivery.recipientName || input.recipientName || actor.fullName, "recipientName", { max: 120 });
    const recipientPhone = requiredString(delivery.recipientPhone || input.recipientPhone || actor.phone, "recipientPhone", { max: 20 });
    const groups = new Map();
    for (const item of resolved) { const group = groups.get(item.product.storeId) || { store: item.product.store, items: [], productTotal: 0 }; group.items.push(item); group.productTotal += item.subtotal; groups.set(item.product.storeId, group); }
    const resultGroups = [...groups.values()].map((group) => {
      const destination = delivery.location || { latitude: delivery.latitude, longitude: delivery.longitude };
      const distanceKm = coordinateDistanceKm(group.store.location, destination); if (!Number.isFinite(distanceKm) || distanceKm < 0) throw errors.validation({ distanceKm: `Koordinat pengiriman untuk ${group.store.name} belum tersedia.` });
      const roundedDistanceKm = Math.ceil(distanceKm); const deliveryFee = roundedDistanceKm * Number(settings.deliveryRatePerKm);
      const courierTip = money(input.tipsByStore?.[group.store.id] ?? input.courierTip, "courierTip");
      return { ...group, distanceKm, roundedDistanceKm, deliveryRateSnapshot: Number(settings.deliveryRatePerKm), deliveryFee, courierTip, totalAmount: group.productTotal + deliveryFee + courierTip };
    });
    return { groups: resultGroups, selectedCartIds, recipientName, recipientPhone, deliveryAddress: address, deliveryLocation: delivery.location || input.deliveryLocation || null, paymentMethod, productTotal: resultGroups.reduce((sum, group) => sum + group.productTotal, 0), deliveryFee: resultGroups.reduce((sum, group) => sum + group.deliveryFee, 0), courierTip: resultGroups.reduce((sum, group) => sum + group.courierTip, 0), grandTotal: resultGroups.reduce((sum, group) => sum + group.totalAmount, 0), paymentAvailability: { COD: true, MIDTRANS: midtransConfig.midtransConfigured } };
  };
  const access = async (order, actor) => {
    if (actor.roles.includes("admin") || order.customerUserId === actor.id) return;
    const store = await repository.stores.findById(order.storeId); if (!actor.roles.includes("merchant") || store?.merchantUserId !== actor.id) throw errors.forbidden("Order tidak dapat diakses.");
  };
  return {
    preview: quote,
    async create(input, actor, idempotencyKey) {
      const key = requiredString(idempotencyKey || input.idempotencyKey, "idempotencyKey", { max: 100 });
      const existing = await repository.commerce.findCheckout(actor.id, key); if (existing) return existing;
      return repository.transaction(async (tx) => {
        const repeated = await tx.commerce.findCheckout(actor.id, key); if (repeated) return repeated;
        // Price, availability, settings and delivery totals are deliberately
        // resolved again inside the same transaction that reserves inventory.
        const preview = await quote(input, actor, tx);
        const checkout = await tx.commerce.createCheckout({ customerUserId: actor.id, idempotencyKey: key }); const orders = [];
        for (const group of preview.groups) {
          for (const item of group.items) {
            const reserved = item.variant ? await tx.commerce.reserveVariant(item.productId, item.productVariantId, item.quantity) : await tx.commerce.reserveSimple(item.productId, item.quantity);
            if (!reserved) throw errors.conflict(`Stok ${item.product.name} berubah atau tidak mencukupi.`);
          }
          const expiry = preview.paymentMethod === "MIDTRANS" ? new Date(Date.now() + 20 * 60 * 1000) : null;
          const order = await tx.commerce.createOrder({ orderCode: `KUC-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`, checkoutTransactionId: checkout.id, customerUserId: actor.id, storeId: group.store.id, fulfillmentStatus: "pending", paymentStatus: "pending", paymentMethod: preview.paymentMethod, productTotal: group.productTotal, deliveryFee: group.deliveryFee, courierTip: group.courierTip, totalAmount: group.totalAmount, distanceKm: group.distanceKm, roundedDistanceKm: group.roundedDistanceKm, deliveryRateSnapshot: group.deliveryRateSnapshot, recipientName: preview.recipientName, recipientPhone: preview.recipientPhone, deliveryAddress: preview.deliveryAddress, deliveryLocation: preview.deliveryLocation, items: { create: group.items.map((item) => ({ productId: item.productId, productVariantId: item.productVariantId, productName: item.product.name, variantOptions: item.variant?.options || undefined, sku: item.variant?.sku || null, imageUrl: item.variant?.image?.url || item.product.image || null, storeName: group.store.name, unitPrice: item.unitPrice, quantity: item.quantity, subtotal: item.subtotal })) }, reservations: { create: group.items.map((item) => ({ productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, status: "reserved", expiresAt: expiry })) }, activities: { create: { actorUserId: actor.id, actorType: "customer", activityType: "ORDER_CREATED", toStatus: "pending", description: "Order dibuat." } }, paymentAttempts: { create: { provider: preview.paymentMethod === "COD" ? "cod" : "midtrans", paymentMethod: preview.paymentMethod, status: "pending", amount: group.totalAmount, expiresAt: expiry } } }); orders.push(order);
        }
        if (preview.selectedCartIds.length) { const cart = await tx.commerce.ensureCart(actor.id); await tx.commerce.deleteCartItems(preview.selectedCartIds, cart.id); }
        return { id: checkout.id, idempotencyKey: key, orders };
      });
    },
    async list(actor, filters = {}) { let orders = await repository.commerce.listOrders(); if (actor.roles.includes("admin")) { if (filters.storeId) orders = orders.filter((order) => order.storeId === String(filters.storeId)); return orders; } if (actor.roles.includes("merchant")) { const owned = new Set((await repository.stores.list()).filter((store) => store.merchantUserId === actor.id).map((store) => store.id)); orders = orders.filter((order) => owned.has(order.storeId)); if (filters.storeId) orders = orders.filter((order) => order.storeId === String(filters.storeId)); return orders; } return orders.filter((order) => order.customerUserId === actor.id); },
    async get(id, actor) { const order = await repository.commerce.findOrder(id); if (!order) throw errors.notFound("Order tidak ditemukan."); await access(order, actor); return order; },
    async transition(id, nextStatus, actor) { const order = await this.get(id, actor); const next = String(nextStatus); if (!allowedTransitions[order.fulfillmentStatus]?.includes(next)) throw errors.validation({ status: "Transisi status Order tidak valid." }); if (actor.roles.includes("customer") && !actor.roles.includes("merchant") && next !== "completed" && next !== "cancelled") throw errors.forbidden(); return repository.transaction(async (tx) => { const current = await tx.commerce.findOrder(id); if (!current || !allowedTransitions[current.fulfillmentStatus]?.includes(next)) throw errors.conflict("Status Order sudah berubah."); if (next === "completed") for (const reservation of current.reservations.filter((item) => item.status === "reserved")) await tx.commerce.consumeReservation(reservation.id); const updated = await tx.commerce.updateOrder(id, { fulfillmentStatus: fulfillmentToDb[next] || next }); if (next === "completed") await generateCommerceFinance(tx, updated, new Date()); await tx.commerce.addActivity({ orderId: id, actorUserId: actor.id, actorType: actor.roles.includes("admin") ? "admin" : actor.roles.includes("merchant") ? "merchant" : "customer", activityType: "FULFILLMENT_STATUS_CHANGED", fromStatus: current.fulfillmentStatus, toStatus: next, description: `Status Order menjadi ${next}.` }); return updated; }); },
    async cancel(id, reason, actor) { const order = await this.get(id, actor); if (!["pending", "confirmed", "processing"].includes(order.fulfillmentStatus)) throw errors.validation({ status: "Order tidak dapat dibatalkan pada tahap ini." }); if (order.paymentStatus === "paid") throw errors.conflict("Order berbayar memerlukan proses refund terpisah sebelum dibatalkan."); return repository.transaction(async (tx) => { const current = await tx.commerce.findOrder(id); if (!current || !["pending", "confirmed", "processing"].includes(current.fulfillmentStatus) || current.paymentStatus === "paid") throw errors.conflict("Order sudah berubah dan tidak dapat dibatalkan."); for (const reservation of current.reservations.filter((item) => item.status === "reserved")) { const claimed = await tx.commerce.releaseReservation(reservation.id); if (!claimed) continue; if (reservation.productVariantId) await tx.commerce.releaseVariant(reservation.productVariantId, reservation.quantity); else await tx.commerce.releaseSimple(reservation.productId, reservation.quantity); } const updated = await tx.commerce.updateOrder(id, { fulfillmentStatus: "cancelled", paymentStatus: current.paymentStatus === "pending" ? "cancelled" : current.paymentStatus, cancellationReason: String(reason || "").slice(0, 1000) || null, cancelledAt: new Date() }); await tx.commerce.addActivity({ orderId: id, actorUserId: actor.id, actorType: actor.roles.includes("merchant") ? "merchant" : actor.roles.includes("admin") ? "admin" : "customer", activityType: "ORDER_CANCELLED", fromStatus: current.fulfillmentStatus, toStatus: "cancelled", description: "Order dibatalkan dan stok dikembalikan." }); return updated; }); },
    async reconcileExpired(actor) { if (!actor.roles.includes("admin")) throw errors.forbidden(); const expired = await repository.commerce.listExpiredPaymentOrders(new Date()); const reconciled = []; for (const candidate of expired) { const result = await repository.transaction(async (tx) => { const current = await tx.commerce.findOrder(candidate.id); if (!current || current.paymentStatus !== "pending" || current.paymentMethod !== "MIDTRANS") return null; for (const reservation of current.reservations.filter((item) => item.status === "reserved")) { const claimed = await tx.commerce.releaseReservation(reservation.id); if (!claimed) continue; if (reservation.productVariantId) await tx.commerce.releaseVariant(reservation.productVariantId, reservation.quantity); else await tx.commerce.releaseSimple(reservation.productId, reservation.quantity); } const updated = await tx.commerce.updateOrder(current.id, { paymentStatus: "expired", fulfillmentStatus: "cancelled", cancellationReason: "Pembayaran kedaluwarsa.", cancelledAt: new Date() }); await tx.commerce.addActivity({ orderId: current.id, actorUserId: actor.id, actorType: "admin", activityType: "PAYMENT_EXPIRED", fromStatus: "pending", toStatus: "expired", description: "Pembayaran kedaluwarsa; reservasi stok dilepas." }); return updated; }); if (result) reconciled.push(result); } return { reconciled: reconciled.length, orders: reconciled }; },
  };
}
module.exports = { createCommerceService };
