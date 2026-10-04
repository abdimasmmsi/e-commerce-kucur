const { createHash, randomUUID } = require("node:crypto");

const db = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toUpperCase();
const lower = (value) => value == null ? value : String(value).toLowerCase();
const iso = (value) => value instanceof Date ? value.toISOString() : value ?? null;
const number = (value) => value == null ? value : Number(value);
const compatibilityId = (key) => { const hex = createHash("sha256").update(key).digest("hex").slice(0, 32); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`; };
const deep = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(deep);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deep(item)]));
  return value;
};
const payment = (row) => row && ({ id: row.id, installmentId: row.merchantFeeId, merchantFeeId: row.merchantFeeId, commerceOrderId: row.commerceOrderId, amount: number(row.amount), paymentMethod: row.method, paymentStatus: row.status, provider: row.provider, providerReference: row.providerReference, providerResponse: row.providerResponse, paidAt: iso(row.paidAt), expiresAt: iso(row.expiredAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });
const penalty = (row) => ({ id: row.id, installmentId: row.parentFeeId, periodNumber: row.installmentNumber, percentageSnapshot: number(row.rateSnapshot), baseOutstandingAmount: number(row.baseAmountSnapshot), penaltyAmount: number(row.amount), appliedAt: iso(row.createdAt), status: row.status });
const installment = (row) => {
  const penalties = (row.children || []).filter((item)=>item.feeType === "LATE_PENALTY");
  const penaltyOutstanding = penalties.filter((item)=>item.status !== "PAID" && item.status !== "CANCELLED").reduce((sum,item)=>sum+number(item.amount),0);
  const parent = row.parent;
  return { id: row.id, storeInitialFeeId: row.parentFeeId, installmentNumber: row.installmentNumber, principalAmount: number(row.amount), principalOutstanding: row.status === "PAID" ? 0 : number(row.amount), penaltyOutstanding, dueAt: iso(row.dueAt), status: row.status, paidAt: iso(row.paidAt), penalties: penalties.map(penalty), payments: (row.paymentAttempts || []).map(payment), initialFee: parent ? { id: parent.id, storeId: parent.storeId, status: parent.status, store: parent.store ? mapStore(parent.store) : undefined } : undefined };
};
const contract = (row) => row && ({ id: row.id, storeId: row.storeId, initialAmountSnapshot: number(row.amount), planType: row.installmentCount === 1 ? "FULL" : row.installmentCount === 3 ? "THREE_MONTHS" : "SIX_MONTHS", installmentCount: row.installmentCount, status: row.status, completedAt: iso(row.paidAt), installments: (row.children || []).filter((item)=>item.feeType === "INITIAL_STORE_INSTALLMENT").map(installment).sort((a,b)=>a.installmentNumber-b.installmentNumber), store: row.store ? mapStore(row.store) : undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });
const mapStore = (row) => row && ({ ...deep(row), status: lower(row.status), type: "product" });
const adminFee = (row) => row && ({ id: row.id, platformTransactionId: row.commerceOrderId, storeId: row.storeId, feeTypeSnapshot: lower(row.calculationType), feeValueSnapshot: number(row.rateSnapshot), baseTransactionAmount: number(row.baseAmountSnapshot), feeAmount: number(row.amount), billingYear: row.createdAt?.getUTCFullYear(), billingMonth: row.createdAt ? row.createdAt.getUTCMonth()+1 : null, cutoffAt: iso(row.dueAt), status: row.status, paidAt: iso(row.paidAt), store: row.store ? mapStore(row.store) : undefined, platformTransaction: row.order ? orderTransaction(row.order) : undefined, settlementItem: (row.paymentAttempts || []).some((item)=>item.status === "PAID") ? { settlement: { paymentStatus: "PAID" } } : null });
const contribution = (row) => row && ({ ...deep(row), amount: number(row.amount), paymentMethod: row.paymentMethod, paymentStatus: row.status, provider: row.provider, providerReference: row.providerReference, paidAt: iso(row.paidAt) });
const orderTransaction = (row) => row && ({ id: row.id, storeId: row.storeId, customerUserId: row.customerUserId, type: "COMMERCE", sourceEntityId: row.id, commerceOrderId: row.id, subtotal: number(row.subtotal), taxPercentSnapshot: number(row.taxPercentSnapshot), taxAmount: number(row.taxAmount), grandTotal: number(row.grandTotal), paymentStatus: lower(row.paymentStatus), transactionStatus: row.completedAt ? "COMPLETED" : "PENDING", completedAt: iso(row.completedAt), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) });

function createFinalFinanceRepository(client) {
  const installmentInclude = { parent: { include: { store: true } }, children: true, paymentAttempts: { orderBy: { createdAt: "asc" } } };
  const contractInclude = { store: true, children: { include: { children: true, paymentAttempts: { orderBy: { createdAt: "asc" } } }, orderBy: { installmentNumber: "asc" } } };
  return {
    getInitialFee: async (storeId) => contract(await client.targetMerchantFee.findFirst({ where: { storeId, feeType: "INITIAL_STORE_FEE" }, include: contractInclude })),
    createInitialFee: async (data, rows) => {
      const store = await client.targetStore.findUniqueOrThrow({ where: { id: data.storeId } });
      const id = data.id || randomUUID();
      return contract(await client.targetMerchantFee.create({ data: { id, merchantUserId: store.merchantUserId, storeId: data.storeId, feeType: "INITIAL_STORE_FEE", amount: data.initialAmountSnapshot, installmentCount: data.installmentCount, status: db(data.status), children: { create: rows.map((item)=>({ id: item.id || randomUUID(), merchantUserId: store.merchantUserId, storeId: data.storeId, feeType: "INITIAL_STORE_INSTALLMENT", amount: item.principalAmount, installmentNumber: item.installmentNumber, installmentCount: data.installmentCount, dueAt: item.dueAt, status: db(item.status) })) } }, include: contractInclude }));
    },
    findInstallment: async (id) => installment(await client.targetMerchantFee.findFirst({ where: { id, feeType: "INITIAL_STORE_INSTALLMENT" }, include: installmentInclude })),
    listReconcileInstallments: async (now) => (await client.targetMerchantFee.findMany({ where: { feeType: "INITIAL_STORE_INSTALLMENT", status: { in: ["PENDING","OVERDUE"] }, dueAt: { lt: now } }, include: installmentInclude })).map(installment),
    createPenalty: async (data) => {
      const item = await client.targetMerchantFee.findUniqueOrThrow({ where: { id: data.installmentId }, include: { parent: true } });
      const existing = await client.targetMerchantFee.findFirst({ where: { parentFeeId: item.id, feeType: "LATE_PENALTY", installmentNumber: data.periodNumber } });
      if (existing) return penalty(existing);
      return penalty(await client.targetMerchantFee.create({ data: { id: data.id || randomUUID(), merchantUserId: item.merchantUserId, storeId: item.storeId, parentFeeId: item.id, feeType: "LATE_PENALTY", calculationType: "PERCENTAGE", rateSnapshot: data.percentageSnapshot, baseAmountSnapshot: data.baseOutstandingAmount, amount: data.penaltyAmount, installmentNumber: data.periodNumber, dueAt: data.appliedAt, status: "OUTSTANDING", createdAt: data.appliedAt } }));
    },
    updateInstallment: async (id, data) => installment(await client.targetMerchantFee.update({ where: { id }, data: { ...(data.status ? { status: db(data.status) } : {}), ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}) }, include: installmentInclude })),
    createInstallmentPayment: async (data) => payment(await client.targetPaymentAttempt.create({ data: { id: data.id || randomUUID(), commerceOrderId: null, merchantFeeId: data.installmentId, provider: db(data.provider || "MANUAL"), method: data.paymentMethod || "MANUAL", providerReference: data.providerReference || null, amount: data.amount, status: db(data.paymentStatus || "PENDING"), paidAt: data.paidAt || null } })),
    findInstallmentPayment: async (id) => { const row = await client.targetPaymentAttempt.findUnique({ where: { id }, include: { merchantFee: { include: installmentInclude } } }); return row && { ...payment(row), installment: installment(row.merchantFee) }; },
    updateInstallmentPayment: async (id, data) => { const row = await client.targetPaymentAttempt.update({ where: { id }, data: { ...(data.paymentStatus ? { status: db(data.paymentStatus === "REJECTED" ? "FAILED" : data.paymentStatus) } : {}), ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}) }, include: { merchantFee: { include: installmentInclude } } }); return { ...payment(row), installment: installment(row.merchantFee) }; },
    updateInitialFee: async (id, data) => contract(await client.targetMerchantFee.update({ where: { id }, data: { ...(data.status ? { status: db(data.status) } : {}), ...(data.completedAt !== undefined ? { paidAt: data.completedAt } : {}) }, include: contractInclude })),
    countUnpaidInstallments: async (parentFeeId) => client.targetMerchantFee.count({ where: { parentFeeId, feeType: "INITIAL_STORE_INSTALLMENT", status: { not: "PAID" } } }),
    findPlatformTransaction: async (type, sourceEntityId) => { if (type !== "COMMERCE") return null; const fee = await client.targetMerchantFee.findFirst({ where: { commerceOrderId: sourceEntityId, feeType: "ADMIN_FEE" }, include: { order: true } }); return fee ? orderTransaction(fee.order) : null; },
    findPlatformTransactionById: async (id) => orderTransaction(await client.targetCommerceOrder.findUnique({ where: { id } })),
    createPlatformTransaction: async (data) => orderTransaction(await client.targetCommerceOrder.findUnique({ where: { id: data.commerceOrderId || data.sourceEntityId } })) || { ...data, id: data.commerceOrderId || data.sourceEntityId },
    updatePlatformTransaction: async (id, data) => orderTransaction(await client.targetCommerceOrder.update({ where: { id }, data: { ...(data.paymentStatus ? { paymentStatus: db(data.paymentStatus) } : {}), ...(data.completedAt ? { completedAt: data.completedAt } : {}) } })),
    createPaymentAttempt: async (data) => payment(await client.targetPaymentAttempt.create({ data: { id: data.id || randomUUID(), commerceOrderId: data.commerceOrderId || data.orderId || null, merchantFeeId: data.merchantFeeId || null, provider: db(data.provider), method: data.method || data.paymentMethod, providerReference: data.providerReference || null, amount: data.amount, status: db(data.status || data.paymentStatus || "PENDING"), providerResponse: data.providerResponse || undefined, paidAt: data.paidAt || null, expiredAt: data.expiredAt || data.expiresAt || null } })),
    cancelPendingPaymentAttempts: async (targetId) => client.targetPaymentAttempt.updateMany({ where: { OR: [{ commerceOrderId: targetId }, { merchantFeeId: targetId }], status: "PENDING" }, data: { status: "CANCELLED" } }),
    createAdminFeeObligation: async (data) => {
      const order = await client.targetCommerceOrder.findUniqueOrThrow({ where: { id: data.platformTransactionId }, include: { store: true } });
      const row = await client.targetMerchantFee.create({ data: { id: data.id || randomUUID(), merchantUserId: order.store.merchantUserId, storeId: data.storeId, commerceOrderId: order.id, feeType: "ADMIN_FEE", calculationType: db(data.feeTypeSnapshot), rateSnapshot: data.feeValueSnapshot, baseAmountSnapshot: data.baseTransactionAmount, amount: data.feeAmount, dueAt: data.cutoffAt, status: db(data.status), ...(data.createdAt ? { createdAt: data.createdAt } : {}) }, include: { store: true, order: true, paymentAttempts: true } });
      const dedupeKey = `admin-fee-created:${row.id}:${order.store.merchantUserId}`;
      await client.targetNotification.create({ data: { id: compatibilityId(`notification:${dedupeKey}`), userId: order.store.merchantUserId, type: "ADMIN_FEE_CREATED", title: "Tagihan biaya admin", body: "Tagihan biaya admin transaksi telah dibuat.", entityType: "MERCHANT_FEE", entityId: row.id, dedupeKey, createdAt: row.createdAt } });
      return adminFee(row);
    },
    findAdminFeeByTransaction: async (commerceOrderId) => adminFee(await client.targetMerchantFee.findFirst({ where: { commerceOrderId, feeType: "ADMIN_FEE" }, include: { store: true, order: true, paymentAttempts: true } })),
    listAdminFees: async (storeId) => (await client.targetMerchantFee.findMany({ where: { storeId, feeType: "ADMIN_FEE" }, include: { store: true, order: true, paymentAttempts: true }, orderBy: { createdAt: "desc" } })).map(adminFee),
    findAdminFees: async (ids) => (await client.targetMerchantFee.findMany({ where: { id: { in: ids }, feeType: "ADMIN_FEE" }, include: { store: true, order: true, paymentAttempts: true } })).map(adminFee),
    createSettlement: async (data, items) => {
      const id = data.id || randomUUID();
      const attempts = [];
      for (const item of items) attempts.push(await client.targetPaymentAttempt.create({ data: { id: randomUUID(), merchantFeeId: item.adminFeeObligationId, commerceOrderId: null, provider: db(data.provider || "MANUAL"), method: data.paymentMethod || "MANUAL", providerReference: id, amount: item.amount, status: db(data.paymentStatus || "PENDING") }, include: { merchantFee: true } }));
      return settlement(id, data, attempts);
    },
    findSettlement: async (id) => { const attempts = await client.targetPaymentAttempt.findMany({ where: { providerReference: id }, include: { merchantFee: { include: { store: true, order: true, paymentAttempts: true } } } }); if (!attempts.length) return null; return settlement(id, { storeId: attempts[0].merchantFee.storeId, merchantUserId: attempts[0].merchantFee.merchantUserId }, attempts); },
    updateSettlement: async (id, data) => { await client.targetPaymentAttempt.updateMany({ where: { providerReference: id }, data: { ...(data.paymentStatus ? { status: db(data.paymentStatus === "REJECTED" ? "FAILED" : data.paymentStatus) } : {}), ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}) } }); const attempts = await client.targetPaymentAttempt.findMany({ where: { providerReference: id }, include: { merchantFee: { include: { store: true, order: true, paymentAttempts: true } } } }); return settlement(id, data, attempts); },
    payAdminFee: async (id, paidAt) => adminFee(await client.targetMerchantFee.update({ where: { id }, data: { status: "PAID", paidAt }, include: { store: true, order: true, paymentAttempts: true } })),
    listStoresForAdminFeeReconcile: async (now) => (await client.targetStore.findMany({ where: { status: "ACTIVE", fees: { some: { feeType: "ADMIN_FEE", status: "OUTSTANDING", dueAt: { lte: now } } } } })).map(mapStore),
    countOverdueAdminFees: async (storeId, now) => client.targetMerchantFee.count({ where: { storeId, feeType: "ADMIN_FEE", status: "OUTSTANDING", dueAt: { lte: now } } }),
    createStatusHistory: async (data) => ({ id: null, ...deep(data), archived: true }),
    listContributions: async (merchantUserId) => (await client.targetMerchantFee.findMany({ where: { merchantUserId, feeType: "VOLUNTARY_CONTRIBUTION" }, orderBy: { createdAt: "desc" } })).map(contribution),
    createContribution: async (data) => contribution(await client.targetMerchantFee.create({ data: { id: data.id || randomUUID(), merchantUserId: data.merchantUserId, feeType: "VOLUNTARY_CONTRIBUTION", amount: data.amount, status: db(data.paymentStatus || "PENDING"), paymentMethod: data.paymentMethod || "MANUAL", provider: data.provider || "MANUAL", providerReference: data.providerReference || null, paidAt: data.paidAt || null } })),
    findContribution: async (id) => contribution(await client.targetMerchantFee.findFirst({ where: { id, feeType: "VOLUNTARY_CONTRIBUTION" } })),
    updateContribution: async (id, data) => contribution(await client.targetMerchantFee.update({ where: { id }, data: { ...(data.paymentStatus ? { status: db(data.paymentStatus === "REJECTED" ? "CANCELLED" : data.paymentStatus) } : {}), ...(data.paidAt !== undefined ? { paidAt: data.paidAt } : {}) } })),
    monitoring: async () => ({ initialFees: (await client.targetMerchantFee.findMany({ where: { feeType: "INITIAL_STORE_FEE" }, include: contractInclude })).map(contract), adminFees: (await client.targetMerchantFee.findMany({ where: { feeType: "ADMIN_FEE" }, include: { store: true, order: true, paymentAttempts: true } })).map(adminFee), settlements: [], suspendedStores: (await client.targetStore.findMany({ where: { status: "SUSPENDED_ADMIN_FEE" } })).map(mapStore), contributions: (await client.targetMerchantFee.findMany({ where: { feeType: "VOLUNTARY_CONTRIBUTION" } })).map(contribution) }),
  };
}

function settlement(id, data, attempts) {
  const total = attempts.reduce((sum,item)=>sum+number(item.amount),0);
  const statuses = attempts.map((item)=>item.status);
  const paymentStatus = statuses.every((value)=>value === "PAID") ? "PAID" : statuses.some((value)=>value === "FAILED" || value === "CANCELLED") ? "REJECTED" : "PENDING";
  const store = attempts[0]?.merchantFee?.store;
  return { id, storeId: data.storeId || attempts[0]?.merchantFee?.storeId, merchantUserId: data.merchantUserId || attempts[0]?.merchantFee?.merchantUserId, totalAmount: total, paymentMethod: attempts[0]?.method || data.paymentMethod, provider: attempts[0]?.provider || data.provider, providerReference: id, paymentStatus, paidAt: iso(attempts.find((item)=>item.paidAt)?.paidAt), items: attempts.map((item)=>({ adminFeeObligationId: item.merchantFeeId, amount: number(item.amount), obligation: adminFee(item.merchantFee) })), store: store ? mapStore(store) : undefined };
}

module.exports = { createFinalFinanceRepository };
