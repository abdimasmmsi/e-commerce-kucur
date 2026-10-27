const { notifySafe } = require("./notifyHelpers");
const crypto = require("node:crypto");
const { errors } = require("../errors/AppError");
const { requiredString } = require("../validation/sharedValidation");
const { DEFAULT_MAX_DELIVERY_KM, assertInServiceArea } = require("../validation/serviceArea");
const { computeDeliveryFee } = require("./deliveryFee");
const midtransConfig = require("../midtransConfig");
const { sellable, quantity } = require("./cartService");
const { generateCommerceFinance } = require("./financeService");

const fulfillmentToDb = { "ready-for-pickup": "readyForPickup", "picked-up": "pickedUp", "on-delivery": "onDelivery" };
const allowedTransitions = { pending: ["confirmed", "processing", "cancelled"], confirmed: ["processing", "cancelled"], processing: ["ready-for-pickup", "cancelled"], "ready-for-pickup": ["picked-up"], "picked-up": ["on-delivery"], "on-delivery": ["delivered"], delivered: ["completed"], completed: [], cancelled: [] };
const MERCHANT_STEPS = ["confirmed", "processing", "ready-for-pickup"];
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
      assertInServiceArea(Number(destination.latitude), Number(destination.longitude), "deliveryLocation");
      const distanceKm = coordinateDistanceKm(group.store.location, destination); if (!Number.isFinite(distanceKm) || distanceKm < 0) throw errors.validation({ distanceKm: `Koordinat pengiriman untuk ${group.store.name} belum tersedia.` });
      const maxDistance = settings.maxDeliveryDistanceKm != null && Number.isFinite(Number(settings.maxDeliveryDistanceKm)) ? Number(settings.maxDeliveryDistanceKm) : DEFAULT_MAX_DELIVERY_KM;
      if (distanceKm > maxDistance) throw errors.validation({ distanceKm: `Alamat di luar jangkauan pengiriman ${group.store.name} (maksimal ${maxDistance} km, jarak ${Math.ceil(distanceKm)} km).` });
      const roundedDistanceKm = Math.ceil(distanceKm); const deliveryFee = computeDeliveryFee(roundedDistanceKm, settings);
      const courierTip = money(input.tipsByStore?.[group.store.id] ?? input.courierTip, "courierTip");
      const taxPercent = Number(settings.taxPercent) || 0; const taxAmount = Math.round(group.productTotal * taxPercent / 100);
      return { ...group, distanceKm, roundedDistanceKm, deliveryRateSnapshot: Number(settings.deliveryRatePerKm), deliveryFee, courierTip, taxPercent, taxAmount, totalAmount: group.productTotal + taxAmount + deliveryFee + courierTip };
    });
    return { groups: resultGroups, selectedCartIds, recipientName, recipientPhone, deliveryAddress: address, deliveryLocation: delivery.location || input.deliveryLocation || null, paymentMethod, productTotal: resultGroups.reduce((sum, group) => sum + group.productTotal, 0), taxPercent: Number(settings.taxPercent) || 0, taxAmount: resultGroups.reduce((sum, group) => sum + group.taxAmount, 0), deliveryFee: resultGroups.reduce((sum, group) => sum + group.deliveryFee, 0), courierTip: resultGroups.reduce((sum, group) => sum + group.courierTip, 0), grandTotal: resultGroups.reduce((sum, group) => sum + group.totalAmount, 0), paymentAvailability: { COD: true, MIDTRANS: midtransConfig.midtransConfigured } };
  };
  const access = async (order, actor) => {
    if (actor.roles.includes("admin") || order.customerUserId === actor.id) return;
    const store = await repository.stores.findById(order.storeId); if (!actor.roles.includes("merchant") || store?.merchantUserId !== actor.id) throw errors.forbidden("Order tidak dapat diakses.");
  };
  // Pesanan yang sudah masuk batch tapi belum diambil kurir dikeluarkan dari batch saat dibatalkan, supaya kurir
  // tidak mengambil/mengantar (dan menagih) pesanan batal. Yang sudah diambil kurir tidak bisa dibatalkan.
  const releaseDeliveryAssignment = async (tx, order, actor, note) => {
    if (!tx.delivery?.activeAssignment) return;
    const assignment = await tx.delivery.activeAssignment(order.id); if (!assignment) return;
    if (assignment.status !== "WAITING_PICKUP") throw errors.conflict("Pesanan sudah diambil kurir dan tidak dapat dibatalkan.");
    const courierUserId = assignment.batch?.courierUserId || null;
    await tx.delivery.updateAssignment(assignment.id, { status: "CANCELLED" });
    await tx.delivery.addActivity({ commerceOrderId: order.id, courierUserId, status: "CANCELLED", note: note || "Pesanan dibatalkan sebelum diambil kurir." });
    await notifySafe(tx, [{ userId: courierUserId, type: "COMMERCE_ORDER_CANCELLED", title: "Pesanan batal, tidak perlu diambil", body: `Pesanan #${order.orderCode} dibatalkan dan sudah dikeluarkan dari daftar pengirimanmu.`, entityType: "DELIVERY_BATCH", entityId: assignment.deliveryBatchId || assignment.batch?.id || null, metadata: { orderCode: order.orderCode, status: "cancelled", commerceOrderId: order.id }, dedupeKey: `commerce-order-cancelled-courier:${order.id}` }]);
  };
  const service = {
    preview: quote,
    async create(input, actor, idempotencyKey) {
      const key = requiredString(idempotencyKey || input.idempotencyKey, "idempotencyKey", { max: 100 });
      const existing = await repository.commerce.findCheckout(actor.id, key); if (existing) return existing;
      // Dua request dengan kunci sama bisa lolos pengecekan di atas bersamaan (tap ganda, retry jaringan).
      // Yang kalah menabrak unique (customer + key + store); kembalikan checkout pemenang, jangan error.
      try { return await repository.transaction(async (tx) => {
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
          const order = await tx.commerce.createOrder({ orderCode: `KUC-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`, checkoutTransactionId: checkout.id, customerUserId: actor.id, storeId: group.store.id, fulfillmentStatus: "pending", paymentStatus: "pending", paymentMethod: preview.paymentMethod, productTotal: group.productTotal, taxPercentSnapshot: group.taxPercent, taxAmount: group.taxAmount, deliveryFee: group.deliveryFee, courierTip: group.courierTip, totalAmount: group.totalAmount, distanceKm: group.distanceKm, roundedDistanceKm: group.roundedDistanceKm, deliveryRateSnapshot: group.deliveryRateSnapshot, recipientName: preview.recipientName, recipientPhone: preview.recipientPhone, deliveryAddress: preview.deliveryAddress, deliveryLocation: preview.deliveryLocation, items: { create: group.items.map((item) => ({ productId: item.productId, productVariantId: item.productVariantId, productName: item.product.name, variantOptions: item.variant?.options || undefined, sku: item.variant?.sku || null, imageUrl: item.variant?.image?.url || item.product.image || null, storeName: group.store.name, unitPrice: item.unitPrice, quantity: item.quantity, subtotal: item.subtotal })) }, reservations: { create: group.items.map((item) => ({ productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, status: "reserved", expiresAt: expiry })) }, activities: { create: { actorUserId: actor.id, actorType: "customer", activityType: "ORDER_CREATED", toStatus: "pending", description: "Order dibuat." } }, paymentAttempts: { create: { provider: preview.paymentMethod === "COD" ? "cod" : "midtrans", paymentMethod: preview.paymentMethod, status: "pending", amount: group.totalAmount, expiresAt: expiry } } }); orders.push(order);
        }
        if (preview.selectedCartIds.length) { const cart = await tx.commerce.ensureCart(actor.id); await tx.commerce.deleteCartItems(preview.selectedCartIds, cart.id); }
        return { id: checkout.id, idempotencyKey: key, orders };
      }); } catch (error) {
        if (error?.code !== "P2002") throw error;
        const winner = await repository.commerce.findCheckout(actor.id, key); if (winner) return winner;
        throw error;
      }
    },
    // Daftar pesanan menurut scope (disaring di database, tidak memuat pesanan semua orang):
    //  - tanpa scope / "customer": pesanan belanja milik pengguna sendiri (juga untuk penjual/admin yang berbelanja);
    //  - "merchant": pesanan toko milik pengguna (opsional storeId); - "admin": semua pesanan (hanya admin).
    // since (tanggal ISO) dan limit membatasi jumlah; admin tanpa batas eksplisit dibatasi 2000 pesanan terbaru.
    async list(actor, filters = {}) {
      const scope = String(filters.scope || "customer");
      const sinceTime = filters.since ? Date.parse(filters.since) : NaN;
      const since = Number.isFinite(sinceTime) ? new Date(sinceTime).toISOString() : undefined;
      const requested = Number.parseInt(filters.limit, 10);
      const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 5000) : undefined;
      if (scope === "admin") {
        if (!actor.roles.includes("admin")) throw errors.forbidden();
        return repository.commerce.listOrders({ ...(filters.storeId ? { storeId: String(filters.storeId) } : {}), since, limit: limit ?? 2000 });
      }
      if (scope === "merchant") {
        if (!actor.roles.includes("merchant") && !actor.roles.includes("admin")) throw errors.forbidden();
        const owned = (await repository.stores.list()).filter((store) => store.merchantUserId === actor.id).map((store) => store.id);
        const storeIds = filters.storeId ? owned.filter((id) => id === String(filters.storeId)) : owned;
        return repository.commerce.listOrders({ storeIds, since, limit: limit ?? 2000 });
      }
      return repository.commerce.listOrders({ customerUserId: actor.id, since, limit });
    },
    async get(id, actor) { const order = await repository.commerce.findOrder(id); if (!order) throw errors.notFound("Order tidak ditemukan."); await access(order, actor); return order; },
    // Lapak (pemilik) dan admin hanya memajukan tahap lapak. Pembatalan wajib lewat cancel() supaya aturan tahap,
    // alasan, dan pengembalian stok berlaku; tahap diambil/diantar/sampai hanya lewat layanan pengiriman kurir.
    async transition(id, nextStatus, actor) { const order = await this.get(id, actor); const next = String(nextStatus); if (next === "cancelled") throw errors.validation({ status: "Gunakan Batalkan pesanan (dengan alasan) untuk membatalkan." }); if (!allowedTransitions[order.fulfillmentStatus]?.includes(next)) throw errors.validation({ status: "Transisi status Order tidak valid." }); const isAdmin = actor.roles.includes("admin"); const ownsStore = actor.roles.includes("merchant") && String((order.store || await repository.stores.findById(order.storeId))?.merchantUserId) === String(actor.id); const permitted = MERCHANT_STEPS.includes(next) ? isAdmin || ownsStore : next === "completed" ? isAdmin || order.customerUserId === actor.id : false; if (!permitted) throw errors.forbidden("Status pesanan ini tidak bisa diubah dari akunmu."); return repository.transaction(async (tx) => { const current = await tx.commerce.findOrder(id); if (!current || !allowedTransitions[current.fulfillmentStatus]?.includes(next)) throw errors.conflict("Status Order sudah berubah."); if (next === "completed") for (const reservation of current.reservations.filter((item) => item.status === "reserved")) await tx.commerce.consumeReservation(reservation.id); const updated = await tx.commerce.updateOrder(id, { fulfillmentStatus: fulfillmentToDb[next] || next }); if (next === "completed") await generateCommerceFinance(tx, updated, new Date()); await tx.commerce.addActivity({ orderId: id, actorUserId: actor.id, actorType: actor.roles.includes("admin") ? "admin" : actor.roles.includes("merchant") ? "merchant" : "customer", activityType: "FULFILLMENT_STATUS_CHANGED", fromStatus: current.fulfillmentStatus, toStatus: next, description: `Status Order menjadi ${next}.` }); return updated; }); },
    // Pembeli hanya bisa batal sebelum lapak mulai mengemas; lapak/admin masih bisa batal saat dikemas (mis. stok ternyata habis).
    async cancel(id, reason, actor) { const order = await this.get(id, actor); const byCustomer = String(order.customerUserId) === String(actor.id) && !actor.roles.includes("admin"); // Pengiriman gagal (pembeli menolak/tidak bisa dihubungi): hanya Admin yang boleh membatalkan, stok dikembalikan.
      const deliveryFailed = async (client) => actor.roles.includes("admin") && Boolean(client.delivery?.latestAssignment) && !(await client.delivery.activeAssignment?.(id)) && (await client.delivery.latestAssignment(id))?.status === "FAILED"; const failedCancel = !byCustomer && !["cancelled", "completed", "delivered"].includes(order.fulfillmentStatus) && await deliveryFailed(repository); const cancellable = byCustomer ? ["pending", "confirmed"] : failedCancel ? [order.fulfillmentStatus] : ["pending", "confirmed", "processing"]; if (!cancellable.includes(order.fulfillmentStatus)) throw errors.validation({ status: byCustomer && order.fulfillmentStatus === "processing" ? "Pesanan sudah dikemas penjual dan tidak bisa dibatalkan. Hubungi penjual lewat chat." : "Order tidak dapat dibatalkan pada tahap ini." }); if (order.paymentStatus === "paid") throw errors.conflict("Order berbayar memerlukan proses refund terpisah sebelum dibatalkan."); const note = String(reason || "").trim(); if (!byCustomer && !note) throw errors.validation({ reason: "Alasan pembatalan wajib diisi untuk pembeli." }); return repository.transaction(async (tx) => { if (tx.delivery?.lockOrder) await tx.delivery.lockOrder(id); const current = await tx.commerce.findOrder(id); if (!current || !cancellable.includes(current.fulfillmentStatus) || current.paymentStatus === "paid" || (failedCancel && !(await deliveryFailed(tx)))) throw errors.conflict("Order sudah berubah dan tidak dapat dibatalkan."); await releaseDeliveryAssignment(tx, current, actor, note); for (const reservation of current.reservations.filter((item) => item.status === "reserved")) { const claimed = await tx.commerce.releaseReservation(reservation.id); if (!claimed) continue; if (reservation.productVariantId) await tx.commerce.releaseVariant(reservation.productVariantId, reservation.quantity); else await tx.commerce.releaseSimple(reservation.productId, reservation.quantity); } const updated = await tx.commerce.updateOrder(id, { fulfillmentStatus: "cancelled", paymentStatus: current.paymentStatus === "pending" ? "cancelled" : current.paymentStatus, cancellationReason: String(reason || "").slice(0, 1000) || null, cancelledAt: new Date() }); await tx.commerce.addActivity({ orderId: id, actorUserId: actor.id, actorType: byCustomer ? "customer" : actor.roles.includes("admin") ? "admin" : "merchant", activityType: "ORDER_CANCELLED", fromStatus: current.fulfillmentStatus, toStatus: "cancelled", description: failedCancel ? "Pengiriman gagal; Admin membatalkan order dan stok dikembalikan." : "Order dibatalkan dan stok dikembalikan." }); if (byCustomer) { const store = await tx.stores.findById(current.storeId); await notifySafe(tx, [{ userId: store?.merchantUserId, type: "COMMERCE_ORDER_CANCELLED", title: "Pesanan dibatalkan pembeli", body: `Pesanan #${current.orderCode} dibatalkan pembeli${reason ? `. Alasan: ${String(reason).slice(0, 200)}` : "."} Stok sudah dikembalikan.`, entityType: "COMMERCE_ORDER", entityId: id, metadata: { orderCode: current.orderCode, status: "cancelled", by: "customer" }, dedupeKey: `commerce-order-cancelled-merchant:${id}` }]); } else if (failedCancel) { const store = await tx.stores.findById(current.storeId); await notifySafe(tx, [{ userId: store?.merchantUserId, type: "COMMERCE_ORDER_CANCELLED", title: "Pesanan dibatalkan setelah gagal dikirim", body: `Pesanan #${current.orderCode} dibatalkan Admin karena pengiriman gagal. Alasan: ${note.slice(0, 200)}. Stok sudah dikembalikan; kurir akan mengembalikan barang dan kamu mengembalikan uang talangan kurir.`, entityType: "COMMERCE_ORDER", entityId: id, metadata: { orderCode: current.orderCode, status: "cancelled", by: "admin", storeId: current.storeId }, dedupeKey: `commerce-order-cancelled-merchant:${id}` }]); } return updated; }); },
    async reconcileExpired(actor) { if (!actor.roles.includes("admin")) throw errors.forbidden(); const expired = await repository.commerce.listExpiredPaymentOrders(new Date()); const reconciled = []; for (const candidate of expired) { const result = await repository.transaction(async (tx) => { const current = await tx.commerce.findOrder(candidate.id); if (!current || current.paymentStatus !== "pending" || current.paymentMethod !== "MIDTRANS") return null; for (const reservation of current.reservations.filter((item) => item.status === "reserved")) { const claimed = await tx.commerce.releaseReservation(reservation.id); if (!claimed) continue; if (reservation.productVariantId) await tx.commerce.releaseVariant(reservation.productVariantId, reservation.quantity); else await tx.commerce.releaseSimple(reservation.productId, reservation.quantity); } const updated = await tx.commerce.updateOrder(current.id, { paymentStatus: "expired", fulfillmentStatus: "cancelled", cancellationReason: "Pembayaran kedaluwarsa.", cancelledAt: new Date() }); await tx.commerce.addActivity({ orderId: current.id, actorUserId: actor.id, actorType: "admin", activityType: "PAYMENT_EXPIRED", fromStatus: "pending", toStatus: "expired", description: "Pembayaran kedaluwarsa; reservasi stok dilepas." }); return updated; }); if (result) reconciled.push(result); } return { reconciled: reconciled.length, orders: reconciled }; },
  };
  // Setelah checkout: beri tahu lapak kalau stok produknya tinggal sedikit (sekali per produk per hari).
  const LOW_STOCK = 5;
  const originalCreate = service.create;
  service.create = async (input, actor, idempotencyKey) => {
    const result = await originalCreate(input, actor, idempotencyKey);
    try {
      const productIds = [...new Set((result.orders || []).flatMap((order) => (order.items || []).map((item) => item.productId)).filter(Boolean))];
      const today = new Date().toISOString().slice(0, 10);
      const items = [];
      for (const productId of productIds) {
        const product = await repository.products.findById(productId);
        if (!product || product.status !== "active") continue;
        const stock = product.hasVariants ? (product.variants || []).filter((variant) => variant.status === "active").reduce((sum, variant) => sum + Number(variant.stock || 0), 0) : Number(product.stock || 0);
        if (stock > LOW_STOCK) continue;
        const store = product.store || await repository.stores.findById(product.storeId);
        items.push({ userId: store?.merchantUserId, type: "PRODUCT_LOW_STOCK", title: stock <= 0 ? "Stok habis" : "Stok hampir habis", body: stock <= 0 ? `Stok "${product.name}" sudah habis. Tambah stok supaya pembeli bisa memesan lagi.` : `Stok "${product.name}" tinggal ${stock}. Tambah stok sebelum habis.`, entityType: "PRODUCT", entityId: product.id, metadata: { stock, storeId: product.storeId }, dedupeKey: `low-stock:${product.id}:${stock <= 0 ? "out" : "low"}:${today}` });
      }
      await notifySafe(repository, items);
    } catch (error) { console.warn(`[notification] ${error.message}`); }
    return result;
  };
  return service;
}
module.exports = { createCommerceService };
