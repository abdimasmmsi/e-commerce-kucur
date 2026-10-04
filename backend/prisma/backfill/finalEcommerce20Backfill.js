const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();
const DISPOSABLE_MODE = process.env.FINAL_BACKFILL_DISPOSABLE === "true";
const RUNTIME_SYNC = process.env.FINAL_BACKFILL_RUNTIME_SYNC === "true";
const MIGRATION_TIMESTAMP = new Date("2026-08-31T00:00:00.000Z");
const EXPECTED_COUNTS = {
  targetUser: 5, targetUserRole: 7, targetSession: 97, targetPlatformSettings: 1,
  targetStore: 6, targetProduct: 3, targetProductVariant: 3, targetCart: 2,
  targetCartItem: 0, targetCommerceOrder: 9, targetCommerceOrderItem: 4,
  targetMerchantFee: 29, targetPaymentAttempt: 5, targetCourierProfile: 1,
  targetDeliveryBatch: 6, targetDeliveryBatchOrder: 6, targetReview: 4,
  targetConversation: 6, targetMessage: 10, targetNotification: 49,
};
const FROZEN_LEGACY_COUNTS = {"admin_fee_obligations":5,"admin_fee_settlement_items":0,"admin_fee_settlements":0,"audit_records":117,"cart_items":0,"carts":2,"checkout_transactions":4,"commerce_order_activities":12,"commerce_order_items":4,"commerce_orders":9,"conversation_contexts":2,"conversation_participants":12,"conversations":6,"courier_availabilities":1,"courier_profiles":1,"delivery_activities":15,"delivery_batch_orders":6,"delivery_batches":6,"delivery_proofs":4,"live_in_booking_activities":0,"live_in_booking_rooms":1,"live_in_bookings":1,"live_in_group_offer_rooms":2,"live_in_group_offers":1,"live_in_group_requests":1,"live_in_meal_plans":1,"live_in_profiles":1,"live_in_review_targets":1,"live_in_room_meal_overrides":1,"live_in_room_night_reservations":2,"live_in_rooms":2,"message_reads":7,"messages":10,"notifications":51,"payment_attempts":5,"pickup_confirmations":0,"platform_settings":1,"platform_transactions":7,"product_images":0,"product_options":2,"product_review_targets":4,"product_variants":3,"products":3,"review_photos":0,"review_replies":3,"reviews":6,"roles":4,"sessions":97,"stock_reservations":3,"store_initial_fees":3,"store_installment_payments":2,"store_installment_penalties":11,"store_installments":10,"store_status_history":5,"stores":8,"tourism_booking_activities":0,"tourism_bookings":1,"tourism_group_offers":0,"tourism_group_requests":1,"tourism_packages":2,"tourism_review_targets":1,"tourism_schedules":2,"user_roles":7,"users":5,"voluntary_contributions":0};
const jsonFields = {
  targetProduct: ["images", "options"], targetProductVariant: ["selectedOptions"],
  targetCommerceOrder: ["activityHistory"], targetCommerceOrderItem: ["variantSnapshot"],
  targetPaymentAttempt: ["providerResponse"], targetCourierProfile: ["availabilityHistory"],
  targetDeliveryBatchOrder: ["deliveryHistory"], targetReview: ["photoUrls"],
  targetNotification: ["metadata"],
};

const report = {
  migrationTimestamp: MIGRATION_TIMESTAMP.toISOString(),
  inserted: {},
  updated: {},
  manifest: [],
  archives: [],
  normalizations: {
    checkoutIdempotency: [
      { orderId: "71000000-0000-4000-8000-000000000001", original: "qa-finance-seed", normalized: "qa-finance-seed" },
      { orderId: "78000000-0000-4000-8000-000000000001", original: "qa-finance-seed", normalized: "qa-finance-seed:legacy:000000000001" },
      { orderId: "78000000-0000-4000-8000-000000000002", original: "qa-finance-seed", normalized: "qa-finance-seed:legacy:000000000002" },
      { orderId: "78000000-0000-4000-8000-000000000003", original: "qa-finance-seed", normalized: "qa-finance-seed:legacy:000000000003" },
      { orderId: "42000000-0000-4000-8000-000000000001", original: "qa-finance-seed", normalized: "qa-finance-seed" },
      { orderId: "42000000-0000-4000-8000-000000000002", original: "qa-finance-seed", normalized: "qa-finance-seed:legacy:000000000002" }
    ],
    inferredStockLifecycle: {
      commerceOrderItemId: "72000000-0000-4000-8000-000000000001",
      stockStatus: "CONSUMED",
      reservedAt: "2026-08-26T18:01:49.511Z",
      consumedAt: "2026-08-27T08:31:21.518Z",
      releasedAt: null,
      timestampSource: "CommerceOrder.createdAt/updatedAt"
    }
  },
  validations: {}
};
const upper = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[\s-]+/g, "_")
  .toUpperCase();
const orderFulfillmentStatus = (value) => {
  const normalized = upper(value);
  return normalized === "ON_DELIVERY" ? "IN_DELIVERY" : normalized;
};
const iso = (value) => value ? new Date(value).toISOString() : null;
const timeValue = (value) => new Date(`1970-01-01T${String(value).length === 5 ? `${value}:00` : value}.000Z`);
const asNumber = (value) => value == null ? null : Number(value);
const decimalPlaces = (value, scale) => value == null ? null : new Prisma.Decimal(value).toDecimalPlaces(scale);
const stable = (value) => {
  if (value === null || value === undefined || value === Prisma.DbNull) return null;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return Number(value);
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};
const keyOf = (row, keys) => keys.map((key) => stable(row[key])).join("|");
const comparable = (actual, expected) => stable(Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]])));
const createData = (delegateName, row) => {
  const result = { ...row };
  for (const field of jsonFields[delegateName] || []) if (result[field] == null) result[field] = Prisma.DbNull;
  return result;
};
const addManifest = (targetTable, rows, rule, sourceTable = null) => {
  for (const row of rows) report.manifest.push({ sourceTable: sourceTable || targetTable, sourceId: row.id || row.userId, targetTable, targetId: row.id || row.userId, rule, validation: "PASS" });
};

async function legacyCounts() {
  const tables = await prisma.$queryRawUnsafe("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME<>'_prisma_migrations' AND BINARY TABLE_NAME = BINARY LOWER(TABLE_NAME) ORDER BY TABLE_NAME");
  const counts = {};
  for (const { name } of tables) counts[name] = Number((await prisma.$queryRawUnsafe(`SELECT COUNT(*) n FROM \`${name}\``))[0].n);
  return counts;
}
async function sourceGate() {
  const counts = await legacyCounts();
  if (DISPOSABLE_MODE) {
    const database = (await prisma.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
    if (database !== "kucur_cutover_test") throw new Error(`DISPOSABLE BACKFILL REFUSED DATABASE ${database}`);
    if (Object.keys(counts).length !== 65) throw new Error(`DISPOSABLE LEGACY TABLE COUNT MISMATCH ${Object.keys(counts).length}`);
    const targets = await prisma.$queryRawUnsafe("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND BINARY TABLE_NAME IN ('User','UserRole','Session','PlatformSettings','Store','Product','ProductVariant','Cart','CartItem','CommerceOrder','CommerceOrderItem','PaymentAttempt','MerchantFee','CourierProfile','DeliveryBatch','DeliveryBatchOrder','Review','Conversation','Message','Notification')");
    if (Number(targets[0].n) !== 20) throw new Error("DISPOSABLE TARGET TABLE COUNT MISMATCH");
    report.sourceInventory = counts;
    return;
  }
  const differences = Object.entries(FROZEN_LEGACY_COUNTS).filter(([table, count]) => counts[table] !== count).map(([table, count]) => ({ table, expected: count, actual: counts[table] }));
  if (Object.keys(counts).length !== 65 || differences.length) {
    const recentSessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, userId: true, createdAt: true, expiresAt: true, revokedAt: true } });
    const recentAudits = await prisma.auditRecord.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { id: true, actorId: true, activityType: true, entityType: true, entityId: true, createdAt: true } });
    throw new Error(`SOURCE INVENTORY CHANGED ${JSON.stringify({ tableCount: Object.keys(counts).length, differences, recentSessions, recentAudits })}`);
  }
  const targets = await prisma.$queryRawUnsafe("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND BINARY TABLE_NAME IN ('User','UserRole','Session','PlatformSettings','Store','Product','ProductVariant','Cart','CartItem','CommerceOrder','CommerceOrderItem','PaymentAttempt','MerchantFee','CourierProfile','DeliveryBatch','DeliveryBatchOrder','Review','Conversation','Message','Notification')");
  if (Number(targets[0].n) !== 20) throw new Error("TARGET TABLE COUNT MISMATCH");
  report.sourceInventory = counts;
}
async function syncDomain(delegateName, rows, keys = ["id"]) {
  const outcome = await prisma.$transaction(async (tx) => {
    const delegate = tx[delegateName];
    const result = rows.length ? await delegate.createMany({ data: rows.map((row) => createData(delegateName, row)), skipDuplicates: true }) : { count: 0 };
    let actualRows = await delegate.findMany();
    let updated = 0;
    if (RUNTIME_SYNC) {
      const actualByKey = new Map(actualRows.map((row) => [keyOf(row, keys), row]));
      for (const expected of rows) {
        const actual = actualByKey.get(keyOf(expected, keys));
        if (!actual || JSON.stringify(stable(expected)) === JSON.stringify(comparable(actual, expected))) continue;
        const where = keys.length === 1 ? { [keys[0]]: expected[keys[0]] } : { [`${keys.join("_")}`]: Object.fromEntries(keys.map((key) => [key, expected[key]])) };
        const data = createData(delegateName, Object.fromEntries(Object.entries(expected).filter(([key]) => !keys.includes(key))));
        await delegate.update({ where, data }); updated += 1;
      }
      if (delegateName === "targetCartItem") {
        const ids = rows.map((row) => row.id); const removed = await delegate.deleteMany({ where: ids.length ? { id: { notIn: ids } } : {} }); updated += removed.count;
      }
      actualRows = await delegate.findMany();
    }
    if (actualRows.length !== rows.length) throw new Error(`BACKFILL DIVERGENCE ${delegateName}: expected ${rows.length}, actual ${actualRows.length}`);
    const actualByKey = new Map(actualRows.map((row) => [keyOf(row, keys), row]));
    for (const expected of rows) {
      const actual = actualByKey.get(keyOf(expected, keys));
      if (!actual || JSON.stringify(stable(expected)) !== JSON.stringify(comparable(actual, expected))) {
        const expectedStable = stable(expected);
        const actualStable = actual ? comparable(actual, expected) : null;
        const fieldDifferences = actualStable ? Object.keys(expectedStable).filter((field) => JSON.stringify(expectedStable[field]) !== JSON.stringify(actualStable[field])).map((field) => ({ field, expected: expectedStable[field], actual: actualStable[field] })) : [];
        throw new Error(`BACKFILL DIVERGENCE ${delegateName}:${keyOf(expected, keys)} ${JSON.stringify(fieldDifferences)}`);
      }
    }
    return { inserted: result.count, updated };
  }, { timeout: 30000 });
  report.inserted[delegateName] = outcome.inserted;
  report.updated[delegateName] = outcome.updated;
}

async function buildAndBackfill() {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  const targetUsers = users.map((row) => ({ id: row.id, email: row.email, passwordHash: row.passwordHash, fullName: row.fullName, phone: row.phone, language: row.language, theme: row.theme, isActive: row.status === "active", createdAt: row.createdAt, updatedAt: row.updatedAt }));
  await syncDomain("targetUser", targetUsers); addManifest("User", targetUsers, "PRESERVE_ID_STATUS_TO_IS_ACTIVE", "users");

  const roles = await prisma.userRole.findMany({ include: { role: true }, orderBy: [{ userId: "asc" }, { roleId: "asc" }] });
  const targetRoles = roles.map((row) => ({ userId: row.userId, role: upper(row.role.name), createdAt: MIGRATION_TIMESTAMP }));
  await syncDomain("targetUserRole", targetRoles, ["userId", "role"]); addManifest("UserRole", targetRoles, "ROLE_LOOKUP_TO_ENUM", "user_roles");

  const sessions = await prisma.session.findMany({ orderBy: { id: "asc" } });
  const targetSessions = sessions.map(({ id, userId, tokenHash, expiresAt, revokedAt, createdAt }) => ({ id, userId, tokenHash, expiresAt, revokedAt, createdAt }));
  await syncDomain("targetSession", targetSessions); addManifest("Session", targetSessions, "PRESERVE_SESSION", "sessions");

  const settings = await prisma.platformSettings.findMany();
  const targetSettings = settings.map((row) => ({ id: row.id, taxPercent: row.taxPercent, deliveryRatePerKm: row.deliveryRatePerKm, orderCutoffTime: timeValue(row.deliveryOrderCutoffTime), dispatchTime: timeValue(row.deliveryDispatchTime), maxDailyDeliveries: row.maxDailyDeliveries, initialStoreFeeAmount: row.initialStoreFeeAmount, installmentLateInterestPercent: row.installmentLateInterestPercent, adminFeeType: upper(row.adminFeeType), adminFeeValue: row.adminFeeValue, adminFeeCutoffDay: row.adminFeeCutoffDay, adminFeeGraceTime: timeValue(row.adminFeeGraceTime), suspendStoreForOutstandingAdminFee: row.suspendStoreForOutstandingAdminFee, voluntaryContributionEnabled: row.voluntaryContributionEnabled, updatedByUserId: null, createdAt: row.createdAt, updatedAt: row.updatedAt }));
  await syncDomain("targetPlatformSettings", targetSettings); addManifest("PlatformSettings", targetSettings, "ECOMMERCE_FIELDS_ONLY", "platform_settings");

  const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
  const retainedStores = stores.filter((row) => row.type === "product");
  const storeStatus = (row) => row.approvalStatus === "REJECTED" ? "REJECTED" : upper(row.status);
  const targetStores = retainedStores.map((row) => ({ id: row.id, merchantUserId: row.merchantUserId, name: row.name, description: row.description, phone: row.phone, imageUrl: row.image, address: row.address, latitude: row.latitude, longitude: row.longitude, status: storeStatus(row), rejectionReason: row.rejectionReason, reviewedByUserId: row.reviewedByUserId, reviewedAt: row.reviewedAt, createdAt: row.createdAt, updatedAt: row.updatedAt }));
  await syncDomain("targetStore", targetStores); addManifest("Store", targetStores, "PRODUCT_STORE_STATUS_NORMALIZATION", "stores");
  for (const row of stores.filter((row) => row.type !== "product")) report.archives.push({ sourceTable: "stores", sourceId: row.id, reason: `ARCHIVE_${upper(row.type)}`, validation: "PASS" });

  const products = await prisma.product.findMany({ include: { images: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } } }, orderBy: { id: "asc" } });
  const targetProducts = products.map((row) => ({ id: row.id, storeId: row.storeId, name: row.name, description: row.description, category: row.category, productType: row.hasVariants ? "VARIANT" : "SIMPLE", price: row.price, stock: row.stock, images: row.images.map(({ url, storageKey, position, isPrimary }) => ({ url, storageKey, position, isPrimary })), options: row.options.map(({ name, values, position }) => ({ name, values, position })), status: upper(row.status), createdAt: row.createdAt, updatedAt: row.updatedAt }));
  await syncDomain("targetProduct", targetProducts); addManifest("Product", targetProducts, "CHILDREN_TO_ORDERED_JSON", "products");

  const variants = await prisma.productVariant.findMany({ orderBy: { id: "asc" } });
  const targetVariants = variants.map((row) => ({ id: row.id, productId: row.productId, sku: row.sku, combinationKey: row.combinationKey, selectedOptions: row.options, price: row.price, stock: row.stock, isActive: row.status === "active", imageUrl: row.imageUrl, imageStorageKey: row.imageStorageKey, createdAt: MIGRATION_TIMESTAMP, updatedAt: MIGRATION_TIMESTAMP }));
  await syncDomain("targetProductVariant", targetVariants); addManifest("ProductVariant", targetVariants, "OPTIONS_TO_SELECTED_OPTIONS", "product_variants");

  const carts = await prisma.cart.findMany({ orderBy: { id: "asc" } });
  const targetCarts = carts.map(({ id, customerUserId, createdAt, updatedAt }) => ({ id, customerUserId, createdAt, updatedAt }));
  await syncDomain("targetCart", targetCarts); addManifest("Cart", targetCarts, "PRESERVE_CART", "carts");
  const cartItems = await prisma.cartItem.findMany({ orderBy: { id: "asc" } });
  const targetCartItems = cartItems.map(({ id, cartId, productId, productVariantId, quantity, createdAt, updatedAt }) => ({ id, cartId, productId, productVariantId, quantity, createdAt, updatedAt }));
  await syncDomain("targetCartItem", targetCartItems); addManifest("CartItem", targetCartItems, "PRESERVE_CART_ITEM", "cart_items");

  const assignments = await prisma.deliveryBatchOrder.findMany({ include: { batch: true } });
  const deliveryDateByOrder = new Map(assignments.map((row) => [row.commerceOrderId, row.batch.deliveryDate]));
  const orders = await prisma.commerceOrder.findMany({ include: { checkoutTransaction: true, activities: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, items: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const collisionRanks = new Map();
  for (const row of orders) {
    const key = `${row.customerUserId}|${row.checkoutTransaction.idempotencyKey}|${row.storeId}`;
    if (!collisionRanks.has(key)) collisionRanks.set(key, []);
    collisionRanks.get(key).push(row);
  }
  const normalizedKey = (row) => {
    const group = collisionRanks.get(`${row.customerUserId}|${row.checkoutTransaction.idempotencyKey}|${row.storeId}`);
    const rank = group.findIndex((item) => item.id === row.id);
    return group.length > 1 && rank > 0 ? `${row.checkoutTransaction.idempotencyKey.slice(0, 87)}:legacy:${row.id.slice(-12)}` : row.checkoutTransaction.idempotencyKey;
  };
  const itemlessCodes = new Set(["QA-FIN-1", "QA-FIN-2", "QA-DELIVERY-PLANNED", "QA-DELIVERY-DONE", "QA-DELIVERY-FAILED"]);
  const historyFor = (row) => {
    const history = row.activities.map((item) => ({ id: item.id, actorUserId: item.actorUserId, actorType: item.actorType, type: item.activityType, fromStatus: item.fromStatus, toStatus: item.toStatus, description: item.description, createdAt: iso(item.createdAt) }));
    const key = normalizedKey(row);
    if (key !== row.checkoutTransaction.idempotencyKey) history.push({ type: "MIGRATION_NORMALIZATION", reason: "LEGACY_IDEMPOTENCY_COLLISION", originalIdempotencyKey: row.checkoutTransaction.idempotencyKey, normalizedIdempotencyKey: key, sourceOrderId: row.id });
    if (itemlessCodes.has(row.orderCode)) history.push({ type: "MIGRATION_NORMALIZATION", reason: "LEGACY_ITEMLESS_QA_FIXTURE", sourceOrderCode: row.orderCode });
    if (row.id === "71000000-0000-4000-8000-000000000001") history.push({ type: "MIGRATION_NORMALIZATION", reason: "INFERRED_STOCK_LIFECYCLE", commerceOrderItemId: "72000000-0000-4000-8000-000000000001", stockStatus: "CONSUMED", timestampSource: "CommerceOrder.updatedAt" });
    return history;
  };
  const coords = (location) => location && typeof location === "object" ? { latitude: location.latitude ?? location.lat ?? null, longitude: location.longitude ?? location.lng ?? null } : { latitude: null, longitude: null };
  const targetOrders = orders.map((row) => { const location = coords(row.deliveryLocation); return ({ id: row.id, checkoutGroupId: row.checkoutTransactionId, checkoutIdempotencyKey: normalizedKey(row), storeId: row.storeId, customerUserId: row.customerUserId, orderCode: row.orderCode, fulfillmentStatus: orderFulfillmentStatus(row.fulfillmentStatus), paymentStatus: upper(row.paymentStatus), subtotal: row.productTotal, taxPercentSnapshot: 0, taxAmount: 0, deliveryFee: row.deliveryFee, courierTip: row.courierTip, grandTotal: row.totalAmount, deliveryRatePerKmSnapshot: row.deliveryRateSnapshot, deliveryDistanceKm: decimalPlaces(row.distanceKm, 2), deliveryDate: deliveryDateByOrder.get(row.id) || null, recipientName: row.recipientName, recipientPhone: row.recipientPhone, deliveryAddress: row.deliveryAddress, deliveryLatitude: location.latitude, deliveryLongitude: location.longitude, customerNote: null, activityHistory: historyFor(row), cancelReason: row.cancellationReason, cancelledAt: row.cancelledAt, completedAt: row.fulfillmentStatus === "completed" ? row.updatedAt : null, createdAt: row.createdAt, updatedAt: row.updatedAt }); });
  await syncDomain("targetCommerceOrder", targetOrders); addManifest("CommerceOrder", targetOrders, "CHECKOUT_ACTIVITY_STATUS_NORMALIZATION", "commerce_orders");

  const items = await prisma.commerceOrderItem.findMany({ include: { order: true }, orderBy: { id: "asc" } });
  const reservations = await prisma.stockReservation.findMany({ orderBy: [{ reservedAt: "asc" }, { id: "asc" }] });
  const reservationFor = (item) => reservations.find((row) => row.orderId === item.orderId && row.productId === item.productId && row.productVariantId === item.productVariantId);
  const targetItems = items.map((row) => { const reservation = reservationFor(row); const inferred = row.id === "72000000-0000-4000-8000-000000000001"; if (!reservation && !inferred) throw new Error(`BACKFILL DIVERGENCE missing lifecycle ${row.id}`); return ({ id: row.id, commerceOrderId: row.orderId, productId: row.productId, productVariantId: row.productVariantId, productNameSnapshot: row.productName, variantSnapshot: row.variantOptions, skuSnapshot: row.sku, imageSnapshot: row.imageUrl, storeNameSnapshot: row.storeName, unitPrice: row.unitPrice, quantity: row.quantity, subtotal: row.subtotal, stockStatus: inferred ? "CONSUMED" : upper(reservation.status), reservedAt: inferred ? new Date("2026-08-26T18:01:49.511Z") : reservation.reservedAt, consumedAt: inferred ? new Date("2026-08-27T08:31:21.518Z") : reservation.consumedAt, releasedAt: inferred ? null : reservation.releasedAt, createdAt: row.order.createdAt }); });
  await syncDomain("targetCommerceOrderItem", targetItems); addManifest("CommerceOrderItem", targetItems, "RESERVATION_TO_STOCK_LIFECYCLE", "commerce_order_items");

  const storeById = new Map(stores.map((row) => [row.id, row]));
  const initialFees = await prisma.storeInitialFee.findMany({ include: { installments: true }, orderBy: { id: "asc" } });
  const installments = await prisma.storeInstallment.findMany({ include: { initialFee: true }, orderBy: { id: "asc" } });
  const penalties = await prisma.storeInstallmentPenalty.findMany({ include: { installment: { include: { initialFee: true } } }, orderBy: { id: "asc" } });
  const adminFees = await prisma.adminFeeObligation.findMany({ include: { platformTransaction: true }, orderBy: { id: "asc" } });
  const contributions = await prisma.voluntaryContribution.findMany({ orderBy: { id: "asc" } });
  const merchantFees = [
    ...initialFees.map((row) => ({ id: row.id, merchantUserId: storeById.get(row.storeId).merchantUserId, storeId: row.storeId, commerceOrderId: null, parentFeeId: null, feeType: "INITIAL_STORE_FEE", calculationType: "FIXED", rateSnapshot: null, baseAmountSnapshot: null, amount: row.initialAmountSnapshot, installmentNumber: null, installmentCount: row.installmentCount, dueAt: null, status: upper(row.status), paymentMethod: null, provider: null, providerReference: null, paidAt: row.completedAt, createdAt: row.createdAt, updatedAt: row.completedAt || row.createdAt })),
    ...installments.map((row) => ({ id: row.id, merchantUserId: storeById.get(row.initialFee.storeId).merchantUserId, storeId: row.initialFee.storeId, commerceOrderId: null, parentFeeId: row.storeInitialFeeId, feeType: "INITIAL_STORE_INSTALLMENT", calculationType: "FIXED", rateSnapshot: null, baseAmountSnapshot: null, amount: row.principalAmount, installmentNumber: row.installmentNumber, installmentCount: row.initialFee.installmentCount, dueAt: row.dueAt, status: upper(row.status), paymentMethod: null, provider: null, providerReference: null, paidAt: row.paidAt, createdAt: row.createdAt, updatedAt: row.updatedAt })),
    ...penalties.map((row) => ({ id: row.id, merchantUserId: storeById.get(row.installment.initialFee.storeId).merchantUserId, storeId: row.installment.initialFee.storeId, commerceOrderId: null, parentFeeId: row.installmentId, feeType: "LATE_PENALTY", calculationType: "PERCENTAGE", rateSnapshot: row.percentageSnapshot, baseAmountSnapshot: row.baseOutstandingAmount, amount: row.penaltyAmount, installmentNumber: null, installmentCount: null, dueAt: null, status: row.installment.status === "PAID" ? "PAID" : "OVERDUE", paymentMethod: null, provider: null, providerReference: null, paidAt: row.installment.status === "PAID" ? row.installment.paidAt : null, createdAt: row.appliedAt, updatedAt: row.appliedAt })),
    ...adminFees.map((row) => ({ id: row.id, merchantUserId: storeById.get(row.storeId).merchantUserId, storeId: row.storeId, commerceOrderId: row.platformTransaction.commerceOrderId, parentFeeId: null, feeType: "ADMIN_FEE", calculationType: upper(row.feeTypeSnapshot), rateSnapshot: row.feeValueSnapshot, baseAmountSnapshot: row.baseTransactionAmount, amount: row.feeAmount, installmentNumber: null, installmentCount: null, dueAt: row.cutoffAt, status: upper(row.status), paymentMethod: null, provider: null, providerReference: null, paidAt: row.paidAt, createdAt: row.createdAt, updatedAt: row.paidAt || row.createdAt })),
    ...contributions.map((row) => ({ id: row.id, merchantUserId: row.merchantUserId, storeId: null, commerceOrderId: null, parentFeeId: null, feeType: "VOLUNTARY_CONTRIBUTION", calculationType: "FIXED", rateSnapshot: null, baseAmountSnapshot: null, amount: row.amount, installmentNumber: null, installmentCount: null, dueAt: null, status: upper(row.paymentStatus), paymentMethod: row.paymentMethod, provider: row.provider, providerReference: row.providerReference, paidAt: row.paidAt, createdAt: row.createdAt, updatedAt: row.paidAt || row.createdAt })),
  ];
  await syncDomain("targetMerchantFee", merchantFees); addManifest("MerchantFee", merchantFees, "FINANCE_TABLES_TO_HIERARCHY", "legacy_finance");

  const paymentAttempts = await prisma.paymentAttempt.findMany({ include: { platformTransaction: true }, orderBy: { id: "asc" } });
  const installmentPayments = await prisma.storeInstallmentPayment.findMany({ orderBy: { id: "asc" } });
  for (const row of paymentAttempts.filter((row) => !row.orderId)) report.archives.push({ sourceTable: "payment_attempts", sourceId: row.id, reason: `ARCHIVE_${row.platformTransaction.type}`, validation: "PASS" });
  const targetPayments = [
    ...paymentAttempts.filter((row) => row.orderId).map((row) => ({ id: row.id, commerceOrderId: row.orderId, merchantFeeId: null, provider: upper(row.provider), method: row.paymentMethod, providerReference: row.providerReference, amount: row.amount, status: upper(row.status), providerResponse: null, paidAt: row.paidAt, expiredAt: row.expiresAt, createdAt: row.createdAt, updatedAt: row.updatedAt })),
    ...installmentPayments.map((row) => ({ id: row.id, commerceOrderId: null, merchantFeeId: row.installmentId, provider: upper(row.provider), method: row.paymentMethod, providerReference: row.providerReference, amount: row.amount, status: upper(row.paymentStatus), providerResponse: null, paidAt: row.paidAt, expiredAt: null, createdAt: row.createdAt, updatedAt: row.paidAt || row.createdAt })),
  ];
  await syncDomain("targetPaymentAttempt", targetPayments); addManifest("PaymentAttempt", targetPayments, "ORDER_OR_MERCHANT_FEE_XOR", "payment_sources");

  const profiles = await prisma.courierProfile.findMany({ orderBy: { userId: "asc" } });
  const availability = await prisma.courierAvailability.findMany({ orderBy: [{ startAt: "asc" }, { id: "asc" }] });
  const targetProfiles = profiles.map((row) => { const history = availability.filter((item) => item.courierUserId === row.userId); const current = [...history].reverse().find((item) => item.startAt <= MIGRATION_TIMESTAMP && (!item.endAt || item.endAt > MIGRATION_TIMESTAMP)); return ({ userId: row.userId, maxActiveDeliveries: row.maxActiveDeliveries, availabilityStatus: current ? "UNAVAILABLE" : "AVAILABLE", unavailableStartAt: current?.startAt || null, unavailableEndAt: current?.endAt || null, unavailableReason: current?.reason || null, availabilityHistory: history.map((item) => ({ id: item.id, startAt: iso(item.startAt), endAt: iso(item.endAt), reason: item.reason })), isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt }); });
  await syncDomain("targetCourierProfile", targetProfiles, ["userId"]); addManifest("CourierProfile", targetProfiles, "AVAILABILITY_TO_SCALARS_AND_HISTORY", "courier_profiles");

  const batches = await prisma.deliveryBatch.findMany({ orderBy: { id: "asc" } });
  const targetBatches = batches.map(({ id, courierUserId, deliveryDate, cutoffAt, dispatchAt, status, startedAt, completedAt, createdAt, updatedAt }) => ({ id, courierUserId, deliveryDate, cutoffAt, dispatchAt, status, startedAt, completedAt, createdAt, updatedAt }));
  await syncDomain("targetDeliveryBatch", targetBatches); addManifest("DeliveryBatch", targetBatches, "PRESERVE_BATCH", "delivery_batches");
  const proofs = await prisma.deliveryProof.findMany(); const proofByOrder = new Map(proofs.map((row) => [row.commerceOrderId, row]));
  const confirmations = await prisma.pickupConfirmation.findMany({ orderBy: [{ confirmedAt: "asc" }, { id: "asc" }] });
  const activities = await prisma.deliveryActivity.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const deliveryRows = await prisma.deliveryBatchOrder.findMany({ orderBy: { id: "asc" } });
  const targetDeliveryRows = deliveryRows.map((row) => { const proof = proofByOrder.get(row.commerceOrderId); const confirmation = confirmations.find((item) => item.commerceOrderId === row.commerceOrderId); const history = activities.filter((item) => item.commerceOrderId === row.commerceOrderId); const at = (pattern) => history.find((item) => pattern.test(item.status))?.createdAt || null; return ({ id: row.id, deliveryBatchId: row.deliveryBatchId, commerceOrderId: row.commerceOrderId, pickupSequence: row.pickupSequence, deliverySequence: row.deliverySequence, status: row.status, merchantReady: confirmation?.isReady ?? null, merchantReadyNote: confirmation?.note || null, merchantConfirmedAt: confirmation?.confirmedAt || null, pickedUpAt: at(/PICKED_UP/i), outForDeliveryAt: at(/OUT_FOR_DELIVERY/i), proofPhotoUrl: proof?.photoUrl || null, proofRecipientName: proof?.recipientName || null, proofNote: proof?.note || null, deliveredAt: proof?.deliveredAt || at(/DELIVERED/i), failureReason: row.status === "FAILED" ? [...history].reverse().find((item) => /FAILED/i.test(item.status))?.note || null : null, deliveryHistory: history.map((item) => ({ id: item.id, courierUserId: item.courierUserId, status: item.status, note: item.note, metadata: item.metadata, createdAt: iso(item.createdAt) })), createdAt: row.createdAt, updatedAt: row.updatedAt }); });
  await syncDomain("targetDeliveryBatchOrder", targetDeliveryRows); addManifest("DeliveryBatchOrder", targetDeliveryRows, "PROOF_PICKUP_ACTIVITY_FLATTEN", "delivery_batch_orders");

  const reviews = await prisma.review.findMany({ include: { photos: { orderBy: { position: "asc" } }, reply: true, productTarget: true, tourismTarget: true, liveInTarget: true }, orderBy: { id: "asc" } });
  for (const row of reviews.filter((item) => !item.productTarget)) report.archives.push({ sourceTable: "reviews", sourceId: row.id, reason: itemDomain(row), validation: "PASS" });
  function itemDomain(row) { return row.tourismTarget ? "ARCHIVE_TOURISM" : "ARCHIVE_LIVE_IN"; }
  const productReviews = reviews.filter((row) => row.productTarget);
  const targetReviews = productReviews.map((row) => ({ id: row.id, commerceOrderItemId: row.productTarget.commerceOrderItemId, customerUserId: row.customerUserId, storeId: row.storeId, rating: row.rating, comment: row.comment, photoUrls: row.photos.map((item) => item.url), merchantReply: row.reply?.text || null, repliedByUserId: row.reply?.authorUserId || null, repliedAt: row.reply?.updatedAt || null, visibilityStatus: row.visibility, moderationReason: row.moderationReason, moderatedByUserId: row.moderatedByUserId, moderatedAt: row.moderatedAt, createdAt: row.createdAt, updatedAt: row.updatedAt }));
  await syncDomain("targetReview", targetReviews); addManifest("Review", targetReviews, "PRODUCT_REVIEW_CHILDREN_FLATTEN", "reviews");

  const conversations = await prisma.conversation.findMany({ include: { participants: { orderBy: { joinedAt: "asc" } }, context: true }, orderBy: { id: "asc" } });
  const targetConversations = conversations.map((row) => { const active = row.participants.filter((item) => !item.leftAt); if (active.length !== 2) throw new Error(`BACKFILL DIVERGENCE conversation participants ${row.id}`); const requester = row.type === "SUPPORT" ? active.find((item) => upper(item.roleSnapshot) !== "ADMIN") : active.find((item) => upper(item.roleSnapshot) === "CUSTOMER"); const counterpart = active.find((item) => item.userId !== requester.userId); return ({ id: row.id, type: row.type, openKey: row.openKey, subject: row.subject, requesterUserId: requester.userId, counterpartUserId: counterpart.userId, storeId: row.context?.storeId || null, productId: row.context?.productId || null, commerceOrderId: row.context?.commerceOrderId || null, status: row.status, closedByUserId: row.closedByUserId, closedAt: row.closedAt, createdAt: row.createdAt, updatedAt: row.updatedAt }); });
  await syncDomain("targetConversation", targetConversations); addManifest("Conversation", targetConversations, "PARTICIPANTS_CONTEXT_FLATTEN", "conversations");

  const messages = await prisma.message.findMany({ include: { reads: true, conversation: { include: { participants: true } } }, orderBy: { id: "asc" } });
  const targetMessages = messages.map((row) => { const recipientIds = row.conversation.participants.filter((item) => !item.leftAt && item.userId !== row.senderUserId).map((item) => item.userId); if (recipientIds.length !== 1) throw new Error(`BACKFILL DIVERGENCE message recipients ${row.id}`); const read = row.reads.filter((item) => recipientIds.includes(item.userId)).sort((a, b) => a.readAt - b.readAt)[0]; return ({ id: row.id, conversationId: row.conversationId, senderUserId: row.senderUserId, message: row.message, attachmentUrl: row.attachmentUrl, readAt: read?.readAt || null, createdAt: row.createdAt }); });
  await syncDomain("targetMessage", targetMessages); addManifest("Message", targetMessages, "RECIPIENT_READ_TO_READ_AT", "messages");

  const notifications = await prisma.notification.findMany({ orderBy: { id: "asc" } });
  const archivedNotificationTypes = new Set(["TOURISM_BOOKING", "TOURISM_GROUP_REQUEST", "LIVE_IN_BOOKING"]);
  for (const row of notifications.filter((item) => archivedNotificationTypes.has(item.entityType))) report.archives.push({ sourceTable: "notifications", sourceId: row.id, reason: `ARCHIVE_${row.entityType}`, validation: "PASS" });
  const targetNotifications = notifications.filter((row) => !archivedNotificationTypes.has(row.entityType)).map((row) => ({ id: row.id, userId: row.userId, type: row.type, title: row.title, body: row.body, entityType: row.entityType === "ADMIN_FEE_OBLIGATION" ? "MERCHANT_FEE" : row.entityType, entityId: row.entityId, dedupeKey: row.dedupeKey, metadata: row.metadata, readAt: row.readAt, expiresAt: row.expiresAt, createdAt: row.createdAt }));
  await syncDomain("targetNotification", targetNotifications); addManifest("Notification", targetNotifications, "ARCHIVE_DOMAIN_AND_NORMALIZE_FEE_ENTITY", "notifications");
}

async function validateTarget() {
  const counts = {};
  for (const [delegate, expected] of Object.entries(EXPECTED_COUNTS)) { counts[delegate] = await prisma[delegate].count(); if (!DISPOSABLE_MODE && counts[delegate] !== expected) throw new Error(`TARGET COUNT MISMATCH ${delegate}: ${counts[delegate]} != ${expected}`); }
  const duplicateOrders = await prisma.$queryRawUnsafe("SELECT COUNT(*) n FROM (SELECT customerUserId,checkoutIdempotencyKey,storeId FROM `CommerceOrder` GROUP BY customerUserId,checkoutIdempotencyKey,storeId HAVING COUNT(*)>1)x");
  const xor = await prisma.$queryRawUnsafe("SELECT COUNT(*) n FROM `PaymentAttempt` WHERE (commerceOrderId IS NULL)=(merchantFeeId IS NULL)");
  const cycles = await prisma.$queryRawUnsafe("WITH RECURSIVE fee_path AS (SELECT id,parentFeeId,id root,0 depth FROM `MerchantFee` UNION ALL SELECT f.id,f.parentFeeId,p.root,p.depth+1 FROM `MerchantFee` f JOIN fee_path p ON f.id=p.parentFeeId WHERE p.depth<100) SELECT COUNT(*) n FROM fee_path WHERE id=parentFeeId OR depth>=100");
  const finance = await prisma.$queryRawUnsafe("SELECT SUM(amount) total FROM `MerchantFee` WHERE feeType IN ('INITIAL_STORE_INSTALLMENT','LATE_PENALTY','ADMIN_FEE','VOLUNTARY_CONTRIBUTION')");
  const stock = await prisma.$queryRawUnsafe("SELECT (SELECT SUM(stock) FROM `Product` WHERE stock IS NOT NULL) productStock,(SELECT SUM(stock) FROM `ProductVariant`) variantStock,(SELECT COALESCE(SUM(quantity),0) FROM `CommerceOrderItem` WHERE stockStatus='RESERVED') reserved,(SELECT SUM(quantity) FROM `CommerceOrderItem` WHERE stockStatus='CONSUMED') consumed");
  const invalidNotificationFees = await prisma.$queryRawUnsafe("SELECT COUNT(*) n FROM `Notification` n LEFT JOIN `MerchantFee` f ON f.id=n.entityId WHERE n.entityType='MERCHANT_FEE' AND f.id IS NULL");
  report.validations = { counts, duplicateOrderScopes: Number(duplicateOrders[0].n), paymentXorViolations: Number(xor[0].n), merchantFeeCycles: Number(cycles[0].n), collectibleTotal: Number(finance[0].total), stock: stable(stock[0]), invalidNotificationFees: Number(invalidNotificationFees[0].n) };
  const structuralFailure = report.validations.duplicateOrderScopes || report.validations.paymentXorViolations || report.validations.merchantFeeCycles || report.validations.invalidNotificationFees;
  const historicalFailure = !DISPOSABLE_MODE && (report.validations.collectibleTotal !== 325981.8 || report.validations.stock.productStock !== 35 || report.validations.stock.variantStock !== 13 || report.validations.stock.reserved !== 0 || report.validations.stock.consumed !== 5);
  if (structuralFailure || historicalFailure) throw new Error(`POST BACKFILL INTEGRITY FAILURE ${JSON.stringify(report.validations)}`);
}

async function main() {
  await sourceGate();
  await buildAndBackfill();
  await validateTarget();
  report.legacyAfter = await legacyCounts();
  const baseline = DISPOSABLE_MODE ? report.sourceInventory : FROZEN_LEGACY_COUNTS;
  const changed = Object.entries(baseline).filter(([table, count]) => report.legacyAfter[table] !== count);
  if (changed.length) throw new Error(`LEGACY ROW COUNTS CHANGED ${JSON.stringify(changed)}`);
  console.log(`BACKFILL_RESULT_JSON=${JSON.stringify(report)}`);
}

async function synchronizeFinalFromLegacy() {
  if (!RUNTIME_SYNC) throw new Error("Runtime synchronization requires FINAL_BACKFILL_RUNTIME_SYNC=true");
  const database = (await prisma.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
  if (process.env.NODE_ENV === "production") throw new Error("Runtime final shadow synchronization is forbidden in production");
  if (!["kucur", "kucur_cutover_test"].includes(database)) throw new Error(`Runtime synchronization refused database ${database}`);
  report.inserted = {}; report.updated = {}; report.manifest = []; report.archives = [];
  await buildAndBackfill();
  return { database, inserted: { ...report.inserted }, updated: { ...report.updated } };
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

module.exports = { synchronizeFinalFromLegacy };
