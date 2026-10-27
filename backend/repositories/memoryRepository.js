const crypto = require("node:crypto");

const clone = (value) => value == null ? value : structuredClone(value);

function createMemoryRepository(seed = {}) {
  const state = {
    users: clone(seed.users || []),
    stores: clone(seed.stores || []),
    products: clone(seed.products || []),
    audits: clone(seed.audits || []),
    sessions: clone(seed.sessions || []),
    settings: { deliveryBaseFee: 6000, deliveryRatePerKm: 1500, deliveryOrderCutoffTime: "16:00", deliveryDispatchTime: "17:00", maxDailyDeliveries: 30, tourismApprovalTimeoutHours: 6, initialStoreFeeAmount: 100000, installmentFullEnabled: true, installment3MonthsEnabled: true, installment6MonthsEnabled: true, installmentLateInterestPercent: 2, adminFeeType: "percentage", adminFeeValue: 5, adminFeeCutoffDay: 1, adminFeeGraceTime: "12:00", suspendStoreForOutstandingAdminFee: true, taxPercent: 11, voluntaryContributionEnabled: true, prideTransactionValueWeight: 35, prideTransactionCountWeight: 25, prideRatingWeight: 20, prideCompletionRateWeight: 20, prideLeaderboardSize: 7, ...(seed.settings || {}) },
    carts: clone(seed.carts || []),
    checkouts: clone(seed.checkouts || []),
    orders: clone(seed.orders || []),
    initialFees: clone(seed.initialFees || []), installments: clone(seed.installments || []), penalties: clone(seed.penalties || []), installmentPayments: clone(seed.installmentPayments || []), platformTransactions: clone(seed.platformTransactions || []), adminFees: clone(seed.adminFees || []), settlements: clone(seed.settlements || []), statusHistory: clone(seed.statusHistory || []), contributions: clone(seed.contributions || []),
  };
  const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
  const hydratedProduct = (product) => product && ({ ...clone(product), store: clone(state.stores.find((store) => store.id === product.storeId)) });
  const hydratedCart = (cart) => cart && ({ ...clone(cart), items: cart.items.map((item) => { const product = hydratedProduct(state.products.find((row) => row.id === item.productId)); return { ...clone(item), product, variant: clone(product?.variants?.find((row) => row.id === item.productVariantId)) || null }; }) });
  const hydratedOrder = (order) => order && ({ ...clone(order), storeName: state.stores.find((store) => store.id === order.storeId)?.name, orderNumber: order.orderCode });
  // Sama seperti repository final: biaya admin yang sedang diajukan/dibayar diberi settlementItem.
  const withSettlementItem = (fee) => { const paid = state.settlements.find((row) => row.paymentStatus === "PAID" && row.items.some((item) => item.adminFeeObligationId === fee.id)); const pending = state.settlements.find((row) => row.paymentStatus === "PENDING" && row.items.some((item) => item.adminFeeObligationId === fee.id)); const found = paid || pending; return { ...fee, settlementItem: found ? { settlement: { id: found.id, paymentStatus: found.paymentStatus } } : null }; };
  const repository = {
    users: {
      findById: (userId) => clone(state.users.find((item) => item.id === userId)),
      findByEmail: (email) => clone(state.users.find((item) => item.email === email)),
      findFirstByRole: (role) => clone(state.users.find((item) => item.roles.includes(role) && item.status === "active")),
      list: () => clone([...state.users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))),
      create: (input) => { const row = clone({ ...input, id: input.id || id("USR") }); state.users.push(row); return clone(row); },
      update: (userId, changes) => { const index = state.users.findIndex((item) => item.id === userId); if (index < 0) return null; state.users[index] = { ...state.users[index], ...clone(changes), updatedAt: new Date().toISOString() }; return clone(state.users[index]); },
      addRole: (userId, role) => { const user = state.users.find((item) => item.id === userId); if (!user) return null; if (!user.roles.includes(role)) user.roles.push(role); user.updatedAt = new Date().toISOString(); return clone(user); },
    },
    sessions: {
      create: ({ tokenHash, userId, expiresAt }) => { const row = { id: id("SESSION"), tokenHash, userId, expiresAt: new Date(expiresAt).toISOString(), revokedAt: null }; state.sessions.push(row); return clone(row); },
      findActiveByTokenHash: (tokenHash) => { const session = state.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && new Date(item.expiresAt) > new Date()); const user = session && state.users.find((item) => item.id === session.userId); return session && user ? { ...clone(session), user: clone(user) } : null; },
      revokeByTokenHash: (tokenHash) => { const session = state.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt); if (session) session.revokedAt = new Date().toISOString(); return Boolean(session); },
      revokeAllForUser: (userId) => { let count = 0; for (const session of state.sessions) if (session.userId === userId && !session.revokedAt) { session.revokedAt = new Date().toISOString(); count += 1; } return { count }; },
    },
    stores: {
      list: () => clone(state.stores),
      listApplications: () => clone([...state.stores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))),
      findApplication: (storeId) => clone(state.stores.find((item) => item.id === storeId)),
      findById: (storeId) => clone(state.stores.find((item) => item.id === storeId)),
      create: (input) => { const row = clone({ ...input, id: input.id || id("STORE") }); state.stores.push(row); return clone(row); },
      update: (storeId, changes) => { const index = state.stores.findIndex((item) => item.id === storeId); if (index < 0) return null; state.stores[index] = { ...state.stores[index], ...clone(changes) }; return clone(state.stores[index]); },
    },
    products: {
      list: () => state.products.map(hydratedProduct),
      findById: (productId) => hydratedProduct(state.products.find((item) => item.id === productId)),
      create: (input) => { const row = clone({ ...input, id: input.id || id("PRODUCT"), createdAt: input.createdAt || new Date().toISOString(), updatedAt: input.updatedAt || new Date().toISOString(), images: input.images.map((image) => ({ ...image, id: id("IMAGE") })), variantGroups: input.variantGroups.map((group) => ({ ...group, id: id("OPTION") })), variants: input.variants.map((variant) => ({ ...variant, id: id("VARIANT") })) }); state.products.push(row); return clone(row); },
      update: (productId, input) => { const index = state.products.findIndex((item) => item.id === productId); if (index < 0) return null; const existing = state.products[index]; state.products[index] = clone({ ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString(), images: input.images.map((image) => ({ ...image, id: image.id || id("IMAGE") })), variantGroups: input.variantGroups.map((group) => ({ ...group, id: group.id || id("OPTION") })), variants: input.variants.map((variant) => ({ ...variant, id: variant.id || id("VARIANT") })) }); return clone(state.products[index]); },
    },
    commerce: {
      getCart: (customerUserId) => hydratedCart(state.carts.find((cart) => cart.customerUserId === customerUserId)),
      ensureCart: (customerUserId) => { let cart = state.carts.find((row) => row.customerUserId === customerUserId); if (!cart) { const now = new Date().toISOString(); cart = { id: id("CART"), customerUserId, createdAt: now, updatedAt: now, items: [] }; state.carts.push(cart); } return hydratedCart(cart); },
      findCartItem: (cartId, productId, productVariantId) => clone(state.carts.find((cart) => cart.id === cartId)?.items.find((item) => item.productId === productId && (item.productVariantId || null) === (productVariantId || null))),
      addCartItem: (data) => { const cart = state.carts.find((row) => row.id === data.cartId); const now = new Date().toISOString(); const item = { ...clone(data), id: id("CARTITEM"), createdAt: now, updatedAt: now }; cart.items.push(item); cart.updatedAt = now; return clone(item); },
      updateCartItem: (itemId, nextQuantity) => { for (const cart of state.carts) { const item = cart.items.find((row) => row.id === itemId); if (item) { item.quantity = nextQuantity; item.updatedAt = new Date().toISOString(); return clone(item); } } return null; },
      deleteCartItem: (itemId) => { for (const cart of state.carts) { const index = cart.items.findIndex((row) => row.id === itemId); if (index >= 0) return clone(cart.items.splice(index, 1)[0]); } return null; },
      deleteCartItems: (ids, cartId) => { const cart = state.carts.find((row) => row.id === cartId); if (!cart) return { count: 0 }; const before = cart.items.length; cart.items = cart.items.filter((row) => !ids.includes(row.id)); return { count: before - cart.items.length }; },
      findCheckout: (customerUserId, idempotencyKey) => { const checkout = state.checkouts.find((row) => row.customerUserId === customerUserId && row.idempotencyKey === idempotencyKey); return checkout && ({ ...clone(checkout), orders: state.orders.filter((order) => order.checkoutTransactionId === checkout.id).map(hydratedOrder) }); },
      createCheckout: (data) => { const row = { ...clone(data), id: id("CHECKOUT"), createdAt: new Date().toISOString() }; state.checkouts.push(row); return clone(row); },
      createOrder: (data) => { const now = new Date().toISOString(); const nested = (value) => value?.create ? (Array.isArray(value.create) ? value.create : [value.create]) : []; const row = { ...clone(data), id: id("ORDER"), createdAt: now, updatedAt: now, items: nested(data.items).map((item) => ({ ...item, id: id("ORDERITEM") })), reservations: nested(data.reservations).map((item) => ({ ...item, id: id("RESERVATION"), reservedAt: now, releasedAt: null, consumedAt: null })), activities: nested(data.activities).map((item) => ({ ...item, id: id("ACTIVITY"), orderId: null, createdAt: now })), paymentAttempts: nested(data.paymentAttempts).map((item) => ({ ...item, id: id("PAYMENT"), createdAt: now, updatedAt: now, paidAt: null })) }; delete row.items.create; delete row.reservations.create; delete row.activities.create; delete row.paymentAttempts.create; row.activities.forEach((activity) => { activity.orderId = row.id; }); row.reservations.forEach((reservation) => { reservation.orderId = row.id; }); row.items.forEach((item) => { item.orderId = row.id; }); state.orders.push(row); return hydratedOrder(row); },
      listOrders: (filter = {}) => {
        const since = filter.since ? new Date(filter.since).getTime() : null;
        const rows = state.orders.filter((order) => (!filter.customerUserId || order.customerUserId === filter.customerUserId)
          && (Array.isArray(filter.storeIds) ? filter.storeIds.includes(order.storeId) : !filter.storeId || order.storeId === filter.storeId)
          && (since === null || new Date(order.createdAt).getTime() >= since));
        const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return (filter.limit ? sorted.slice(0, filter.limit) : sorted).map(hydratedOrder);
      },
      findOrder: (orderId) => hydratedOrder(state.orders.find((row) => row.id === orderId)),
      listExpiredPaymentOrders: (now) => state.orders.filter((order) => order.paymentMethod === "MIDTRANS" && order.paymentStatus === "pending" && order.paymentAttempts.some((attempt) => attempt.status === "pending" && attempt.expiresAt && new Date(attempt.expiresAt) <= now)).map(hydratedOrder),
      updateOrder: (orderId, changes) => { const order = state.orders.find((row) => row.id === orderId); if (!order) return null; Object.assign(order, clone(changes), { updatedAt: new Date().toISOString() }); return hydratedOrder(order); },
      addActivity: (data) => { const order = state.orders.find((row) => row.id === data.orderId); const activity = { ...clone(data), id: id("ACTIVITY"), createdAt: new Date().toISOString() }; order.activities.push(activity); return clone(activity); },
      reserveSimple: (productId, amount) => { const product = state.products.find((row) => row.id === productId); if (!product || product.status !== "active" || product.hasVariants || product.stock < amount) return false; product.stock -= amount; return true; },
      reserveVariant: (productId, variantId, amount) => { const product = state.products.find((row) => row.id === productId); const variant = product?.variants?.find((row) => row.id === variantId); if (!product || product.status !== "active" || !variant || variant.status !== "active" || variant.stock < amount) return false; variant.stock -= amount; return true; },
      releaseSimple: (productId, amount) => { const product = state.products.find((row) => row.id === productId); product.stock += amount; return hydratedProduct(product); },
      releaseVariant: (variantId, amount) => { const product = state.products.find((row) => row.variants?.some((variant) => variant.id === variantId)); const variant = product.variants.find((row) => row.id === variantId); variant.stock += amount; return clone(variant); },
      releaseReservation: (reservationId) => { for (const order of state.orders) { const reservation = order.reservations.find((row) => row.id === reservationId); if (reservation && reservation.status === "reserved") { reservation.status = "released"; reservation.releasedAt = new Date().toISOString(); return true; } } return false; },
      consumeReservation: (reservationId) => { for (const order of state.orders) { const reservation = order.reservations.find((row) => row.id === reservationId); if (reservation && reservation.status === "reserved") { reservation.status = "consumed"; reservation.consumedAt = new Date().toISOString(); return true; } } return false; },
    },
    settings: {
      get: () => clone(state.settings),
      update: (changes) => { state.settings = { ...state.settings, ...clone(changes) }; return clone(state.settings); },
    },
    finance: {
      getInitialFee: (storeId) => { const fee = state.initialFees.find((row) => row.storeId === storeId); return fee && clone({ ...fee, installments: state.installments.filter((row) => row.storeInitialFeeId === fee.id).sort((a,b) => a.installmentNumber-b.installmentNumber).map((row) => ({ ...row, penalties: state.penalties.filter((item) => item.installmentId === row.id), payments: state.installmentPayments.filter((item) => item.installmentId === row.id) })) }); },
      createInitialFee: (data, installments) => { const fee = { id: id("FEE"), ...clone(data), createdAt: new Date().toISOString(), completedAt: null }; state.initialFees.push(fee); for (const item of installments) state.installments.push({ id: id("INSTALLMENT"), storeInitialFeeId: fee.id, ...clone(item), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); return repository.finance.getInitialFee(data.storeId); },
      findInstallment: (installmentId) => { const row = state.installments.find((item) => item.id === installmentId); const fee = row && state.initialFees.find((item) => item.id === row.storeInitialFeeId); const store = fee && state.stores.find((item) => item.id === fee.storeId); return row && clone({ ...row, initialFee: { ...fee, store }, penalties: state.penalties.filter((item) => item.installmentId === row.id), payments: state.installmentPayments.filter((item) => item.installmentId === row.id) }); },
      listReconcileInstallments: (now) => state.installments.filter((row) => row.status !== "PAID" && new Date(row.dueAt) < now).map((row) => repository.finance.findInstallment(row.id)),
      createPenalty: (data) => { if (state.penalties.some((row) => row.installmentId === data.installmentId && row.periodNumber === data.periodNumber)) throw new Error("duplicate penalty"); const row = { id: id("PENALTY"), ...clone(data) }; state.penalties.push(row); return clone(row); },
      updateInstallment: (installmentId, data) => { const row = state.installments.find((item) => item.id === installmentId); Object.assign(row, clone(data)); return clone(row); },
      createInstallmentPayment: (data) => { const row = { id: id("PAYMENT"), ...clone(data), createdAt: new Date().toISOString(), paidAt: null }; state.installmentPayments.push(row); return clone(row); },
      findInstallmentPayment: (paymentId) => { const row = state.installmentPayments.find((item) => item.id === paymentId); return row && clone({ ...row, installment: repository.finance.findInstallment(row.installmentId) }); },
      updateInstallmentPayment: (paymentId, data) => { const row = state.installmentPayments.find((item) => item.id === paymentId); Object.assign(row, clone(data)); return clone(row); },
      updateInitialFee: (feeId, data) => { const row = state.initialFees.find((item) => item.id === feeId); Object.assign(row, clone(data)); return clone(row); },
      countUnpaidInstallments: (feeId) => state.installments.filter((row) => row.storeInitialFeeId === feeId && row.status !== "PAID").length,
      findPlatformTransaction: (type, sourceEntityId) => clone(state.platformTransactions.find((row) => row.type === type && row.sourceEntityId === sourceEntityId)),
      createPlatformTransaction: (data) => { if (state.platformTransactions.some((row) => row.sourceEntityId === data.sourceEntityId)) throw new Error("duplicate transaction"); const row = { id: id("TX"), ...clone(data) }; state.platformTransactions.push(row); return clone(row); },
      createAdminFeeObligation: (data) => { if (state.adminFees.some((row) => row.platformTransactionId === data.platformTransactionId)) throw new Error("duplicate admin fee"); const row = { id: id("ADMINFEE"), ...clone(data), createdAt: new Date().toISOString(), paidAt: null }; state.adminFees.push(row); return clone(row); },
      listAdminFees: (storeId) => clone(state.adminFees.filter((row) => row.storeId === storeId).map(withSettlementItem)),
      findAdminFees: (ids) => clone(state.adminFees.filter((row) => ids.includes(row.id)).map((row) => ({ ...withSettlementItem(row), store: state.stores.find((item) => item.id === row.storeId) }))),
      cancelPendingPaymentAttempts: (targetId) => { let count = 0; for (const row of state.installmentPayments) if (row.installmentId === targetId && row.paymentStatus === "PENDING") { row.paymentStatus = "CANCELLED"; count += 1; } return { count }; },
      createSettlement: (data, items) => { const row = { id: id("SETTLEMENT"), ...clone(data), items: items.map((item) => ({ id: id("SETTLEMENTITEM"), ...clone(item) })), createdAt: new Date().toISOString(), paidAt: null }; state.settlements.push(row); return clone(row); },
      findSettlement: (settlementId) => { const row = state.settlements.find((item) => item.id === settlementId); return row && clone({ ...row, store: state.stores.find((item) => item.id === row.storeId), items: row.items.map((item) => ({ ...item, obligation: state.adminFees.find((fee) => fee.id === item.adminFeeObligationId) })) }); },
      updateSettlement: (settlementId, data) => { const row = state.settlements.find((item) => item.id === settlementId); Object.assign(row, clone(data)); return clone(row); },
      payAdminFee: (feeId, paidAt, meta = {}) => { const row = state.adminFees.find((item) => item.id === feeId); Object.assign(row, { status: "PAID", paidAt, ...(meta.method ? { paymentMethod: meta.method, provider: "ADMIN" } : {}) }); return clone(row); },
      listStoresForAdminFeeReconcile: (now) => clone(state.stores.filter((store) => store.status === "active" && state.adminFees.some((fee) => fee.storeId === store.id && fee.status === "OUTSTANDING" && new Date(fee.cutoffAt) <= now))),
      countOverdueAdminFees: (storeId, now) => state.adminFees.filter((fee) => fee.storeId === storeId && fee.status === "OUTSTANDING" && new Date(fee.cutoffAt) <= now).length,
      createStatusHistory: (data) => { const row = { id: id("STATUS"), ...clone(data), createdAt: new Date().toISOString() }; state.statusHistory.push(row); return clone(row); },
      listContributions: (merchantUserId) => clone(state.contributions.filter((row) => row.merchantUserId === merchantUserId)),
      createContribution: (data) => { const row = { id: id("CONTRIBUTION"), ...clone(data), createdAt: new Date().toISOString(), paidAt: null }; state.contributions.push(row); return clone(row); },
      findContribution: (contributionId) => clone(state.contributions.find((row) => row.id === contributionId)),
      updateContribution: (contributionId, data) => { const row = state.contributions.find((item) => item.id === contributionId); Object.assign(row, clone(data)); return clone(row); },
      monitoring: () => clone({ initialFees: state.initialFees.map((fee) => repository.finance.getInitialFee(fee.storeId)), adminFees: state.adminFees.map(withSettlementItem), settlements: state.settlements, suspendedStores: state.stores.filter((row) => row.status === "suspended_admin_fee"), contributions: state.contributions }),
    },
    audits: {
      append: (input) => { const row = Object.freeze({ ...clone(input), id: input.id || id("AUD"), createdAt: input.createdAt || new Date().toISOString() }); state.audits.push(row); return clone(row); },
      list: () => clone(state.audits),
    },
    transaction: async (work) => { const snapshot = clone(state); try { return await work(repository); } catch (error) { for (const key of Object.keys(state)) state[key] = clone(snapshot[key]); throw error; } },
    health: async () => true,
  };
  return repository;
}

module.exports = { createMemoryRepository };
