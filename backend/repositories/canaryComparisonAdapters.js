const { normalize } = require("./dualReadRepository");

const LEGACY_ONLY_SETTINGS = new Set([
  "adminFeeGraceTime", "deliveryDispatchTime", "deliveryOrderCutoffTime",
  "prideCompletionRateWeight", "prideLeaderboardSize", "prideRatingWeight",
  "prideTransactionCountWeight", "prideTransactionValueWeight",
  "tourismApprovalTimeoutHours", "dispatchTime", "orderCutoffTime", "updatedByUserId",
]);

const canonicalStore = (store) => {
  if (!store) return store;
  const value = structuredClone(store);
  if (value.location) {
    delete value.location.label;
    delete value.location.source;
  }
  if (value.approvalStatus === "REJECTED") value.status = "rejected";
  else if (typeof value.status === "string") value.status = value.status.replaceAll("-", "_");
  return value;
};

const canonicalProduct = (product) => {
  if (!product) return product;
  const value = structuredClone(product);
  if (value.store) value.store = canonicalStore(value.store);
  for (const group of value.variantGroups || []) delete group.id;
  for (const variant of value.variants || []) delete variant.combinationKey;
  return value;
};

const upperStatus = (value) => {
  const result = String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toUpperCase();
  return result === "ON_DELIVERY" ? "IN_DELIVERY" : result;
};
const number = (value) => value == null ? value : Number(value);
const canonicalOrder = (row) => ({
  id: row.id, storeId: row.storeId, customerUserId: row.customerUserId,
  orderCode: row.orderCode || row.orderNumber,
  fulfillmentStatus: upperStatus(row.fulfillmentStatus), paymentStatus: upperStatus(row.paymentStatus),
  subtotal: number(row.productTotal ?? row.subtotal), deliveryFee: number(row.deliveryFee), courierTip: number(row.courierTip),
  grandTotal: number(row.totalAmount ?? row.grandTotal), deliveryRate: number(row.deliveryRateSnapshot ?? row.deliveryRatePerKmSnapshot),
  distance: row.distanceKm == null && row.deliveryDistanceKm == null ? null : Number(number(row.distanceKm ?? row.deliveryDistanceKm).toFixed(2)), recipientName: row.recipientName,
  recipientPhone: row.recipientPhone, deliveryAddress: row.deliveryAddress,
  items: (row.items || []).map((item) => ({ id: item.id, productId: item.productId, productVariantId: item.productVariantId,
    productName: item.productName ?? item.productNameSnapshot, sku: item.sku ?? item.skuSnapshot,
    unitPrice: number(item.unitPrice), quantity: item.quantity, subtotal: number(item.subtotal) })),
});

const canonicalFee = (row) => ({ id: row.id, storeId: row.storeId, feeAmount: number(row.feeAmount), status: upperStatus(row.status), paidAt: row.paidAt || null });
const canonicalInitialFee = (row) => ({
  id: row.id, storeId: row.storeId, initialAmountSnapshot: number(row.initialAmountSnapshot), planType: row.planType,
  installmentCount: row.installmentCount, status: upperStatus(row.status), completedAt: row.completedAt || null,
  installments: (row.installments || []).map((item) => ({ id: item.id, installmentNumber: item.installmentNumber,
    principalAmount: number(item.principalAmount), status: upperStatus(item.status), dueAt: item.dueAt,
    paidAt: item.paidAt || null, penalties: (item.penalties || []).map((penalty) => ({
      id: penalty.id, penaltyAmount: number(penalty.penaltyAmount),
    })) })),
});

const canonicalBatch = (row) => ({
  id: row.id, courierUserId: row.courierUserId, deliveryDate: row.deliveryDate, cutoffAt: row.cutoffAt,
  dispatchAt: row.dispatchAt, status: row.status, startedAt: row.startedAt, completedAt: row.completedAt,
  orders: (row.orders || []).map((item) => ({ id: item.id, commerceOrderId: item.commerceOrderId,
    pickupSequence: item.pickupSequence, deliverySequence: item.deliverySequence, status: item.status })),
});

const defaultCanaryNormalizers = {
  "settings.get": (value) => {
    const result = structuredClone(normalize(value));
    for (const key of LEGACY_ONLY_SETTINGS) delete result?.[key];
    return result;
  },
  "stores.list": (value) => normalize(value.filter((store) => store.type === "product")).map(canonicalStore),
  "stores.listApplications": (value) => normalize(value.filter((store) => store.type === "product")).map(canonicalStore),
  "stores.findApplication": (value) => canonicalStore(normalize(value)),
  "stores.findById": (value) => canonicalStore(normalize(value)),
  "products.list": (value) => normalize(value).map(canonicalProduct),
  "products.findById": (value) => canonicalProduct(normalize(value)),
  "reviews.list": (value) => normalize(value.filter((row) => row.productTarget || row.commerceOrderItemId).map((row) => ({
    id: row.id,
    commerceOrderItemId: row.productTarget?.commerceOrderItemId || row.commerceOrderItemId,
    customerUserId: row.customerUserId,
    storeId: row.storeId,
    rating: row.rating,
    comment: row.comment,
    photoUrls: row.photos?.map((photo) => photo.url) || row.photoUrls || [],
    merchantReply: row.reply?.text || row.merchantReply || null,
    repliedByUserId: row.reply?.authorUserId || row.repliedByUserId || null,
    visibilityStatus: String(row.visibility || row.visibilityStatus).toUpperCase(),
  }))),
  "chats.find": (value) => normalize(value && ({
    id: value.id, type: value.type, status: value.status, openKey: value.openKey, subject: value.subject,
    users: (value.participants?.map((row) => row.userId) || [value.requesterUserId, value.counterpartUserId]).filter(Boolean).sort(),
    storeId: value.context?.storeId ?? value.storeId ?? null,
    productId: value.context?.productId ?? value.productId ?? null,
    commerceOrderId: value.context?.commerceOrderId ?? value.commerceOrderId ?? null,
    messages: (value.messages || []).map((message) => ({
      id: message.id, senderUserId: message.senderUserId, message: message.message, attachmentUrl: message.attachmentUrl,
      readAt: message.readAt || message.reads?.find((read) => read.userId !== message.senderUserId)?.readAt || null,
    })),
  })),
  "notifications.list": (value) => normalize(value.filter((row) => !["TOURISM_GROUP_REQUEST", "TOURISM_BOOKING", "LIVE_IN_BOOKING"].includes(row.entityType)).map((row) => ({
    ...row,
    entityType: row.entityType === "ADMIN_FEE_OBLIGATION" ? "MERCHANT_FEE" : row.entityType,
  }))),
  "commerce.listOrders": (value) => normalize(value.map(canonicalOrder)),
  "commerce.findOrder": (value) => normalize(value && canonicalOrder(value)),
  "finance.monitoring": (value) => normalize({
    initialFees: (value.initialFees || []).map(canonicalInitialFee),
    adminFees: (value.adminFees || []).map(canonicalFee),
    contributions: (value.contributions || []).map((row) => ({ id: row.id, storeId: row.storeId, amount: number(row.amount), status: upperStatus(row.status) })),
    settlements: (value.settlements || []).map((row) => ({ id: row.id, storeId: row.storeId, amount: number(row.amount ?? row.totalAmount), status: upperStatus(row.status) })),
    suspendedStoreIds: (value.suspendedStores || []).map((row) => row.id).sort(),
  }),
  "delivery.listBatches": (value) => normalize(value.map(canonicalBatch)),
};

module.exports = { defaultCanaryNormalizers };
