const { getPrisma } = require("../config/prisma");
const { createHash } = require("node:crypto");

const compatibilityId = (key) => { const hex = createHash("sha256").update(key).digest("hex").slice(0, 32); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`; };

const dbStoreType = { product: "product", tourism: "tourism", "live-in": "liveIn" };
const apiStoreType = { product: "product", tourism: "tourism", liveIn: "live-in" };
const userInclude = { roles: { include: { role: true } } };
const mapUser = (row) => row && ({ id: row.id, fullName: row.fullName, email: row.email, phone: row.phone, avatarUrl: row.avatarUrl || null, passwordHash: row.passwordHash, passwordChangedAt: row.passwordChangedAt?.toISOString() || null, passwordResetRequired: row.passwordResetRequired, status: row.status, language: row.language, theme: row.theme, roles: row.roles.map(({ role }) => role.name), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const mapStore = (row) => row && ({ id: row.id, merchantUserId: row.merchantUserId, name: row.name, type: apiStoreType[row.type], description: row.description, phone: row.phone, image: row.image, status: row.status, approvalStatus: row.approvalStatus, rejectionReason: row.rejectionReason, reviewedAt: row.reviewedAt?.toISOString() || null, reviewedByUserId: row.reviewedByUserId, merchant: row.merchant ? { id: row.merchant.id, fullName: row.merchant.fullName, email: row.merchant.email, phone: row.merchant.phone } : undefined, statusHistory: row.statusHistory?.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })), location: { source: row.locationSource, locationRef: row.locationRef, label: row.locationLabel, address: row.address, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) }, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const settingsDecimalKeys = ["deliveryRatePerKm", "initialStoreFeeAmount", "installmentLateInterestPercent", "adminFeeValue", "taxPercent", "prideTransactionValueWeight", "prideTransactionCountWeight", "prideRatingWeight", "prideCompletionRateWeight"];
const mapSettings = (row) => row && Object.fromEntries(Object.entries(row).map(([key, value]) => [key, settingsDecimalKeys.includes(key) ? Number(value) : value instanceof Date ? value.toISOString() : value]));
const productInclude = { store: true, images: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, variants: { orderBy: { sku: "asc" } } };
const mapProduct = (row) => row && ({
  id: row.id, storeId: row.storeId, name: row.name, description: row.description, category: row.category,
  status: row.status, hasVariants: row.hasVariants, price: row.price == null ? null : Number(row.price),
  stock: row.stock, image: row.images.find((item) => item.isPrimary)?.url || row.images[0]?.url || "",
  images: row.images.map((item) => ({ id: item.id, url: item.url, storageKey: item.storageKey, position: item.position, isPrimary: item.isPrimary })),
  variantGroups: row.options.map((item) => ({ id: item.id, name: item.name, options: item.values })),
  variants: row.variants.map((item) => ({ id: item.id, sku: item.sku, options: item.options, price: Number(item.price), stock: item.stock, status: item.status, image: item.imageUrl ? { url: item.imageUrl, storageKey: item.imageStorageKey } : null })),
  store: row.store ? mapStore(row.store) : undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

const productData = (input) => ({
  ...(input.id ? { id: input.id } : {}), storeId: input.storeId, name: input.name, description: input.description, category: input.category,
  status: input.status, hasVariants: input.hasVariants, price: input.price, stock: input.stock,
  images: { create: input.images.map((item) => ({ ...(item.id ? { id: item.id } : {}), url: item.url, storageKey: item.storageKey, position: item.position, isPrimary: item.isPrimary })) },
  options: { create: input.variantGroups.map((item) => ({ ...(item.id ? { id: item.id } : {}), name: item.name, values: item.options, position: item.position })) },
  variants: { create: input.variants.map((item) => ({ ...(item.id ? { id: item.id } : {}), sku: item.sku, combinationKey: item.combinationKey, options: item.options, price: item.price, stock: item.stock, status: item.status, imageUrl: item.image?.url || null, imageStorageKey: item.image?.storageKey || null })) },
});
const commerceOrderInclude = { store: true, items: true, activities: { orderBy: { createdAt: "asc" } }, reservations: true, paymentAttempts: true, deliveryBatchOrders: { include: { batch: { include: { courier: true } } }, orderBy: { createdAt: "desc" } }, pickupConfirmations: { orderBy: { confirmedAt: "desc" } }, deliveryProof: true, deliveryActivities: { orderBy: { createdAt: "asc" } } };
const apiFulfillment = { readyForPickup: "ready-for-pickup", pickedUp: "picked-up", onDelivery: "on-delivery" };
const mapOrder = (row) => row && ({
  ...row, fulfillmentStatus: apiFulfillment[row.fulfillmentStatus] || row.fulfillmentStatus, orderNumber: row.orderCode, storeName: row.store?.name,
  productTotal: Number(row.productTotal), deliveryFee: Number(row.deliveryFee), courierTip: Number(row.courierTip), totalAmount: Number(row.totalAmount), distanceKm: Number(row.distanceKm), deliveryRateSnapshot: Number(row.deliveryRateSnapshot),
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), paymentPaidAt: row.paymentPaidAt?.toISOString() || null, cancelledAt: row.cancelledAt?.toISOString() || null,
  items: row.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), subtotal: Number(item.subtotal) })), activities: row.activities.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
  reservations: row.reservations.map((item) => ({ ...item, reservedAt: item.reservedAt.toISOString(), expiresAt: item.expiresAt?.toISOString() || null, releasedAt: item.releasedAt?.toISOString() || null, consumedAt: item.consumedAt?.toISOString() || null })),
  paymentAttempts: row.paymentAttempts.map((item) => ({ ...item, amount: Number(item.amount), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), paidAt: item.paidAt?.toISOString() || null, expiresAt: item.expiresAt?.toISOString() || null })),
  deliveryBatchOrders: row.deliveryBatchOrders?.map((item) => ({ id: item.id, deliveryBatchId: item.deliveryBatchId, commerceOrderId: item.commerceOrderId, pickupSequence: item.pickupSequence, deliverySequence: item.deliverySequence, status: item.status, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), batch: item.batch ? { id: item.batch.id, deliveryDate: item.batch.deliveryDate.toISOString(), cutoffAt: item.batch.cutoffAt.toISOString(), dispatchAt: item.batch.dispatchAt.toISOString(), status: item.batch.status, startedAt: item.batch.startedAt?.toISOString() || null, completedAt: item.batch.completedAt?.toISOString() || null, courier: item.batch.courier ? { id: item.batch.courier.id, fullName: item.batch.courier.fullName } : undefined } : undefined })) || [],
  pickupConfirmations: row.pickupConfirmations?.map((item) => ({ id: item.id, isReady: item.isReady, confirmedAt: item.confirmedAt.toISOString() })) || [],
  deliveryProof: row.deliveryProof ? { id: row.deliveryProof.id, photoUrl: row.deliveryProof.photoUrl, recipientName: row.deliveryProof.recipientName, note: row.deliveryProof.note, deliveredAt: row.deliveryProof.deliveredAt.toISOString() } : null,
  deliveryActivities: row.deliveryActivities?.map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt.toISOString() })) || [],
});
const cartInclude = { items: { orderBy: { createdAt: "asc" }, include: { product: { include: productInclude }, productVariant: true } } };
const mapCart = (row) => row && ({ id: row.id, customerUserId: row.customerUserId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), items: row.items.map((item) => ({ id: item.id, productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity, product: mapProduct(item.product), variant: item.productVariant ? { id: item.productVariant.id, sku: item.productVariant.sku, options: item.productVariant.options, price: Number(item.productVariant.price), stock: item.productVariant.stock, status: item.productVariant.status, image: item.productVariant.imageUrl ? { url: item.productVariant.imageUrl, storageKey: item.productVariant.imageStorageKey } : null } : null })) });
const mapFinance = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(mapFinance);
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber();
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapFinance(item)]));
  return value;
};
const initialFeeInclude = { installments: { orderBy: { installmentNumber: "asc" }, include: { penalties: { orderBy: { periodNumber: "asc" } }, payments: { orderBy: { createdAt: "asc" } } } } };
const reviewInclude = { customer: true, store: true, photos: { orderBy: { position: "asc" } }, reply: { include: { author: true } }, productTarget: { include: { commerceOrderItem: { include: { order: true, product: true } } } }, tourismTarget: { include: { tourismBooking: { include: { tourismPackage: true } } } }, liveInTarget: { include: { liveInBooking: { include: { profile: true } } } } };

function createPrismaRepository(client = getPrisma()) {
  const repository = {
    users: {
      findById: async (id) => mapUser(await client.user.findUnique({ where: { id }, include: userInclude })),
      findByEmail: async (email) => mapUser(await client.user.findUnique({ where: { email }, include: userInclude })),
      findFirstByRole: async (role) => mapUser(await client.user.findFirst({ where: { status: "active", roles: { some: { role: { name: role } } } }, include: userInclude, orderBy: { createdAt: "asc" } })),
      list: async () => (await client.user.findMany({ include: userInclude, orderBy: { createdAt: "desc" } })).map(mapUser),
      create: async (input) => { const createUser = async (tx) => {
        for (const role of input.roles) await tx.role.upsert({ where: { name: role }, update: {}, create: { name: role } });
        return tx.user.create({ data: { ...(input.id ? { id: input.id } : {}), ...(input.createdAt ? { createdAt: input.createdAt } : {}), fullName: input.fullName, email: input.email, phone: input.phone, passwordHash: input.passwordHash, passwordChangedAt: input.passwordChangedAt, passwordResetRequired: Boolean(input.passwordResetRequired), status: input.status, language: input.language || "en", theme: input.theme || "light", roles: { create: input.roles.map((role) => ({ role: { connect: { name: role } } })) } }, include: userInclude });
      }; return mapUser(await (typeof client.$transaction === "function" ? client.$transaction(createUser) : createUser(client))); },
      update: async (id, changes) => mapUser(await client.user.update({ where: { id }, data: changes, include: userInclude })),
      addRole: async (userId, roleName) => {
        const role = await client.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName } });
        await client.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
        return mapUser(await client.user.findUnique({ where: { id: userId }, include: userInclude }));
      },
    },
    sessions: {
      create: async ({ id, tokenHash, userId, expiresAt, createdAt }) => client.session.create({ data: { ...(id ? { id } : {}), ...(createdAt ? { createdAt } : {}), tokenHash, userId, expiresAt } }),
      findActiveByTokenHash: async (tokenHash) => {
        const session = await client.session.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { include: userInclude } } });
        return session ? { id: session.id, tokenHash: session.tokenHash, user: mapUser(session.user), expiresAt: session.expiresAt.toISOString() } : null;
      },
      revokeByTokenHash: async (tokenHash) => client.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }),
      revokeAllForUser: async (userId) => client.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    },
    stores: {
      list: async () => (await client.store.findMany({ orderBy: { createdAt: "asc" } })).map(mapStore),
      listApplications: async () => (await client.store.findMany({ include: { merchant: true, statusHistory: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } })).map(mapStore),
      findApplication: async (id) => mapStore(await client.store.findUnique({ where: { id }, include: { merchant: true, statusHistory: { orderBy: { createdAt: "asc" } } } })),
      findById: async (id) => mapStore(await client.store.findUnique({ where: { id } })),
      create: async (input) => mapStore(await client.store.create({ data: { ...(input.id ? { id: input.id } : {}), ...(input.createdAt ? { createdAt: input.createdAt } : {}), merchantUserId: input.merchantUserId, name: input.name, type: dbStoreType[input.type], description: input.description, phone: input.phone, image: input.image, status: input.status, approvalStatus: input.approvalStatus ?? "APPROVED", locationLabel: input.location?.label, address: input.location?.address, latitude: input.location?.latitude, longitude: input.location?.longitude, locationSource: input.location?.source ?? "local", locationRef: input.location?.locationRef ?? null } })),
      update: async (id, changes) => mapStore(await client.store.update({ where: { id }, data: { ...(changes.name !== undefined ? { name: changes.name } : {}), ...(changes.type !== undefined ? { type: dbStoreType[changes.type] } : {}), ...(changes.description !== undefined ? { description: changes.description } : {}), ...(changes.phone !== undefined ? { phone: changes.phone } : {}), ...(changes.image !== undefined ? { image: changes.image } : {}), ...(changes.status !== undefined ? { status: changes.status } : {}), ...(changes.approvalStatus !== undefined ? { approvalStatus: changes.approvalStatus } : {}), ...(changes.rejectionReason !== undefined ? { rejectionReason: changes.rejectionReason } : {}), ...(changes.reviewedAt !== undefined ? { reviewedAt: changes.reviewedAt } : {}), ...(changes.reviewedByUserId !== undefined ? { reviewedByUserId: changes.reviewedByUserId } : {}), ...(changes.location !== undefined ? { locationLabel: changes.location.label, address: changes.location.address, latitude: changes.location.latitude, longitude: changes.location.longitude, locationSource: changes.location.source ?? "local", locationRef: changes.location.locationRef ?? null } : {}) } })),
    },
    products: {
      list: async () => (await client.product.findMany({ include: productInclude, orderBy: { createdAt: "asc" } })).map(mapProduct),
      findById: async (id) => mapProduct(await client.product.findUnique({ where: { id }, include: productInclude })),
      create: async (input) => mapProduct(await client.product.create({ data: productData(input), include: productInclude })),
      update: async (id, input) => {
        await client.productImage.deleteMany({ where: { productId: id } });
        await client.productVariant.deleteMany({ where: { productId: id } });
        await client.productOption.deleteMany({ where: { productId: id } });
        return mapProduct(await client.product.update({ where: { id }, data: productData(input), include: productInclude }));
      },
    },
    commerce: {
      getCart: async (customerUserId) => mapCart(await client.cart.findUnique({ where: { customerUserId }, include: cartInclude })),
      ensureCart: async (customerUserId, id) => mapCart(await client.cart.upsert({ where: { customerUserId }, update: {}, create: { ...(id ? { id } : {}), customerUserId }, include: cartInclude })),
      findCartItem: async (cartId, productId, productVariantId) => client.cartItem.findFirst({ where: { cartId, productId, productVariantId: productVariantId || null } }),
      addCartItem: async (data) => client.cartItem.create({ data }),
      updateCartItem: async (id, quantity) => client.cartItem.update({ where: { id }, data: { quantity } }),
      deleteCartItem: async (id) => client.cartItem.delete({ where: { id } }),
      deleteCartItems: async (ids, cartId) => client.cartItem.deleteMany({ where: { id: { in: ids }, cartId } }),
      findCheckout: async (customerUserId, idempotencyKey) => { const row = await client.checkoutTransaction.findUnique({ where: { customerUserId_idempotencyKey: { customerUserId, idempotencyKey } }, include: { orders: { include: commerceOrderInclude } } }); return row && ({ id: row.id, idempotencyKey: row.idempotencyKey, createdAt: row.createdAt.toISOString(), orders: row.orders.map(mapOrder) }); },
      createCheckout: async (data) => client.checkoutTransaction.create({ data }),
      createOrder: async (data) => { const row = await client.commerceOrder.create({ data, include: commerceOrderInclude }); const dedupeKey = `commerce-order-created:${row.id}:${row.store.merchantUserId}`; await client.notification.create({ data: { id: compatibilityId(`notification:${dedupeKey}`), userId: row.store.merchantUserId, type: "COMMERCE_ORDER_CREATED", title: "Pesanan baru", body: `Lapak Anda menerima pesanan baru #${row.orderCode}.`, entityType: "COMMERCE_ORDER", entityId: row.id, metadata: { orderCode: row.orderCode, storeName: row.store.name }, dedupeKey, createdAt: row.createdAt } }); return mapOrder(row); },
      listOrders: async () => (await client.commerceOrder.findMany({ include: commerceOrderInclude, orderBy: { createdAt: "desc" } })).map(mapOrder),
      findOrder: async (id) => mapOrder(await client.commerceOrder.findUnique({ where: { id }, include: commerceOrderInclude })),
      listExpiredPaymentOrders: async (now) => (await client.commerceOrder.findMany({ where: { paymentMethod: "MIDTRANS", paymentStatus: "pending", paymentAttempts: { some: { status: "pending", expiresAt: { lte: now } } } }, include: commerceOrderInclude })).map(mapOrder),
      updateOrder: async (id, data) => { const row = await client.commerceOrder.update({ where: { id }, data, include: commerceOrderInclude }); if (data.fulfillmentStatus) { const status = apiFulfillment[row.fulfillmentStatus] || row.fulfillmentStatus; const type = status === "completed" ? "COMMERCE_ORDER_COMPLETED" : status === "cancelled" ? "COMMERCE_ORDER_CANCELLED" : "COMMERCE_ORDER_STATUS_CHANGED"; const dedupeKey = `commerce-order-status:${row.id}:${status}:${row.customerUserId}`; await client.notification.upsert({ where: { dedupeKey }, update: {}, create: { id: compatibilityId(`notification:${dedupeKey}`), userId: row.customerUserId, type, title: "Status pesanan diperbarui", body: `Status pesanan #${row.orderCode} menjadi ${status}.`, entityType: "COMMERCE_ORDER", entityId: row.id, metadata: { orderCode: row.orderCode, status }, dedupeKey, createdAt: row.updatedAt } }); } return mapOrder(row); },
      addActivity: async (data) => client.commerceOrderActivity.create({ data }),
      reserveSimple: async (productId, quantity) => (await client.product.updateMany({ where: { id: productId, status: "active", hasVariants: false, stock: { gte: quantity }, store: { status: "active" } }, data: { stock: { decrement: quantity } } })).count === 1,
      reserveVariant: async (productId, variantId, quantity) => (await client.productVariant.updateMany({ where: { id: variantId, productId, status: "active", stock: { gte: quantity }, product: { status: "active", store: { status: "active" } } }, data: { stock: { decrement: quantity } } })).count === 1,
      releaseSimple: async (productId, quantity) => client.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } }),
      releaseVariant: async (variantId, quantity) => client.productVariant.update({ where: { id: variantId }, data: { stock: { increment: quantity } } }),
      releaseReservation: async (id) => (await client.stockReservation.updateMany({ where: { id, status: "reserved" }, data: { status: "released", releasedAt: new Date() } })).count === 1,
      consumeReservation: async (id) => (await client.stockReservation.updateMany({ where: { id, status: "reserved" }, data: { status: "consumed", consumedAt: new Date() } })).count === 1,
    },
    settings: {
      get: async () => mapSettings(await client.platformSettings.findUnique({ where: { id: "active" } })),
      update: async (changes) => mapSettings(await client.platformSettings.update({ where: { id: "active" }, data: changes })),
    },
    finance: {
      getInitialFee: async (storeId) => mapFinance(await client.storeInitialFee.findUnique({ where: { storeId }, include: initialFeeInclude })),
      createInitialFee: async (data, installments) => { const row = await client.storeInitialFee.create({ data: { ...data, installments: { create: installments } }, include: { ...initialFeeInclude, store: true } }); await client.notification.create({ data: { userId: row.store.merchantUserId, type: "INITIAL_STORE_FEE_DUE", title: "Biaya awal lapak", body: "Tagihan biaya awal lapak telah dibuat.", entityType: "STORE", entityId: row.storeId, dedupeKey: `initial-store-fee-due:${row.id}:${row.store.merchantUserId}` } }); return mapFinance(row); },
      findInstallment: async (id) => mapFinance(await client.storeInstallment.findUnique({ where: { id }, include: { initialFee: { include: { store: true } }, penalties: true, payments: true } })),
      listReconcileInstallments: async (now) => mapFinance(await client.storeInstallment.findMany({ where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: now } }, include: { penalties: true, initialFee: { include: { store: true } } } })),
      createPenalty: async (data) => mapFinance(await client.storeInstallmentPenalty.upsert({ where: { installmentId_periodNumber: { installmentId: data.installmentId, periodNumber: data.periodNumber } }, update: {}, create: data })),
      updateInstallment: async (id, data) => mapFinance(await client.storeInstallment.update({ where: { id }, data })),
      createInstallmentPayment: async (data) => mapFinance(await client.storeInstallmentPayment.create({ data })),
      findInstallmentPayment: async (id) => mapFinance(await client.storeInstallmentPayment.findUnique({ where: { id }, include: { installment: { include: { initialFee: { include: { store: true } } } } } })),
      updateInstallmentPayment: async (id, data) => { const row = await client.storeInstallmentPayment.update({ where: { id }, data, include: { installment: { include: { initialFee: { include: { store: true } } } } } }); if (data.paymentStatus === "PAID") await client.notification.upsert({ where: { dedupeKey: `store-installment-paid:${row.installmentId}:${row.installment.initialFee.store.merchantUserId}` }, update: {}, create: { userId: row.installment.initialFee.store.merchantUserId, type: "STORE_INSTALLMENT_PAID", title: "Pembayaran angsuran berhasil", body: `Angsuran ke-${row.installment.installmentNumber} telah dibayar.`, entityType: "STORE_INSTALLMENT", entityId: row.installmentId, dedupeKey: `store-installment-paid:${row.installmentId}:${row.installment.initialFee.store.merchantUserId}` } }); return mapFinance(row); },
      updateInitialFee: async (id, data) => mapFinance(await client.storeInitialFee.update({ where: { id }, data })),
      countUnpaidInstallments: async (initialFeeId) => client.storeInstallment.count({ where: { storeInitialFeeId: initialFeeId, status: { not: "PAID" } } }),
      findPlatformTransaction: async (type, sourceEntityId) => mapFinance(await client.platformTransaction.findUnique({ where: { type_sourceEntityId: { type, sourceEntityId } } })),
      findPlatformTransactionById: async (id) => mapFinance(await client.platformTransaction.findUnique({ where: { id } })),
      updatePlatformTransaction: async (id, data) => mapFinance(await client.platformTransaction.update({ where: { id }, data })),
      createPaymentAttempt: async (data) => mapFinance(await client.paymentAttempt.create({ data })),
      cancelPendingPaymentAttempts: async (platformTransactionId) => client.paymentAttempt.updateMany({ where: { platformTransactionId, status: "pending" }, data: { status: "cancelled" } }),
      createPlatformTransaction: async (data) => mapFinance(await client.platformTransaction.create({ data })),
      createAdminFeeObligation: async (data) => { const row = await client.adminFeeObligation.create({ data, include: { store: true } }); const dedupeKey = `admin-fee-created:${row.id}:${row.store.merchantUserId}`; await client.notification.create({ data: { id: compatibilityId(`notification:${dedupeKey}`), userId: row.store.merchantUserId, type: "ADMIN_FEE_CREATED", title: "Tagihan biaya admin", body: "Tagihan biaya admin transaksi telah dibuat.", entityType: "ADMIN_FEE_OBLIGATION", entityId: row.id, dedupeKey, createdAt: row.createdAt } }); return mapFinance(row); },
      findAdminFeeByTransaction: async (platformTransactionId) => mapFinance(await client.adminFeeObligation.findUnique({ where: { platformTransactionId } })),
      listAdminFees: async (storeId) => mapFinance(await client.adminFeeObligation.findMany({ where: { storeId }, include: { platformTransaction: true, settlementItem: { include: { settlement: true } } }, orderBy: { createdAt: "desc" } })),
      findAdminFees: async (ids) => mapFinance(await client.adminFeeObligation.findMany({ where: { id: { in: ids } }, include: { store: true } })),
      createSettlement: async (data, items) => mapFinance(await client.adminFeeSettlement.create({ data: { ...data, items: { create: items } }, include: { items: true } })),
      findSettlement: async (id) => mapFinance(await client.adminFeeSettlement.findUnique({ where: { id }, include: { items: { include: { obligation: true } }, store: true } })),
      updateSettlement: async (id, data) => mapFinance(await client.adminFeeSettlement.update({ where: { id }, data })),
      payAdminFee: async (id, paidAt) => mapFinance(await client.adminFeeObligation.update({ where: { id }, data: { status: "PAID", paidAt } })),
      listStoresForAdminFeeReconcile: async (now) => mapFinance(await client.store.findMany({ where: { status: "active", adminFeeObligations: { some: { status: "OUTSTANDING", cutoffAt: { lte: now } } } } })),
      countOverdueAdminFees: async (storeId, now) => client.adminFeeObligation.count({ where: { storeId, status: "OUTSTANDING", cutoffAt: { lte: now } } }),
      createStatusHistory: async (data) => mapFinance(await client.storeStatusHistory.create({ data })),
      listContributions: async (merchantUserId) => mapFinance(await client.voluntaryContribution.findMany({ where: { merchantUserId }, orderBy: { createdAt: "desc" } })),
      createContribution: async (data) => mapFinance(await client.voluntaryContribution.create({ data })),
      findContribution: async (id) => mapFinance(await client.voluntaryContribution.findUnique({ where: { id } })),
      updateContribution: async (id, data) => mapFinance(await client.voluntaryContribution.update({ where: { id }, data })),
      monitoring: async () => mapFinance({ initialFees: await client.storeInitialFee.findMany({ include: initialFeeInclude }), adminFees: await client.adminFeeObligation.findMany({ include: { store: true, platformTransaction: true } }), settlements: await client.adminFeeSettlement.findMany({ include: { store: true, items: true }, orderBy: { createdAt: "desc" } }), suspendedStores: await client.store.findMany({ where: { status: "suspended_admin_fee" } }), contributions: await client.voluntaryContribution.findMany({ orderBy: { createdAt: "desc" } }) }),
    },
    tourism: {
      listPackages: async (where = {}) => mapFinance(await client.tourismPackage.findMany({ where, include: { store: true, schedules: { orderBy: { startAt: "asc" } } }, orderBy: { createdAt: "desc" } })),
      findPackage: async (id) => mapFinance(await client.tourismPackage.findUnique({ where: { id }, include: { store: true, schedules: { orderBy: { startAt: "asc" } } } })),
      createPackage: async (data) => mapFinance(await client.tourismPackage.create({ data, include: { store: true, schedules: true } })),
      updatePackage: async (id, data) => mapFinance(await client.tourismPackage.update({ where: { id }, data, include: { store: true, schedules: true } })),
      findSchedule: async (id) => mapFinance(await client.tourismSchedule.findUnique({ where: { id }, include: { tourismPackage: { include: { store: true } } } })),
      listSchedules: async (packageId) => mapFinance(await client.tourismSchedule.findMany({ where: { tourismPackageId: packageId }, orderBy: { startAt: "asc" } })),
      createSchedule: async (data) => mapFinance(await client.tourismSchedule.create({ data })),
      updateSchedule: async (id, data) => mapFinance(await client.tourismSchedule.update({ where: { id }, data })),
      reserveCapacity: async (id, pax) => (await client.$executeRaw`UPDATE tourism_schedules SET reserved_pax = reserved_pax + ${pax} WHERE id = ${id} AND status = 'AVAILABLE' AND reserved_pax + ${pax} <= capacity`) === 1,
      releaseCapacity: async (id, pax) => client.tourismSchedule.update({ where: { id }, data: { reservedPax: { decrement: pax } } }),
      createBooking: async (data) => { const row = await client.tourismBooking.create({ data, include: { tourismPackage: { include: { store: true } }, tourismSchedule: true, platformTransaction: true, activities: true } }); await client.notification.create({ data: { userId: row.tourismPackage.store.merchantUserId, type: "TOURISM_BOOKING_CREATED", title: "Booking wisata baru", body: `Booking #${row.bookingCode} menunggu tindak lanjut.`, entityType: "TOURISM_BOOKING", entityId: row.id, dedupeKey: `tourism-booking-created:${row.id}:${row.tourismPackage.store.merchantUserId}` } }); return mapFinance(row); },
      findBooking: async (id) => mapFinance(await client.tourismBooking.findUnique({ where: { id }, include: { tourismPackage: { include: { store: true } }, tourismSchedule: true, platformTransaction: true, activities: { orderBy: { createdAt: "asc" } }, groupRequest: { include: { offers: true } } } })),
      findBookingByGroupRequest: async (groupRequestId) => mapFinance(await client.tourismBooking.findUnique({ where: { groupRequestId }, include: { tourismPackage: { include: { store: true } }, tourismSchedule: true, platformTransaction: true, activities: true } })),
      listBookings: async (where = {}) => mapFinance(await client.tourismBooking.findMany({ where, include: { tourismPackage: { include: { store: true } }, tourismSchedule: true, platformTransaction: true, activities: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } })),
      updateBooking: async (id, data) => { const row = await client.tourismBooking.update({ where: { id }, data, include: { tourismPackage: { include: { store: true } }, tourismSchedule: true, platformTransaction: true, activities: true } }); if (data.status) await client.notification.upsert({ where: { dedupeKey: `tourism-booking-status:${row.id}:${row.status}:${row.customerUserId}` }, update: {}, create: { userId: row.customerUserId, type: row.status === "COMPLETED" ? "TOURISM_BOOKING_COMPLETED" : row.status === "CANCELLED" ? "TOURISM_BOOKING_CANCELLED" : "TOURISM_BOOKING_STATUS_CHANGED", title: "Status booking wisata diperbarui", body: `Status booking #${row.bookingCode} menjadi ${row.status}.`, entityType: "TOURISM_BOOKING", entityId: row.id, dedupeKey: `tourism-booking-status:${row.id}:${row.status}:${row.customerUserId}` } }); return mapFinance(row); },
      addActivity: async (data) => mapFinance(await client.tourismBookingActivity.create({ data })),
      createGroupRequest: async (data) => mapFinance(await client.tourismGroupRequest.create({ data, include: { tourismPackage: { include: { store: true } }, offers: true } })),
      findGroupRequest: async (id) => mapFinance(await client.tourismGroupRequest.findUnique({ where: { id }, include: { tourismPackage: { include: { store: true } }, offers: { orderBy: { createdAt: "desc" } }, booking: true } })),
      listGroupRequests: async (where = {}) => mapFinance(await client.tourismGroupRequest.findMany({ where, include: { tourismPackage: { include: { store: true } }, offers: { orderBy: { createdAt: "desc" } }, booking: true }, orderBy: { createdAt: "desc" } })),
      updateGroupRequest: async (id, data) => mapFinance(await client.tourismGroupRequest.update({ where: { id }, data })),
      createGroupOffer: async (data) => { const row = await client.tourismGroupOffer.create({ data, include: { groupRequest: true } }); await client.notification.create({ data: { userId: row.groupRequest.customerUserId, type: "TOURISM_GROUP_OFFER_CREATED", title: "Penawaran wisata tersedia", body: "Merchant telah mengirim penawaran untuk permintaan grup Anda.", entityType: "TOURISM_GROUP_OFFER", entityId: row.id, dedupeKey: `tourism-offer-created:${row.id}:${row.groupRequest.customerUserId}` } }); return mapFinance(row); },
      findGroupOffer: async (id) => mapFinance(await client.tourismGroupOffer.findUnique({ where: { id }, include: { groupRequest: { include: { tourismPackage: { include: { store: true } }, booking: true } } } })),
      updateGroupOffer: async (id, data) => mapFinance(await client.tourismGroupOffer.update({ where: { id }, data })),
    },
    liveIn: {
      listProfiles: async (where = {}) => mapFinance(await client.liveInProfile.findMany({ where, include: { store: true, mealPlan: true, rooms: { include: { mealOverride: true }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } })),
      findProfile: async (id) => mapFinance(await client.liveInProfile.findUnique({ where: { id }, include: { store: true, mealPlan: true, rooms: { include: { mealOverride: true }, orderBy: { createdAt: "asc" } } } })),
      findProfileByStore: async (storeId) => mapFinance(await client.liveInProfile.findUnique({ where: { storeId }, include: { store: true, mealPlan: true, rooms: { include: { mealOverride: true }, orderBy: { createdAt: "asc" } } } })),
      createProfile: async (data) => mapFinance(await client.liveInProfile.create({ data, include: { store: true, mealPlan: true, rooms: true } })),
      updateProfile: async (id, data) => mapFinance(await client.liveInProfile.update({ where: { id }, data, include: { store: true, mealPlan: true, rooms: { include: { mealOverride: true } } } })),
      upsertMealPlan: async (liveInProfileId, data) => mapFinance(await client.liveInMealPlan.upsert({ where: { liveInProfileId }, create: { liveInProfileId, ...data }, update: data })),
      findRoom: async (id) => mapFinance(await client.liveInRoom.findUnique({ where: { id }, include: { profile: { include: { store: true, mealPlan: true } }, mealOverride: true } })),
      findRooms: async (ids) => mapFinance(await client.liveInRoom.findMany({ where: { id: { in: ids } }, include: { profile: { include: { store: true, mealPlan: true } }, mealOverride: true } })),
      createRoom: async (data) => mapFinance(await client.liveInRoom.create({ data, include: { mealOverride: true } })),
      updateRoom: async (id, data) => mapFinance(await client.liveInRoom.update({ where: { id }, data, include: { mealOverride: true } })),
      upsertRoomMealOverride: async (roomId, data) => data === null ? client.liveInRoomMealOverride.deleteMany({ where: { roomId } }) : mapFinance(await client.liveInRoomMealOverride.upsert({ where: { roomId }, create: { roomId, ...data }, update: data })),
      reservedRoomIds: async (roomIds, dates) => client.liveInRoomNightReservation.findMany({ where: { liveInRoomId: { in: roomIds }, stayDate: { in: dates } }, select: { liveInRoomId: true } }).then((rows) => [...new Set(rows.map((row) => row.liveInRoomId))]),
      createBooking: async (data) => { const row = await client.liveInBooking.create({ data, include: { profile: { include: { store: true } }, rooms: { include: { room: true } }, platformTransaction: true, activities: true } }); await client.notification.create({ data: { userId: row.profile.store.merchantUserId, type: "LIVEIN_BOOKING_CREATED", title: "Booking Live In baru", body: `Booking #${row.bookingCode} menunggu tindak lanjut.`, entityType: "LIVEIN_BOOKING", entityId: row.id, dedupeKey: `livein-booking-created:${row.id}:${row.profile.store.merchantUserId}` } }); return mapFinance(row); },
      findBooking: async (id) => mapFinance(await client.liveInBooking.findUnique({ where: { id }, include: { profile: { include: { store: true } }, rooms: { include: { room: true } }, platformTransaction: true, activities: { orderBy: { createdAt: "asc" } }, groupRequest: { include: { offers: { include: { rooms: { include: { room: true } } } } } } } })),
      findBookingByGroupRequest: async (groupRequestId) => mapFinance(await client.liveInBooking.findUnique({ where: { groupRequestId }, include: { profile: { include: { store: true } }, rooms: true, platformTransaction: true } })),
      listBookings: async (where = {}) => mapFinance(await client.liveInBooking.findMany({ where, include: { profile: { include: { store: true } }, rooms: { include: { room: true } }, platformTransaction: true, activities: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } })),
      updateBooking: async (id, data) => { const row = await client.liveInBooking.update({ where: { id }, data, include: { profile: { include: { store: true } }, rooms: true, platformTransaction: true, activities: true } }); if (data.bookingStatus) await client.notification.upsert({ where: { dedupeKey: `livein-booking-status:${row.id}:${row.bookingStatus}:${row.customerUserId}` }, update: {}, create: { userId: row.customerUserId, type: row.bookingStatus === "COMPLETED" ? "LIVEIN_BOOKING_COMPLETED" : row.bookingStatus === "CANCELLED" ? "LIVEIN_BOOKING_CANCELLED" : "LIVEIN_BOOKING_STATUS_CHANGED", title: "Status booking Live In diperbarui", body: `Status booking #${row.bookingCode} menjadi ${row.bookingStatus}.`, entityType: "LIVEIN_BOOKING", entityId: row.id, dedupeKey: `livein-booking-status:${row.id}:${row.bookingStatus}:${row.customerUserId}` } }); return mapFinance(row); },
      releaseReservations: async (bookingId) => client.liveInRoomNightReservation.deleteMany({ where: { liveInBookingId: bookingId } }),
      addActivity: async (data) => mapFinance(await client.liveInBookingActivity.create({ data })),
      createGroupRequest: async (data) => mapFinance(await client.liveInGroupRequest.create({ data, include: { profile: { include: { store: true } }, offers: true } })),
      findGroupRequest: async (id) => mapFinance(await client.liveInGroupRequest.findUnique({ where: { id }, include: { profile: { include: { store: true, mealPlan: true } }, offers: { include: { rooms: { include: { room: true } } }, orderBy: { createdAt: "desc" } }, booking: true } })),
      listGroupRequests: async (where = {}) => mapFinance(await client.liveInGroupRequest.findMany({ where, include: { profile: { include: { store: true } }, offers: { include: { rooms: { include: { room: true } } }, orderBy: { createdAt: "desc" } }, booking: true }, orderBy: { createdAt: "desc" } })),
      updateGroupRequest: async (id, data) => mapFinance(await client.liveInGroupRequest.update({ where: { id }, data })),
      createGroupOffer: async (data, rooms) => { const row = await client.liveInGroupOffer.create({ data: { ...data, rooms: { create: rooms } }, include: { rooms: { include: { room: true } }, groupRequest: true } }); await client.notification.create({ data: { userId: row.groupRequest.customerUserId, type: "LIVEIN_GROUP_OFFER_CREATED", title: "Penawaran Live In tersedia", body: "Merchant telah mengirim penawaran Live In untuk grup Anda.", entityType: "LIVEIN_GROUP_OFFER", entityId: row.id, dedupeKey: `livein-offer-created:${row.id}:${row.groupRequest.customerUserId}` } }); return mapFinance(row); },
      findGroupOffer: async (id) => mapFinance(await client.liveInGroupOffer.findUnique({ where: { id }, include: { rooms: { include: { room: true } }, groupRequest: { include: { profile: { include: { store: true, mealPlan: true } }, booking: true } } } })),
      updateGroupOffer: async (id, data) => mapFinance(await client.liveInGroupOffer.update({ where: { id }, data })),
    },
    reviews: {
      findProductSource: async (id) => mapFinance(await client.commerceOrderItem.findUnique({ where: { id }, include: { order: { include: { store: true } }, product: true, reviewTarget: true } })),
      findProductSourceByOrder: async (orderId, productId) => mapFinance(await client.commerceOrderItem.findFirst({ where: { orderId, productId }, include: { order: { include: { store: true } }, product: true, reviewTarget: true } })),
      findTourismSource: async (id) => mapFinance(await client.tourismBooking.findUnique({ where: { id }, include: { tourismPackage: { include: { store: true } }, reviewTarget: true } })),
      findLiveInSource: async (id) => mapFinance(await client.liveInBooking.findUnique({ where: { id }, include: { profile: { include: { store: true } }, reviewTarget: true } })),
      create: async (data) => mapFinance(await client.review.create({ data, include: reviewInclude })),
      find: async (id) => mapFinance(await client.review.findUnique({ where: { id }, include: reviewInclude })),
      list: async (where = {}) => mapFinance(await client.review.findMany({ where, include: reviewInclude, orderBy: { createdAt: "desc" } })),
      update: async (id, data) => mapFinance(await client.review.update({ where: { id }, data, include: reviewInclude })),
      upsertReply: async (reviewId, authorUserId, text, repliedAt) => mapFinance(await client.reviewReply.upsert({ where: { reviewId }, create: { reviewId, authorUserId, text, ...(repliedAt ? { createdAt: repliedAt, updatedAt: repliedAt } : {}) }, update: { authorUserId, text, ...(repliedAt ? { updatedAt: repliedAt } : {}) } })),
    },
    notifications: {
      create: async (data) => mapFinance(await client.notification.create({ data })),
      findByDedupeKey: async (dedupeKey) => mapFinance(await client.notification.findUnique({ where: { dedupeKey } })),
      findById: async (id) => mapFinance(await client.notification.findUnique({ where: { id } })),
      list: async ({ where, skip, take }) => mapFinance(await client.notification.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })),
      count: async (where) => client.notification.count({ where }),
      markRead: async (id, userId, readAt) => (await client.notification.updateMany({ where: { id, userId }, data: { readAt } })).count,
      markAllRead: async (userId, readAt) => (await client.notification.updateMany({ where: { userId, readAt: null }, data: { readAt } })).count,
    },
    delivery: {
      profile: async (userId) => mapFinance(await client.courierProfile.findUnique({ where: { userId }, include: { user: { include: { roles: { include: { role: true } } } } } })),
      upsertProfile: async (userId, data) => mapFinance(await client.courierProfile.upsert({ where: { userId }, update: data, create: { userId, ...data }, include: { user: true } })),
      listCouriers: async () => mapFinance(await client.courierProfile.findMany({ include: { user: { include: { roles: { include: { role: true } } } } }, orderBy: { createdAt: "asc" } })),
      availability: async (courierUserId) => mapFinance(await client.courierAvailability.findMany({ where: { courierUserId }, orderBy: { startAt: "desc" } })),
      overlappingAvailability: async (courierUserId, startAt, endAt, excludeId) => client.courierAvailability.findFirst({ where: { courierUserId, ...(excludeId ? { id: { not: excludeId } } : {}), startAt: { lt: endAt || new Date("9999-12-31") }, OR: [{ endAt: null }, { endAt: { gt: startAt } }] } }),
      createAvailability: async (data) => mapFinance(await client.courierAvailability.create({ data })),
      endAvailability: async (id, courierUserId, endAt) => mapFinance(await client.courierAvailability.updateMany({ where: { id, courierUserId, endAt: null }, data: { endAt } })),
      eligibleOrders: async () => mapFinance(await client.commerceOrder.findMany({ where: { fulfillmentStatus: { in: ["confirmed", "processing", "readyForPickup"] }, paymentStatus: { in: ["paid", "pending"] }, deliveryFee: { gt: 0 }, store: { status: "active" } }, include: commerceOrderInclude, orderBy: { createdAt: "asc" } })),
      lockOrder: async (commerceOrderId) => client.$queryRaw`SELECT id FROM commerce_orders WHERE id=${commerceOrderId} FOR UPDATE`,
      activeAssignment: async (commerceOrderId) => mapFinance(await client.deliveryBatchOrder.findFirst({ where: { commerceOrderId, status: { in: ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] }, batch: { status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } } }, include: { batch: true } })),
      activeCourierCount: async (courierUserId, deliveryDate) => client.deliveryBatchOrder.count({ where: { batch: { courierUserId, deliveryDate, status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } }, status: { in: ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] } } }),
      createBatch: async (data, orderIds, assignmentIds = []) => mapFinance(await client.deliveryBatch.create({ data: { ...data, orders: { create: orderIds.map((commerceOrderId, index) => ({ ...(assignmentIds[index] ? { id: assignmentIds[index] } : {}), commerceOrderId, pickupSequence: index + 1, deliverySequence: index + 1, status: "WAITING_PICKUP" })) } }, include: { courier: true, orders: { include: { commerceOrder: { include: commerceOrderInclude } } } } })),
      addActivity: async (data) => mapFinance(await client.deliveryActivity.create({ data })),
      listBatches: async (where = {}) => mapFinance(await client.deliveryBatch.findMany({ where, include: { courier: true, orders: { include: { commerceOrder: { include: commerceOrderInclude } } } }, orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }] })),
      merchantAssignments: async (merchantUserId) => mapFinance(await client.deliveryBatchOrder.findMany({ where: { commerceOrder: { store: { merchantUserId } } }, include: { batch: { include: { courier: true } }, commerceOrder: { include: commerceOrderInclude }, }, orderBy: { createdAt: "desc" } })),
      batch: async (id) => mapFinance(await client.deliveryBatch.findUnique({ where: { id }, include: { courier: true, orders: { include: { commerceOrder: { include: commerceOrderInclude }, } }, } })),
      assignment: async (commerceOrderId) => mapFinance(await client.deliveryBatchOrder.findFirst({ where: { commerceOrderId, batch: { status: { in: ["PLANNED", "READY", "IN_PROGRESS"] } } }, include: { batch: true, commerceOrder: { include: commerceOrderInclude } }, orderBy: { createdAt: "desc" } })),
      latestAssignment: async (commerceOrderId) => mapFinance(await client.deliveryBatchOrder.findFirst({ where: { commerceOrderId }, include: { batch: true, commerceOrder: { include: commerceOrderInclude } }, orderBy: { createdAt: "desc" } })),
      batchOrder: async (deliveryBatchId, commerceOrderId) => mapFinance(await client.deliveryBatchOrder.findUnique({ where: { deliveryBatchId_commerceOrderId: { deliveryBatchId, commerceOrderId } }, include: { batch: true, commerceOrder: { include: commerceOrderInclude } } })),
      createBatchOrder: async (data) => mapFinance(await client.deliveryBatchOrder.create({ data, include: { batch: true, commerceOrder: { include: commerceOrderInclude } } })),
      updateBatch: async (id, data) => mapFinance(await client.deliveryBatch.update({ where: { id }, data })),
      updateAssignment: async (id, data) => mapFinance(await client.deliveryBatchOrder.update({ where: { id }, data })),
      pickupConfirmation: async (data) => mapFinance(await client.pickupConfirmation.create({ data })),
      proof: async (commerceOrderId) => mapFinance(await client.deliveryProof.findUnique({ where: { commerceOrderId } })),
      createProof: async (data) => mapFinance(await client.deliveryProof.create({ data })),
      activities: async (commerceOrderId) => mapFinance(await client.deliveryActivity.findMany({ where: { commerceOrderId }, orderBy: { createdAt: "asc" } })),
    },
    chats: {
      findByOpenKey: async (openKey) => mapFinance(await client.conversation.findUnique({ where: { openKey }, include: { participants: { include: { user: true } }, context: { include: { store: true, product: true, commerceOrder: true, tourismBooking: true, liveInBooking: true } }, messages: { include: { sender: true, reads: true }, orderBy: { createdAt: "asc" } }, closedBy: true } })),
      find: async (id) => mapFinance(await client.conversation.findUnique({ where: { id }, include: { participants: { include: { user: true } }, context: { include: { store: true, product: true, commerceOrder: true, tourismBooking: true, liveInBooking: true } }, messages: { include: { sender: true, reads: true }, orderBy: { createdAt: "asc" } }, closedBy: true } })),
      list: async ({ where, skip, take }) => mapFinance(await client.conversation.findMany({ where, skip, take, include: { participants: { include: { user: true } }, context: { include: { store: true, product: true, commerceOrder: true, tourismBooking: true, liveInBooking: true } }, messages: { take: 1, orderBy: { createdAt: "desc" }, include: { sender: true, reads: true } }, closedBy: true }, orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }] })),
      count: async (where) => client.conversation.count({ where }),
      create: async (data) => mapFinance(await client.conversation.create({ data, include: { participants: { include: { user: true } }, context: { include: { store: true, product: true, commerceOrder: true, tourismBooking: true, liveInBooking: true } }, messages: { include: { sender: true, reads: true } }, closedBy: true } })),
      createMessage: async (conversationId, senderUserId, message, attachmentUrl, id, createdAt) => mapFinance(await client.message.create({ data: { ...(id ? { id } : {}), ...(createdAt ? { createdAt } : {}), conversationId, senderUserId, message, attachmentUrl }, include: { sender: true, reads: true } })),
      update: async (id, data) => mapFinance(await client.conversation.update({ where: { id }, data })),
      messages: async (conversationId, skip, take) => mapFinance(await client.message.findMany({ where: { conversationId }, skip, take, include: { sender: true, reads: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })),
      messageCount: async (conversationId) => client.message.count({ where: { conversationId } }),
      markRead: async (conversationId, userId, readAt = new Date()) => client.$executeRaw`INSERT IGNORE INTO message_reads (message_id,user_id,read_at) SELECT id, ${userId}, ${readAt} FROM messages WHERE conversation_id=${conversationId} AND sender_user_id<>${userId}`,
      deleteDraft: async (id) => { await client.conversationContext.deleteMany({ where: { conversationId: id } }); await client.conversationParticipant.deleteMany({ where: { conversationId: id } }); return client.conversation.delete({ where: { id } }); },
    },
    audits: {
      append: async (input) => {
        const data = { entityType: input.entityType, entityId: input.entityId, actorId: input.actorId || null, actorRole: input.actorRole || null, activityType: input.activityType, previousStatus: input.previousStatus || null, nextStatus: input.nextStatus || null, description: input.description, reason: input.reason || null, isSystem: Boolean(input.isSystem), ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}) };
        try { return await client.auditRecord.create({ data }); } catch (error) {
          // audit_records memiliki FK ke tabel pengguna lama. Di database baru (tanpa data lama) aktornya hanya ada di tabel final,
          // sehingga FK gagal dan aksi Admin (mis. buat kurir) ikut gagal. Catat tanpa FK dan simpan ID aktor di deskripsi.
          if (error?.code !== "P2003" || !data.actorId) throw error;
          return client.auditRecord.create({ data: { ...data, actorId: null, description: `${data.description} [aktor: ${data.actorId}]` } });
        }
      },
      list: async () => client.auditRecord.findMany({ orderBy: { createdAt: "asc" } }),
    },
    transaction: (work) => client.$transaction((tx) => work(createPrismaRepository(tx))),
    health: async () => { await client.$queryRaw`SELECT 1`; return true; },
  };
  return repository;
}

module.exports = { createPrismaRepository };
