const { Prisma } = require("@prisma/client");
const { createHash, randomUUID } = require("node:crypto");
const { getPrisma } = require("../config/prisma");
const { createFinalFinanceRepository } = require("./finalFinanceRepository");

const iso = (value) => value instanceof Date ? value.toISOString() : value ?? null;
const number = (value) => value == null ? value : Number(value);
const lower = (value) => value == null ? value : String(value).toLowerCase();
const apiStatus = (value) => lower(value).replaceAll("_", "-");
const dbStatus = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toUpperCase();
const json = (value, fallback) => value == null ? fallback : value;
const compatibilityId = (key) => { const hex = createHash("sha256").update(key).digest("hex").slice(0, 32); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`; };

const mapUser = (row) => row && ({
  id: row.id, fullName: row.fullName, email: row.email, phone: row.phone, avatarUrl: row.avatarUrl || null, addresses: Array.isArray(row.addresses) ? row.addresses : [],
  passwordHash: row.passwordHash, status: row.isActive ? "active" : "inactive",
  passwordChangedAt: iso(row.passwordChangedAt), passwordResetRequired: row.passwordResetRequired,
  language: row.language, theme: row.theme, roles: (row.roles || []).map((item) => lower(item.role)),
  createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
});
const mapStore = (row) => row && ({
  id: row.id, merchantUserId: row.merchantUserId, name: row.name, type: "product",
  description: row.description || "", phone: row.phone, image: row.imageUrl,
  status: apiStatus(row.status),
  approvalStatus: row.status === "REJECTED" ? "REJECTED" : row.status === "PENDING" || !row.reviewedAt ? "PENDING" : "APPROVED",
  rejectionReason: row.rejectionReason, reviewedAt: iso(row.reviewedAt), reviewedByUserId: row.reviewedByUserId,
  merchant: row.merchant ? { id: row.merchant.id, fullName: row.merchant.fullName, email: row.merchant.email, phone: row.merchant.phone } : undefined,
  statusHistory: [],
  location: { source: "local", locationRef: null, label: null, address: row.address, latitude: number(row.latitude), longitude: number(row.longitude) },
  createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
});
const mapVariant = (row) => row && ({
  id: row.id, sku: row.sku, combinationKey: row.combinationKey, options: json(row.selectedOptions, {}),
  price: number(row.price), stock: row.stock, status: row.isActive ? "active" : "inactive",
  image: row.imageUrl ? { url: row.imageUrl, storageKey: row.imageStorageKey } : null,
});
const mapProduct = (row) => {
  if (!row) return null;
  const images = json(row.images, []);
  const options = json(row.options, []);
  return {
    id: row.id, storeId: row.storeId, name: row.name, description: row.description || "", category: row.category,
    status: lower(row.status), hasVariants: row.productType === "VARIANT", price: number(row.price), stock: row.stock,
    image: images.find((item) => item.isPrimary)?.url || images[0]?.url || "",
    images: images.map((item, index) => ({ id: item.id || `json:${row.id}:${index}`, ...item })),
    variantGroups: options.map((item, index) => ({ id: item.id || `json:${row.id}:${index}`, name: item.name, options: item.values || item.options || [] })),
    variants: (row.variants || []).map(mapVariant), store: row.store ? mapStore(row.store) : undefined,
    createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
};
const productInclude = { store: true, variants: { orderBy: { sku: "asc" } } };
const mapOrderItem = (row) => ({
  id: row.id, orderId: row.commerceOrderId, productId: row.productId, productVariantId: row.productVariantId,
  productName: row.productNameSnapshot, productNameSnapshot: row.productNameSnapshot,
  variantSnapshot: json(row.variantSnapshot, null), sku: row.skuSnapshot, image: row.imageSnapshot,
  storeName: row.storeNameSnapshot, unitPrice: number(row.unitPrice), quantity: row.quantity,
  subtotal: number(row.subtotal), createdAt: iso(row.createdAt), stockStatus: lower(row.stockStatus),
  reservedAt: iso(row.reservedAt), consumedAt: iso(row.consumedAt), releasedAt: iso(row.releasedAt),
});
const orderInclude = { store: true, items: true, paymentAttempts: true, deliveryAssignments: { include: { batch: { include: { courier: { include: { user: true } } } } }, orderBy: { createdAt: "desc" } } };
const mapOrder = (row) => row && ({
  id: row.id, checkoutTransactionId: row.checkoutGroupId, checkoutGroupId: row.checkoutGroupId,
  idempotencyKey: row.checkoutIdempotencyKey, checkoutIdempotencyKey: row.checkoutIdempotencyKey,
  storeId: row.storeId, customerUserId: row.customerUserId, orderCode: row.orderCode, orderNumber: row.orderCode,
  storeName: row.store?.name, store: row.store ? mapStore(row.store) : undefined,
  fulfillmentStatus: row.fulfillmentStatus === "IN_DELIVERY" ? "on-delivery" : apiStatus(row.fulfillmentStatus), paymentStatus: lower(row.paymentStatus),
  paymentMethod: row.paymentAttempts?.[0]?.method || null,
  productTotal: number(row.subtotal), subtotal: number(row.subtotal), taxPercentSnapshot: number(row.taxPercentSnapshot), taxAmount: number(row.taxAmount),
  deliveryFee: number(row.deliveryFee), courierTip: number(row.courierTip), totalAmount: number(row.grandTotal), grandTotal: number(row.grandTotal),
  deliveryRateSnapshot: number(row.deliveryRatePerKmSnapshot), distanceKm: number(row.deliveryDistanceKm), deliveryDate: iso(row.deliveryDate),
  recipientName: row.recipientName, recipientPhone: row.recipientPhone, deliveryAddress: row.deliveryAddress,
  deliveryLocation: row.deliveryLatitude == null ? null : { latitude: number(row.deliveryLatitude), longitude: number(row.deliveryLongitude) },
  customerNote: row.customerNote, cancellationReason: row.cancelReason, cancelledAt: iso(row.cancelledAt), completedAt: iso(row.completedAt),
  items: (row.items || []).map(mapOrderItem), activities: json(row.activityHistory, []).filter((item) => item.type !== "MIGRATION_NORMALIZATION"),
  reservations: (row.items || []).map((item) => ({ id: item.id, commerceOrderId: item.commerceOrderId, commerceOrderItemId: item.id, productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, status: lower(item.stockStatus), reservedAt: iso(item.reservedAt), consumedAt: iso(item.consumedAt), releasedAt: iso(item.releasedAt), expiresAt: null })),
  paymentAttempts: (row.paymentAttempts || []).map(mapPayment),
  deliveryBatchOrders: (row.deliveryAssignments || []).map((item) => ({ id: item.id, deliveryBatchId: item.deliveryBatchId, commerceOrderId: item.commerceOrderId, pickupSequence: item.pickupSequence, deliverySequence: item.deliverySequence, status: item.status, createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt), batch: item.batch ? { id: item.batch.id, deliveryDate: iso(item.batch.deliveryDate), cutoffAt: iso(item.batch.cutoffAt), dispatchAt: iso(item.batch.dispatchAt), status: item.batch.status, startedAt: iso(item.batch.startedAt), completedAt: iso(item.batch.completedAt), courier: item.batch.courier?.user ? { id: item.batch.courier.user.id, fullName: item.batch.courier.user.fullName } : undefined } : undefined })),
  pickupConfirmations: (row.deliveryAssignments || []).filter((item) => item.merchantConfirmedAt).map((item) => ({ id: item.id, isReady: item.merchantReady, confirmedAt: iso(item.merchantConfirmedAt) })),
  deliveryProof: (row.deliveryAssignments || []).find((item) => item.proofPhotoUrl) ? (() => { const item = row.deliveryAssignments.find((entry) => entry.proofPhotoUrl); return { id: item.id, photoUrl: item.proofPhotoUrl, recipientName: item.proofRecipientName, note: item.proofNote, deliveredAt: iso(item.deliveredAt) }; })() : null,
  deliveryActivities: (row.deliveryAssignments || []).flatMap((item) => json(item.deliveryHistory, [])).map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt })),
  createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
});
function mapPayment(row) { return row && ({ ...row, provider: lower(row.provider), status: lower(row.status), amount: number(row.amount), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), paidAt: iso(row.paidAt), expiresAt: iso(row.expiredAt) }); }
const mapDeep = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(mapDeep);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapDeep(item)]));
  return value;
};
const mapNotification = (row) => row && mapDeep(row);
// Pesan status pesanan untuk pembeli. Tahap diambil/diantar/sampai dikirim oleh layanan pengiriman, jadi tidak diulang di sini.
const ORDER_STATUS_NOTICE = {
  confirmed: ["Pesanan diterima penjual", (code) => `Pesanan #${code} sudah diterima penjual dan akan segera dikemas.`],
  processing: ["Pesanan sedang dikemas", (code) => `Penjual sedang mengemas pesanan #${code}.`],
  "ready-for-pickup": ["Pesanan siap diambil kurir", (code) => `Pesanan #${code} sudah siap dan akan diambil kurir.`],
  cancelled: ["Pesanan dibatalkan", (code, reason) => `Pesanan #${code} dibatalkan${reason ? `. Alasan: ${reason}` : "."}`],
  completed: ["Pesanan selesai", (code) => `Pesanan #${code} selesai. Yuk beri ulasan untuk produknya.`],
};
const mapMessage = (row) => row && ({ ...mapDeep(row), sender: row.sender ? mapUser({ ...row.sender, roles: [] }) : undefined, reads: row.readAt ? [{ userId: null, readAt: iso(row.readAt) }] : [] });
const mapConversation = (row) => row && ({
  ...mapDeep(row), type: row.type, status: row.status,
  participants: [row.requester, row.counterpart].filter(Boolean).map((user, index) => ({ userId: user.id, roleSnapshot: index === 0 ? "CUSTOMER" : (row.type === "SUPPORT" ? "ADMIN" : "MERCHANT"), user: mapUser({ ...user, roles: [] }), leftAt: null })),
  context: { storeId: row.storeId, productId: row.productId, commerceOrderId: row.commerceOrderId, store: row.store ? mapStore(row.store) : null, product: row.product ? mapProduct({ ...row.product, variants: [] }) : null, commerceOrder: row.order ? mapOrder({ ...row.order, items: [], paymentAttempts: [], deliveryAssignments: [] }) : null },
  messages: (row.messages || []).map((message) => { const mapped = mapMessage(message); const recipientUserId = message.senderUserId === row.requesterUserId ? row.counterpartUserId : row.requesterUserId; return { ...mapped, reads: message.readAt ? [{ userId: recipientUserId, readAt: iso(message.readAt) }] : [] }; }), lastMessageAt: row.messages?.at(-1)?.createdAt || row.updatedAt,
});
const conversationInclude = { requester: true, counterpart: true, store: true, product: true, order: true, messages: { include: { sender: true }, orderBy: { createdAt: "asc" } }, closedBy: true };

function createFinalPrismaRepository(client = getPrisma()) {
  const checkoutKeys = new Map();
  const repository = {
    users: {
      findById: async (id) => mapUser(await client.targetUser.findUnique({ where: { id }, include: { roles: true } })),
      findByEmail: async (email) => mapUser(await client.targetUser.findUnique({ where: { email }, include: { roles: true } })),
      findFirstByRole: async (role) => mapUser(await client.targetUser.findFirst({ where: { isActive: true, roles: { some: { role: dbStatus(role) } } }, include: { roles: true }, orderBy: { createdAt: "asc" } })),
      list: async () => (await client.targetUser.findMany({ include: { roles: true }, orderBy: { createdAt: "desc" } })).map(mapUser),
      create: async (input) => mapUser(await client.targetUser.create({ data: { id: input.id || randomUUID(), fullName: input.fullName, email: input.email, phone: input.phone, passwordHash: input.passwordHash, passwordChangedAt: input.passwordChangedAt, passwordResetRequired: Boolean(input.passwordResetRequired), ...(input.addresses ? { addresses: input.addresses } : {}), isActive: input.status !== "inactive", language: input.language || "id", theme: input.theme || "light", roles: { create: input.roles.map((role) => ({ role: dbStatus(role) })) } }, include: { roles: true } })),
      update: async (id, changes) => mapUser(await client.targetUser.update({ where: { id }, data: { ...(changes.status !== undefined ? { isActive: changes.status === "active" } : {}), ...(changes.fullName !== undefined ? { fullName: changes.fullName } : {}), ...(changes.email !== undefined ? { email: changes.email } : {}), ...(changes.phone !== undefined ? { phone: changes.phone } : {}), ...(changes.avatarUrl !== undefined ? { avatarUrl: changes.avatarUrl } : {}), ...(changes.addresses !== undefined ? { addresses: changes.addresses } : {}), ...(changes.passwordHash !== undefined ? { passwordHash: changes.passwordHash } : {}), ...(changes.passwordChangedAt !== undefined ? { passwordChangedAt: changes.passwordChangedAt } : {}), ...(changes.passwordResetRequired !== undefined ? { passwordResetRequired: changes.passwordResetRequired } : {}), ...(changes.language !== undefined ? { language: changes.language } : {}), ...(changes.theme !== undefined ? { theme: changes.theme } : {}) }, include: { roles: true } })),
      addRole: async (userId, role) => {
        const normalizedRole = dbStatus(role);
        await client.targetUserRole.upsert({ where: { userId_role: { userId, role: normalizedRole } }, update: {}, create: { userId, role: normalizedRole } });
        return mapUser(await client.targetUser.findUnique({ where: { id: userId }, include: { roles: true } }));
      },
    },
    sessions: {
      create: async ({ id, tokenHash, userId, expiresAt }) => client.targetSession.create({ data: { id: id || randomUUID(), tokenHash, userId, expiresAt } }),
      findActiveByTokenHash: async (tokenHash) => { const row = await client.targetSession.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { include: { roles: true } } } }); return row ? { id: row.id, tokenHash: row.tokenHash, user: mapUser(row.user), expiresAt: iso(row.expiresAt) } : null; },
      revokeByTokenHash: async (tokenHash) => client.targetSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }),
      revokeAllForUser: async (userId) => client.targetSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    },
    stores: {
      list: async () => (await client.targetStore.findMany({ orderBy: { createdAt: "asc" } })).map(mapStore),
      listApplications: async () => (await client.targetStore.findMany({ include: { merchant: true }, orderBy: { createdAt: "desc" } })).map(mapStore),
      findApplication: async (id) => mapStore(await client.targetStore.findUnique({ where: { id }, include: { merchant: true } })),
      findById: async (id) => mapStore(await client.targetStore.findUnique({ where: { id } })),
      create: async (input) => mapStore(await client.targetStore.create({ data: { id: input.id || randomUUID(), merchantUserId: input.merchantUserId, name: input.name, description: input.description || null, phone: input.phone || null, imageUrl: input.image || null, status: input.approvalStatus === "PENDING" ? "PENDING" : dbStatus(input.status || "pending"), address: input.location?.address || null, latitude: input.location?.latitude ?? null, longitude: input.location?.longitude ?? null } })),
      update: async (id, changes) => mapStore(await client.targetStore.update({ where: { id }, data: { ...(changes.name !== undefined ? { name: changes.name } : {}), ...(changes.description !== undefined ? { description: changes.description } : {}), ...(changes.phone !== undefined ? { phone: changes.phone } : {}), ...(changes.image !== undefined ? { imageUrl: changes.image } : {}), ...(changes.status !== undefined ? { status: dbStatus(changes.status) } : {}), ...(changes.approvalStatus === "APPROVED" ? { status: "PENDING_INITIAL_PAYMENT" } : {}), ...(changes.approvalStatus === "REJECTED" ? { status: "REJECTED" } : {}), ...(changes.rejectionReason !== undefined ? { rejectionReason: changes.rejectionReason } : {}), ...(changes.reviewedAt !== undefined ? { reviewedAt: changes.reviewedAt } : {}), ...(changes.reviewedByUserId !== undefined ? { reviewedByUserId: changes.reviewedByUserId } : {}), ...(changes.location !== undefined ? { address: changes.location.address, latitude: changes.location.latitude, longitude: changes.location.longitude } : {}) } })),
    },
    products: {
      list: async () => (await client.targetProduct.findMany({ include: productInclude, orderBy: { createdAt: "asc" } })).map(mapProduct),
      findById: async (id) => mapProduct(await client.targetProduct.findUnique({ where: { id }, include: productInclude })),
      create: async (input) => mapProduct(await client.targetProduct.create({ data: { id: input.id || randomUUID(), storeId: input.storeId, name: input.name, description: input.description || null, category: input.category || null, productType: input.hasVariants ? "VARIANT" : "SIMPLE", price: input.price, stock: input.stock, images: input.images || [], options: (input.variantGroups || []).map((item) => ({ name: item.name, values: item.options, position: item.position })), status: dbStatus(input.status), variants: { create: (input.variants || []).map((item) => ({ id: item.id || randomUUID(), sku: item.sku, combinationKey: item.combinationKey, selectedOptions: item.options, price: item.price, stock: item.stock, isActive: item.status === "active", imageUrl: item.image?.url || null, imageStorageKey: item.image?.storageKey || null })) } }, include: productInclude })),
      update: async (id, input) => { const update = async (tx) => { await tx.targetProductVariant.deleteMany({ where: { productId: id } }); return tx.targetProduct.update({ where: { id }, data: { name: input.name, description: input.description || null, category: input.category || null, productType: input.hasVariants ? "VARIANT" : "SIMPLE", price: input.price, stock: input.stock, images: input.images || [], options: (input.variantGroups || []).map((item) => ({ name: item.name, values: item.options, position: item.position })), status: dbStatus(input.status), variants: { create: (input.variants || []).map((item) => ({ sku: item.sku, combinationKey: item.combinationKey, selectedOptions: item.options, price: item.price, stock: item.stock, isActive: item.status === "active", imageUrl: item.image?.url || null, imageStorageKey: item.image?.storageKey || null })) } }, include: productInclude }); }; return mapProduct(await (typeof client.$transaction === "function" ? client.$transaction(update) : update(client))); },
      // Statistik publik: rating dari ulasan yang tampil, terjual dari order yang sudah sampai/selesai.
      stats: async () => {
        const [ratings, sold, storeRatings] = await Promise.all([
          client.$queryRaw`SELECT oi.productId AS id, AVG(r.rating) AS average, COUNT(*) AS count FROM Review r JOIN CommerceOrderItem oi ON oi.id = r.commerceOrderItemId WHERE r.visibilityStatus = 'VISIBLE' AND oi.productId IS NOT NULL GROUP BY oi.productId`,
          client.$queryRaw`SELECT oi.productId AS id, SUM(oi.quantity) AS sold FROM CommerceOrderItem oi JOIN CommerceOrder o ON o.id = oi.commerceOrderId WHERE o.fulfillmentStatus IN ('DELIVERED', 'COMPLETED') AND oi.productId IS NOT NULL GROUP BY oi.productId`,
          client.$queryRaw`SELECT storeId AS id, AVG(rating) AS average, COUNT(*) AS count FROM Review WHERE visibilityStatus = 'VISIBLE' GROUP BY storeId`,
        ]);
        const products = {};
        const entry = (id) => (products[id] ??= { ratingAverage: null, ratingCount: 0, soldCount: 0 });
        for (const row of ratings) Object.assign(entry(row.id), { ratingAverage: Math.round(Number(row.average) * 10) / 10, ratingCount: Number(row.count) });
        for (const row of sold) entry(row.id).soldCount = Number(row.sold);
        const stores = Object.fromEntries(storeRatings.map((row) => [row.id, { ratingAverage: Math.round(Number(row.average) * 10) / 10, ratingCount: Number(row.count) }]));
        return { products, stores };
      },
    },
    commerce: {
      getCart: async (customerUserId) => mapCart(await client.targetCart.findUnique({ where: { customerUserId }, include: cartInclude })),
      ensureCart: async (customerUserId, id) => mapCart(await client.targetCart.upsert({ where: { customerUserId }, update: {}, create: { id: id || randomUUID(), customerUserId }, include: cartInclude })),
      findCartItem: async (cartId, productId, productVariantId) => client.targetCartItem.findFirst({ where: { cartId, productId, productVariantId: productVariantId || null } }),
      addCartItem: async (data) => client.targetCartItem.create({ data: { id: data.id || randomUUID(), ...data } }),
      updateCartItem: async (id, quantity) => client.targetCartItem.update({ where: { id }, data: { quantity } }),
      deleteCartItem: async (id) => client.targetCartItem.delete({ where: { id } }),
      deleteCartItems: async (ids, cartId) => client.targetCartItem.deleteMany({ where: { id: { in: ids }, cartId } }),
      findCheckout: async (customerUserId, idempotencyKey) => { const rows = await client.targetCommerceOrder.findMany({ where: { customerUserId, OR: [{ checkoutIdempotencyKey: idempotencyKey }, { checkoutIdempotencyKey: { startsWith: `${idempotencyKey}:legacy:` } }] }, include: orderInclude, orderBy: { createdAt: "asc" } }); return rows.length ? { id: rows[0].checkoutGroupId, idempotencyKey, createdAt: iso(rows[0].createdAt), orders: rows.map(mapOrder) } : null; },
      createCheckout: async (data) => { const id = data.id || randomUUID(); checkoutKeys.set(id, data.idempotencyKey); return { id, customerUserId: data.customerUserId, idempotencyKey: data.idempotencyKey, createdAt: new Date() }; },
      createOrder: async (data) => { const row = await client.targetCommerceOrder.create({ data: adaptOrderCreate(data, checkoutKeys.get(data.checkoutTransactionId)), include: orderInclude }); const store = row.store || await client.targetStore.findUniqueOrThrow({ where: { id: row.storeId } }); const dedupeKey = `commerce-order-created:${row.id}:${store.merchantUserId}`; await client.targetNotification.create({ data: { id: compatibilityId(`notification:${dedupeKey}`), userId: store.merchantUserId, type: "COMMERCE_ORDER_CREATED", title: "Pesanan baru", body: `Lapak Anda menerima pesanan baru #${row.orderCode}.`, entityType: "COMMERCE_ORDER", entityId: row.id, metadata: { orderCode: row.orderCode, storeName: store.name }, dedupeKey, createdAt: row.createdAt } }); return mapOrder(row); },
      listOrders: async () => (await client.targetCommerceOrder.findMany({ include: orderInclude, orderBy: { createdAt: "desc" } })).map(mapOrder),
      findOrder: async (id) => mapOrder(await client.targetCommerceOrder.findUnique({ where: { id }, include: orderInclude })),
      listExpiredPaymentOrders: async (now) => (await client.targetCommerceOrder.findMany({ where: { paymentStatus: "PENDING", paymentAttempts: { some: { status: "PENDING", expiredAt: { lte: now } } } }, include: orderInclude })).map(mapOrder),
      updateOrder: async (id, data) => { if (data.paymentStatus !== undefined && dbStatus(data.paymentStatus) === "PAID") await client.targetPaymentAttempt.updateMany({ where: { commerceOrderId: id, provider: "COD", status: "PENDING" }, data: { status: "PAID", paidAt: data.completedAt || new Date() } }); const row = await client.targetCommerceOrder.update({ where: { id }, data: adaptOrderUpdate(data), include: orderInclude }); if (data.fulfillmentStatus && ORDER_STATUS_NOTICE[apiStatus(dbStatus(data.fulfillmentStatus))]) { const status = apiStatus(dbStatus(data.fulfillmentStatus)); const [noticeTitle, noticeBody] = ORDER_STATUS_NOTICE[status]; const type = status === "completed" ? "COMMERCE_ORDER_COMPLETED" : status === "cancelled" ? "COMMERCE_ORDER_CANCELLED" : "COMMERCE_ORDER_STATUS_CHANGED"; const dedupeKey = `commerce-order-status:${row.id}:${status}:${row.customerUserId}`; await client.targetNotification.upsert({ where: { dedupeKey }, update: {}, create: { id: compatibilityId(`notification:${dedupeKey}`), userId: row.customerUserId, type, title: noticeTitle, body: noticeBody(row.orderCode, data.cancellationReason),  entityType: "COMMERCE_ORDER", entityId: row.id, metadata: { orderCode: row.orderCode, status }, dedupeKey, createdAt: row.updatedAt } }); } return mapOrder(row); },
      addActivity: async (data) => appendJsonArray(client, "targetCommerceOrder", data.commerceOrderId || data.orderId, "activityHistory", { id: data.id || randomUUID(), actorUserId: data.actorUserId || null, actorType: data.actorType, type: data.activityType, fromStatus: data.fromStatus || null, toStatus: data.toStatus || null, description: data.description, createdAt: iso(data.createdAt || new Date()) }),
      reserveSimple: async (productId, quantity) => (await client.targetProduct.updateMany({ where: { id: productId, status: "ACTIVE", productType: "SIMPLE", stock: { gte: quantity }, store: { status: "ACTIVE" } }, data: { stock: { decrement: quantity } } })).count === 1,
      reserveVariant: async (productId, variantId, quantity) => (await client.targetProductVariant.updateMany({ where: { id: variantId, productId, isActive: true, stock: { gte: quantity }, product: { status: "ACTIVE", store: { status: "ACTIVE" } } }, data: { stock: { decrement: quantity } } })).count === 1,
      releaseSimple: async (productId, quantity) => client.targetProduct.update({ where: { id: productId }, data: { stock: { increment: quantity } } }),
      releaseVariant: async (variantId, quantity) => client.targetProductVariant.update({ where: { id: variantId }, data: { stock: { increment: quantity } } }),
      releaseReservation: async (id) => (await client.targetCommerceOrderItem.updateMany({ where: { id, stockStatus: "RESERVED" }, data: { stockStatus: "RELEASED", releasedAt: new Date() } })).count === 1,
      consumeReservation: async (id) => (await client.targetCommerceOrderItem.updateMany({ where: { id, stockStatus: "RESERVED" }, data: { stockStatus: "CONSUMED", consumedAt: new Date() } })).count === 1,
    },
    settings: {
      get: async () => mapSettings(await client.targetPlatformSettings.findUnique({ where: { id: "active" } })),
      update: async (changes) => mapSettings(await client.targetPlatformSettings.update({ where: { id: "active" }, data: adaptSettings(changes) })),
    },
    finance: createFinalFinanceRepository(client),
    delivery: createDeliveryRepository(client),
    reviews: createReviewRepository(client),
    chats: createChatRepository(client),
    notifications: createNotificationRepository(client),
    audits: { append: async (input) => ({ id: null, ...input, archived: true }), list: async () => [] },
    transaction: (work) => typeof client.$transaction === "function" ? client.$transaction((tx) => work(createFinalPrismaRepository(tx))) : work(createFinalPrismaRepository(client)),
    health: async () => { await client.$queryRaw`SELECT 1`; return true; },
  };
  return repository;
}

const cartInclude = { items: { orderBy: { createdAt: "asc" }, include: { product: { include: productInclude }, variant: true } } };
const mapCart = (row) => row && ({ id: row.id, customerUserId: row.customerUserId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), items: row.items.map((item) => ({ id: item.id, productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, product: mapProduct(item.product), variant: mapVariant(item.variant) })) });
const timeText = (value) => { const normalized = iso(value); if (!normalized) return normalized; return normalized.includes("T") ? normalized.slice(11, 19) : normalized.slice(0, 8); };
const mapSettings = (row) => row && ({ ...mapDeep(row), deliveryOrderCutoffTime: timeText(row.orderCutoffTime), deliveryDispatchTime: timeText(row.dispatchTime), adminFeeGraceTime: timeText(row.adminFeeGraceTime), adminFeeType: lower(row.adminFeeType), maxDeliveryDistanceKm: row.maxDeliveryDistanceKm == null ? null : Number(row.maxDeliveryDistanceKm) });
const optionalSettings = ["installmentFullEnabled", "installment3MonthsEnabled", "installment6MonthsEnabled", "maxDeliveryDistanceKm", "adminContactName", "adminContactPhone"];
const adaptSettings = (data) => ({ ...(data.adminFeeGraceTime !== undefined ? { adminFeeGraceTime: new Date(`1970-01-01T${data.adminFeeGraceTime}Z`) } : {}), ...Object.fromEntries(optionalSettings.filter((key) => data[key] !== undefined).map((key) => [key, data[key]])), ...(data.taxPercent !== undefined ? { taxPercent: data.taxPercent } : {}), ...(data.deliveryRatePerKm !== undefined ? { deliveryRatePerKm: data.deliveryRatePerKm } : {}), ...(data.deliveryOrderCutoffTime !== undefined ? { orderCutoffTime: new Date(`1970-01-01T${data.deliveryOrderCutoffTime}Z`) } : {}), ...(data.deliveryDispatchTime !== undefined ? { dispatchTime: new Date(`1970-01-01T${data.deliveryDispatchTime}Z`) } : {}), ...(data.maxDailyDeliveries !== undefined ? { maxDailyDeliveries: data.maxDailyDeliveries } : {}), ...(data.initialStoreFeeAmount !== undefined ? { initialStoreFeeAmount: data.initialStoreFeeAmount } : {}), ...(data.installmentLateInterestPercent !== undefined ? { installmentLateInterestPercent: data.installmentLateInterestPercent } : {}), ...(data.adminFeeType !== undefined ? { adminFeeType: dbStatus(data.adminFeeType) } : {}), ...(data.adminFeeValue !== undefined ? { adminFeeValue: data.adminFeeValue } : {}), ...(data.adminFeeCutoffDay !== undefined ? { adminFeeCutoffDay: data.adminFeeCutoffDay } : {}), ...(data.suspendStoreForOutstandingAdminFee !== undefined ? { suspendStoreForOutstandingAdminFee: data.suspendStoreForOutstandingAdminFee } : {}), ...(data.voluntaryContributionEnabled !== undefined ? { voluntaryContributionEnabled: data.voluntaryContributionEnabled } : {}) });
const adaptOrderCreate = (data, checkoutKey) => {
  const items = data.items?.create || data.items || [];
  const attempts = data.paymentAttempts?.create ? [data.paymentAttempts.create].flat() : [];
  const activities = data.activities?.create ? [data.activities.create].flat() : [];
  const reservedAt = new Date();
  return { id: data.id || randomUUID(), checkoutGroupId: data.checkoutGroupId || data.checkoutTransactionId, checkoutIdempotencyKey: data.checkoutIdempotencyKey || data.idempotencyKey || checkoutKey, storeId: data.storeId, customerUserId: data.customerUserId, orderCode: data.orderCode, fulfillmentStatus: dbStatus(data.fulfillmentStatus || "pending").replace("ON_DELIVERY", "IN_DELIVERY").replace("PICKED_UP", "IN_DELIVERY"), paymentStatus: dbStatus(data.paymentStatus || "unpaid"), subtotal: data.subtotal ?? data.productTotal, taxPercentSnapshot: data.taxPercentSnapshot || 0, taxAmount: data.taxAmount || 0, deliveryFee: data.deliveryFee || 0, courierTip: data.courierTip || 0, grandTotal: data.grandTotal ?? data.totalAmount, deliveryRatePerKmSnapshot: data.deliveryRatePerKmSnapshot ?? data.deliveryRateSnapshot, deliveryDistanceKm: data.deliveryDistanceKm ?? data.distanceKm, deliveryDate: data.deliveryDate, recipientName: data.recipientName, recipientPhone: data.recipientPhone, deliveryAddress: data.deliveryAddress, deliveryLatitude: data.deliveryLatitude ?? data.deliveryLocation?.latitude, deliveryLongitude: data.deliveryLongitude ?? data.deliveryLocation?.longitude, customerNote: data.customerNote || null, activityHistory: activities.map((item)=>({ id: item.id || randomUUID(), actorUserId: item.actorUserId || null, actorType: item.actorType, type: item.activityType, fromStatus: item.fromStatus || null, toStatus: item.toStatus || null, description: item.description, createdAt: iso(item.createdAt || new Date()) })), items: { create: items.map((item)=>({ id: item.id || randomUUID(), productId: item.productId, productVariantId: item.productVariantId || null, productNameSnapshot: item.productName, variantSnapshot: item.variantOptions ?? Prisma.DbNull, skuSnapshot: item.sku || null, imageSnapshot: item.imageUrl || null, storeNameSnapshot: item.storeName, unitPrice: item.unitPrice, quantity: item.quantity, subtotal: item.subtotal, stockStatus: "RESERVED", reservedAt })) }, paymentAttempts: { create: attempts.map((item)=>({ id: item.id || randomUUID(), provider: dbStatus(item.provider), method: item.paymentMethod, amount: item.amount, status: dbStatus(item.status), expiredAt: item.expiresAt || null })) } };
};
const adaptOrderUpdate = (data) => ({ ...(data.fulfillmentStatus !== undefined ? { fulfillmentStatus: dbStatus(data.fulfillmentStatus).replace("ON_DELIVERY", "IN_DELIVERY").replace("PICKED_UP", "IN_DELIVERY") } : {}), ...(data.paymentStatus !== undefined ? { paymentStatus: dbStatus(data.paymentStatus) } : {}), ...(data.cancellationReason !== undefined ? { cancelReason: data.cancellationReason } : {}), ...(data.cancelledAt !== undefined ? { cancelledAt: data.cancelledAt } : {}), ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}), ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}) });
async function appendJsonArray(client, delegate, id, field, entry) { const current = await client[delegate].findUnique({ where: { id }, select: { [field]: true } }); return client[delegate].update({ where: { id }, data: { [field]: [...json(current[field], []), entry] } }); }

function createFinanceRepository(client) {
  const feeInclude = { children: { include: { children: true, paymentAttempts: true }, orderBy: { installmentNumber: "asc" } }, paymentAttempts: true, store: true, order: true };
  const fees = (rows) => mapDeep(rows);
  return {
    getInitialFee: async (storeId) => fees(await client.targetMerchantFee.findFirst({ where: { storeId, feeType: "INITIAL_STORE_FEE" }, include: feeInclude })),
    findInstallment: async (id) => fees(await client.targetMerchantFee.findFirst({ where: { id, feeType: "INITIAL_STORE_INSTALLMENT" }, include: { parent: { include: { store: true } }, children: true, paymentAttempts: true } })),
    listReconcileInstallments: async (now) => fees(await client.targetMerchantFee.findMany({ where: { feeType: "INITIAL_STORE_INSTALLMENT", status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: now } }, include: { parent: { include: { store: true } }, children: true } })),
    createPenalty: async (data) => fees(await client.targetMerchantFee.upsert({ where: { id: data.id }, update: {}, create: { id: data.id, merchantUserId: data.merchantUserId, storeId: data.storeId, parentFeeId: data.installmentId, feeType: "LATE_PENALTY", calculationType: "PERCENTAGE", rateSnapshot: data.penaltyPercent, baseAmountSnapshot: data.baseOutstandingAmount, amount: data.penaltyAmount, installmentNumber: data.periodNumber, dueAt: data.calculatedAt, status: "OUTSTANDING" } })),
    updateInstallment: async (id, data) => fees(await client.targetMerchantFee.update({ where: { id }, data: { ...(data.status ? { status: dbStatus(data.status) } : {}), ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}) } })),
    createPaymentAttempt: async (data) => fees(await client.targetPaymentAttempt.create({ data: { ...data, provider: dbStatus(data.provider), status: dbStatus(data.status), commerceOrderId: data.commerceOrderId || null, merchantFeeId: data.merchantFeeId || null } })),
    cancelPendingPaymentAttempts: async (merchantFeeId) => client.targetPaymentAttempt.updateMany({ where: { merchantFeeId, status: "PENDING" }, data: { status: "CANCELLED" } }),
    listAdminFees: async (storeId) => fees(await client.targetMerchantFee.findMany({ where: { storeId, feeType: "ADMIN_FEE" }, include: { order: true, paymentAttempts: true }, orderBy: { createdAt: "desc" } })),
    findAdminFees: async (ids) => fees(await client.targetMerchantFee.findMany({ where: { id: { in: ids }, feeType: "ADMIN_FEE" }, include: { store: true } })),
    payAdminFee: async (id, paidAt) => fees(await client.targetMerchantFee.update({ where: { id }, data: { status: "PAID", paidAt } })),
    listStoresForAdminFeeReconcile: async (now) => fees(await client.targetStore.findMany({ where: { status: "ACTIVE", fees: { some: { feeType: "ADMIN_FEE", status: "OUTSTANDING", dueAt: { lte: now } } } } })),
    countOverdueAdminFees: async (storeId, now) => client.targetMerchantFee.count({ where: { storeId, feeType: "ADMIN_FEE", status: "OUTSTANDING", dueAt: { lte: now } } }),
    listContributions: async (merchantUserId) => fees(await client.targetMerchantFee.findMany({ where: { merchantUserId, feeType: "VOLUNTARY_CONTRIBUTION" }, orderBy: { createdAt: "desc" } })),
    createContribution: async (data) => fees(await client.targetMerchantFee.create({ data: { ...data, feeType: "VOLUNTARY_CONTRIBUTION", status: dbStatus(data.status || "pending") } })),
    findContribution: async (id) => fees(await client.targetMerchantFee.findFirst({ where: { id, feeType: "VOLUNTARY_CONTRIBUTION" } })),
    updateContribution: async (id, data) => fees(await client.targetMerchantFee.update({ where: { id }, data: { ...data, ...(data.status ? { status: dbStatus(data.status) } : {}) } })),
    monitoring: async () => fees({ initialFees: await client.targetMerchantFee.findMany({ where: { feeType: "INITIAL_STORE_FEE" }, include: feeInclude }), adminFees: await client.targetMerchantFee.findMany({ where: { feeType: "ADMIN_FEE" }, include: { store: true, order: true } }), settlements: [], suspendedStores: await client.targetStore.findMany({ where: { status: "SUSPENDED_ADMIN_FEE" } }), contributions: await client.targetMerchantFee.findMany({ where: { feeType: "VOLUNTARY_CONTRIBUTION" } }) }),
  };
}

function createNotificationRepository(client) { return {
  create: async (data) => mapNotification(await client.targetNotification.create({ data: { id: data.id || randomUUID(), ...data } })), findByDedupeKey: async (dedupeKey) => mapNotification(await client.targetNotification.findUnique({ where: { dedupeKey } })), findById: async (id) => mapNotification(await client.targetNotification.findUnique({ where: { id } })), list: async ({ where, skip, take }) => mapDeep(await client.targetNotification.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })), count: async (where) => client.targetNotification.count({ where }), markRead: async (id, userId, readAt) => (await client.targetNotification.updateMany({ where: { id, userId }, data: { readAt } })).count, markAllRead: async (userId, readAt) => (await client.targetNotification.updateMany({ where: { userId, readAt: null }, data: { readAt } })).count,
}; }

function mapReviewRow(row) {
  if (!row) return null;
  const value = mapDeep(row);
  return { ...value, visibility: value.visibilityStatus,
    photos: (value.photoUrls || []).map((photo, index) => ({ id: photo.id || `json:${value.id}:${index}`, ...photo })),
    reply: value.merchantReply ? { text: value.merchantReply, authorUserId: value.repliedByUserId, createdAt: value.repliedAt, updatedAt: value.repliedAt, author: value.repliedBy } : null,
    productTarget: value.orderItem ? { commerceOrderItemId: value.commerceOrderItemId, commerceOrderItem: { ...value.orderItem, orderId: value.orderItem.commerceOrderId, productName: value.orderItem.productNameSnapshot, variantOptions: value.orderItem.variantSnapshot } } : null };
}
function createReviewRepository(client) { const include = { customer: true, store: true, orderItem: { include: { order: true, product: true } }, repliedBy: true, moderatedBy: true }; return {
  findProductSource: async (id) => { const row = await client.targetCommerceOrderItem.findUnique({ where: { id }, include: { order: { include: orderInclude }, product: true, review: true } }); return row && { ...mapDeep(row), order: mapOrder(row.order), reviewTarget: row.review ? { reviewId: row.review.id } : null }; },
  findProductSourceByOrder: async (commerceOrderId, productId) => { const row = await client.targetCommerceOrderItem.findFirst({ where: { commerceOrderId, productId }, include: { order: { include: orderInclude }, product: true, review: true } }); return row && { ...mapDeep(row), order: mapOrder(row.order), reviewTarget: row.review ? { reviewId: row.review.id } : null }; },
  create: async (data) => mapReviewRow(await client.targetReview.create({ data: { id: data.id || randomUUID(), commerceOrderItemId: data.commerceOrderItemId || data.productTarget?.create?.commerceOrderItemId, customerUserId: data.customerUserId, storeId: data.storeId, rating: data.rating, comment: data.comment, photoUrls: (data.photos?.create || data.photoUrls || []).map((photo) => ({ url: photo.url, storageKey: photo.storageKey || null, position: photo.position })) }, include })),
  find: async (id) => mapReviewRow(await client.targetReview.findUnique({ where: { id }, include })),
  list: async (where = {}) => { const targetWhere = { ...(where.customerUserId ? { customerUserId: where.customerUserId } : {}), ...(where.storeId ? { storeId: where.storeId } : {}), ...(where.visibility ? { visibilityStatus: where.visibility } : {}), ...(where.store?.merchantUserId ? { store: { merchantUserId: where.store.merchantUserId } } : {}), ...(where.productTarget?.commerceOrderItem?.productId ? { orderItem: { productId: where.productTarget.commerceOrderItem.productId } } : {}) }; return (await client.targetReview.findMany({ where: targetWhere, include, orderBy: { createdAt: "desc" } })).map(mapReviewRow); },
  update: async (id, data) => mapReviewRow(await client.targetReview.update({ where: { id }, data: { ...(data.visibility !== undefined ? { visibilityStatus: data.visibility } : {}), ...(data.moderationReason !== undefined ? { moderationReason: data.moderationReason } : {}), ...(data.moderatedByUserId !== undefined ? { moderatedByUserId: data.moderatedByUserId } : {}), ...(data.moderatedAt !== undefined ? { moderatedAt: data.moderatedAt } : {}) }, include })),
  upsertReply: async (reviewId, repliedByUserId, merchantReply, repliedAt = new Date()) => mapReviewRow(await client.targetReview.update({ where: { id: reviewId }, data: { repliedByUserId, merchantReply, repliedAt }, include })),
}; }

function createChatRepository(client) { return {
  findByOpenKey: async (openKey) => mapConversation(await client.targetConversation.findUnique({ where: { openKey }, include: conversationInclude })), find: async (id) => mapConversation(await client.targetConversation.findUnique({ where: { id }, include: conversationInclude })), list: async ({ where, skip, take }) => (await client.targetConversation.findMany({ where: adaptConversationWhere(where), skip, take, include: conversationInclude, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] })).map(mapConversation), count: async (where) => client.targetConversation.count({ where: adaptConversationWhere(where) }), create: async (data) => mapConversation(await client.targetConversation.create({ data: adaptConversationCreate(data), include: conversationInclude })), createMessage: async (conversationId, senderUserId, message, attachmentUrl, id, createdAt) => mapMessage(await client.targetMessage.create({ data: { id: id || randomUUID(), ...(createdAt ? { createdAt } : {}), conversationId, senderUserId, message, attachmentUrl }, include: { sender: true } })), update: async (id, data) => mapDeep(await client.targetConversation.update({ where: { id }, data: { ...(data.status ? { status: dbStatus(data.status) } : {}), ...(data.closedByUserId !== undefined ? { closedByUserId: data.closedByUserId } : {}), ...(data.closedAt !== undefined ? { closedAt: data.closedAt } : {}) } })), messages: async (conversationId, skip, take) => { const conversation = await client.targetConversation.findUnique({ where: { id: conversationId }, select: { requesterUserId: true, counterpartUserId: true } }); const rows = await client.targetMessage.findMany({ where: { conversationId }, skip, take, include: { sender: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }); return rows.map((row) => { const recipientUserId = row.senderUserId === conversation.requesterUserId ? conversation.counterpartUserId : conversation.requesterUserId; return { ...mapMessage(row), reads: row.readAt ? [{ userId: recipientUserId, readAt: iso(row.readAt) }] : [] }; }); }, messageCount: async (conversationId) => client.targetMessage.count({ where: { conversationId } }), markRead: async (conversationId, userId, readAt = new Date()) => (await client.targetMessage.updateMany({ where: { conversationId, senderUserId: { not: userId }, readAt: null }, data: { readAt } })).count, deleteDraft: async (id) => client.targetConversation.delete({ where: { id } }),
}; }
const adaptConversationCreate = (data) => { const participants = data.participants?.create || []; const context = data.context?.create || {}; const requesterUserId = data.requesterUserId || participants[0]?.userId; const counterpartUserId = data.counterpartUserId || participants[1]?.userId; if (!requesterUserId || !counterpartUserId || requesterUserId === counterpartUserId) throw new Error("Conversation requires two distinct participants"); return { id: data.id || randomUUID(), type: dbStatus(data.type), openKey: data.openKey, subject: data.subject, requesterUserId, counterpartUserId, storeId: data.storeId || context.storeId, productId: data.productId || context.productId, commerceOrderId: data.commerceOrderId || context.commerceOrderId, status: dbStatus(data.status || "open") }; };
const adaptConversationWhere = (where = {}) => { const participantId = where.participants?.some?.userId; const unread = where.messages?.some; return { ...(participantId ? { OR: [{ requesterUserId: participantId }, { counterpartUserId: participantId }] } : {}), ...(where.type ? { type: dbStatus(where.type) } : {}), ...(where.status ? { status: dbStatus(where.status) } : {}), ...(unread ? { messages: { some: { senderUserId: unread.senderUserId, readAt: null } } } : {}) }; };

const finalDeliveryProfile = (row) => row && ({ ...mapDeep(row), user: row.user ? { ...mapDeep(row.user), roles: (row.user.roles || []).map((entry) => ({ role: { name: lower(entry.role) } })) } : undefined });
const finalDeliveryAssignment = (row) => row && ({ ...mapDeep(row), commerceOrder: row.order ? mapOrder(row.order) : undefined, batch: row.batch ? { ...mapDeep(row.batch), courier: row.batch.courier?.user ? mapDeep(row.batch.courier.user) : row.batch.courier } : undefined });
const finalDeliveryBatch = (row) => row && ({ ...mapDeep(row), courier: row.courier?.user ? mapDeep(row.courier.user) : row.courier, orders: (row.orders || []).map(finalDeliveryAssignment) });
function createDeliveryRepository(client) {
  const batchInclude = { courier: { include: { user: true } }, orders: { include: { order: { include: orderInclude } } } };
  const assignmentInclude = { batch: { include: { courier: { include: { user: true } } } }, order: { include: orderInclude } };
  const findAssignment = (commerceOrderId) => client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId, batch: { status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } } }, include: assignmentInclude, orderBy: { createdAt: "desc" } });
  return {
    profile: async (userId) => finalDeliveryProfile(await client.targetCourierProfile.findUnique({ where: { userId }, include: { user: { include: { roles: true } } } })),
    upsertProfile: async (userId, data) => finalDeliveryProfile(await client.targetCourierProfile.upsert({ where: { userId }, update: data, create: { userId, ...data }, include: { user: { include: { roles: true } } } })),
    listCouriers: async () => (await client.targetCourierProfile.findMany({ include: { user: { include: { roles: true } } }, orderBy: { createdAt: "asc" } })).map(finalDeliveryProfile),
    availability: async (courierUserId) => json((await client.targetCourierProfile.findUnique({ where: { userId: courierUserId }, select: { availabilityHistory: true } }))?.availabilityHistory, []),
    overlappingAvailability: async (courierUserId, startAt, endAt) => json((await client.targetCourierProfile.findUnique({ where: { userId: courierUserId }, select: { availabilityHistory: true } }))?.availabilityHistory, []).find((item) => (item.status || "approved") === "approved" && new Date(item.startAt) < (endAt || new Date("9999-12-31")) && (!item.endAt || new Date(item.endAt) > startAt)) || null,
    createAvailability: async (data) => updateAvailability(client, data.courierUserId, { id: data.id || randomUUID(), ...data }),
    endAvailability: async (id, courierUserId, endAt) => updateAvailability(client, courierUserId, { id, endAt }, true),
    eligibleOrders: async () => (await client.targetCommerceOrder.findMany({ where: { fulfillmentStatus: { in: ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP"] }, paymentStatus: { in: ["PAID", "PENDING"] }, deliveryFee: { gt: 0 }, store: { status: "ACTIVE" } }, include: orderInclude, orderBy: { createdAt: "asc" } })).map(mapOrder),
    lockOrder: async (commerceOrderId) => client.$queryRaw`SELECT id FROM CommerceOrder WHERE id=${commerceOrderId} FOR UPDATE`,
    activeAssignment: async (commerceOrderId) => finalDeliveryAssignment(await client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId, status: { in: ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] }, batch: { status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } } }, include: assignmentInclude })),
    activeCourierCount: async (courierUserId, deliveryDate) => client.targetDeliveryBatchOrder.count({ where: { batch: { courierUserId, deliveryDate, status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } }, status: { in: ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] } } }),
    createBatch: async (data, orderIds) => finalDeliveryBatch(await client.targetDeliveryBatch.create({ data: { id: data.id || randomUUID(), ...data, status: dbStatus(data.status), orders: { create: orderIds.map((commerceOrderId, index) => ({ id: randomUUID(), commerceOrderId, pickupSequence: index + 1, deliverySequence: index + 1 })) } }, include: batchInclude })),
    listBatches: async (where = {}) => (await client.targetDeliveryBatch.findMany({ where, include: batchInclude, orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }] })).map(finalDeliveryBatch),
    batch: async (id) => finalDeliveryBatch(await client.targetDeliveryBatch.findUnique({ where: { id }, include: batchInclude })),
    merchantAssignments: async (merchantUserId) => (await client.targetDeliveryBatchOrder.findMany({ where: { order: { store: { merchantUserId } } }, include: assignmentInclude, orderBy: { createdAt: "desc" } })).map(finalDeliveryAssignment),
    assignment: async (commerceOrderId) => finalDeliveryAssignment(await findAssignment(commerceOrderId)),
    latestAssignment: async (commerceOrderId) => finalDeliveryAssignment(await client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId }, include: assignmentInclude, orderBy: { createdAt: "desc" } })),
    batchOrder: async (deliveryBatchId, commerceOrderId) => finalDeliveryAssignment(await client.targetDeliveryBatchOrder.findUnique({ where: { deliveryBatchId_commerceOrderId: { deliveryBatchId, commerceOrderId } }, include: assignmentInclude })),
    createBatchOrder: async (data) => finalDeliveryAssignment(await client.targetDeliveryBatchOrder.create({ data: { id: data.id || randomUUID(), ...data, status: dbStatus(data.status || "WAITING_PICKUP") }, include: assignmentInclude })),
    updateBatch: async (id, data) => finalDeliveryBatch(await client.targetDeliveryBatch.update({ where: { id }, data: { ...data, ...(data.status ? { status: dbStatus(data.status) } : {}) }, include: batchInclude })),
    updateAssignment: async (id, data) => { const status = data.status && dbStatus(data.status); const now = new Date(); return finalDeliveryAssignment(await client.targetDeliveryBatchOrder.update({ where: { id }, data: { ...data, ...(status ? { status } : {}), ...(status === "PICKED_UP" ? { pickedUpAt: data.pickedUpAt || now } : {}), ...(status === "OUT_FOR_DELIVERY" ? { outForDeliveryAt: data.outForDeliveryAt || now } : {}), ...(status === "FAILED" ? { failureReason: data.failureReason || data.reason || null } : {}) }, include: assignmentInclude })); },
    pickupConfirmation: async (data) => { const assignment = data.deliveryBatchId ? await client.targetDeliveryBatchOrder.findUnique({ where: { deliveryBatchId_commerceOrderId: { deliveryBatchId: data.deliveryBatchId, commerceOrderId: data.commerceOrderId } } }) : await findAssignment(data.commerceOrderId); if (!assignment) return null; const row = await client.targetDeliveryBatchOrder.update({ where: { id: assignment.id }, data: { merchantReady: data.isReady, merchantReadyNote: data.note, merchantConfirmedAt: data.confirmedAt || new Date() }, include: assignmentInclude }); return { ...finalDeliveryAssignment(row), isReady: row.merchantReady, note: row.merchantReadyNote, confirmedAt: iso(row.merchantConfirmedAt) }; },
    proof: async (commerceOrderId) => { const row = await client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId, proofPhotoUrl: { not: null } }, orderBy: { createdAt: "desc" } }); return row && { id: row.id, commerceOrderId, photoUrl: row.proofPhotoUrl, recipientName: row.proofRecipientName, note: row.proofNote, deliveredAt: iso(row.deliveredAt) }; },
    createProof: async (data) => { const assignment = data.deliveryBatchId ? await client.targetDeliveryBatchOrder.findUnique({ where: { deliveryBatchId_commerceOrderId: { deliveryBatchId: data.deliveryBatchId, commerceOrderId: data.commerceOrderId } } }) : await findAssignment(data.commerceOrderId); if (!assignment) return null; const deliveredAt = data.deliveredAt || new Date(); const row = await client.targetDeliveryBatchOrder.update({ where: { id: assignment.id }, data: { proofPhotoUrl: data.photoUrl, proofRecipientName: data.recipientName, proofNote: data.note, deliveredAt, status: "DELIVERED" } }); return { id: row.id, commerceOrderId: row.commerceOrderId, photoUrl: row.proofPhotoUrl, recipientName: row.proofRecipientName, note: row.proofNote, deliveredAt: iso(row.deliveredAt) }; },
    activities: async (commerceOrderId) => json((await client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId }, orderBy: { createdAt: "desc" } }))?.deliveryHistory, []),
    addActivity: async (data) => { const row = await client.targetDeliveryBatchOrder.findFirst({ where: { commerceOrderId: data.commerceOrderId }, orderBy: { createdAt: "desc" } }); if (!row) throw new Error(`Delivery assignment not found for ${data.commerceOrderId}`); return appendJsonArray(client, "targetDeliveryBatchOrder", row.id, "deliveryHistory", { id: data.id || randomUUID(), ...data, createdAt: iso(data.createdAt || new Date()) }); },
  };
}
async function updateAvailability(client, userId, data, close = false) { const row = await client.targetCourierProfile.findUnique({ where: { userId } }); if (!row) return close ? { count: 0 } : null; const history = json(row.availabilityHistory, []); const active = history.find((item) => item.id === data.id && !item.endAt); if (close && !active) return { count: 0 }; const next = close ? history.map((item) => item.id === data.id ? { ...item, endAt: iso(data.endAt) } : item) : [...history, { ...data, startAt: iso(data.startAt), endAt: iso(data.endAt) }]; await client.targetCourierProfile.update({ where: { userId }, data: { availabilityHistory: next, availabilityStatus: close ? "AVAILABLE" : "UNAVAILABLE", unavailableStartAt: close ? null : data.startAt, unavailableEndAt: close ? null : data.endAt, unavailableReason: close ? null : data.reason } }); return close ? { count: 1 } : { ...data, startAt: iso(data.startAt), endAt: iso(data.endAt) }; }

module.exports = { createFinalPrismaRepository, mapUser, mapStore, mapProduct, mapOrder };
