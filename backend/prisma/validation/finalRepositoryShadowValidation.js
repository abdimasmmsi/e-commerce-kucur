const { Prisma } = require("@prisma/client");
const { getPrisma, disconnectPrisma } = require("../../config/prisma");
const { createPrismaRepository } = require("../../repositories/prismaRepository");
const { createFinalPrismaRepository } = require("../../repositories/finalPrismaRepository");

const client = getPrisma();
const legacy = createPrismaRepository(client);
const target = createFinalPrismaRepository(client);
const result = { generatedAt: new Date().toISOString(), mode: "READ_ONLY", domains: [] };
const iso = (value) => value ? new Date(value).toISOString() : null;
const num = (value) => value == null ? value : Number(value);
const stable = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return Number(value);
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};
const record = (domain, operation, left, right, expectedNormalizedDifferences = 0) => {
  const legacyValue = stable(left); const finalValue = stable(right);
  const matches = JSON.stringify(legacyValue) === JSON.stringify(finalValue);
  result.domains.push({ domain, operation, recordsCompared: Array.isArray(legacyValue) ? legacyValue.length : legacyValue == null ? 0 : 1, matches, expectedNormalizedDifferences, unexpectedMismatches: matches ? 0 : 1, ...(matches ? {} : { legacy: legacyValue, final: finalValue }) });
};
const sort = (rows) => [...rows].sort((a, b) => String(a.id || a.userId).localeCompare(String(b.id || b.userId)));
const upper = (value) => String(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toUpperCase();
const statusFinal = (value) => upper(value) === "ON_DELIVERY" ? "IN_DELIVERY" : upper(value);

async function validateAuth() {
  const source = await client.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { id: "asc" } });
  const final = await client.targetUser.findMany({ include: { roles: true }, orderBy: { id: "asc" } });
  record("AUTH", "users.all", source.map((row) => ({ id: row.id, email: row.email, passwordHash: row.passwordHash, fullName: row.fullName, phone: row.phone, isActive: row.status === "active", language: row.language, theme: row.theme, roles: row.roles.map((item) => upper(item.role.name)).sort() })), final.map((row) => ({ id: row.id, email: row.email, passwordHash: row.passwordHash, fullName: row.fullName, phone: row.phone, isActive: row.isActive, language: row.language, theme: row.theme, roles: row.roles.map((item) => item.role).sort() })));
  const sessions = await client.session.findMany({ orderBy: { id: "asc" } });
  const targetSessions = await client.targetSession.findMany({ orderBy: { id: "asc" } });
  const pick = (row) => ({ id: row.id, userId: row.userId, tokenHash: row.tokenHash, expiresAt: iso(row.expiresAt), revokedAt: iso(row.revokedAt), createdAt: iso(row.createdAt) });
  record("AUTH", "sessions.all", sessions.map(pick), targetSessions.map(pick));
  for (const row of source) {
    const a = await legacy.users.findByEmail(row.email); const b = await target.users.findByEmail(row.email);
    record("AUTH", `users.findByEmail:${row.id}`, { id: a.id, email: a.email, passwordHash: a.passwordHash, status: a.status, language: a.language, theme: a.theme, roles: [...a.roles].sort() }, { id: b.id, email: b.email, passwordHash: b.passwordHash, status: b.status, language: b.language, theme: b.theme, roles: [...b.roles].sort() });
  }
}

async function validateStoresProductsCarts() {
  const stores = (await legacy.stores.list()).filter((row) => row.type === "product"); const finalStores = await target.stores.list();
  const storePick = (row) => ({ id: row.id, merchantUserId: row.merchantUserId, name: row.name, description: row.description || "", phone: row.phone, image: row.image || null, status: row.approvalStatus === "REJECTED" ? "REJECTED" : upper(row.status), rejectionReason: row.rejectionReason, reviewedByUserId: row.reviewedByUserId, reviewedAt: iso(row.reviewedAt), address: row.location?.address ?? null, latitude: num(row.location?.latitude), longitude: num(row.location?.longitude) });
  record("STORE", "stores.list", sort(stores.map(storePick)), sort(finalStores.map(storePick)), 1);
  const products = await legacy.products.list(); const finalProducts = await target.products.list();
  const productPick = (row) => ({ id: row.id, storeId: row.storeId, name: row.name, description: row.description || "", category: row.category, status: upper(row.status), hasVariants: row.hasVariants, price: num(row.price), stock: row.stock, images: row.images.map((item) => ({ url: item.url, storageKey: item.storageKey, position: item.position, isPrimary: item.isPrimary })), options: row.variantGroups.map((item) => ({ name: item.name, values: item.options })), variants: row.variants.map((item) => ({ id: item.id, sku: item.sku, options: item.options, price: num(item.price), stock: item.stock, status: upper(item.status), image: item.image })).sort((a,b)=>a.id.localeCompare(b.id)) });
  record("PRODUCT", "products.list", sort(products.map(productPick)), sort(finalProducts.map(productPick)));
  const carts = await client.cart.findMany({ include: { items: true }, orderBy: { id: "asc" } }); const targetCarts = await client.targetCart.findMany({ include: { items: true }, orderBy: { id: "asc" } });
  const cartPick = (row) => ({ id: row.id, customerUserId: row.customerUserId, items: row.items.map((item) => ({ id: item.id, productId: item.productId, productVariantId: item.productVariantId, quantity: item.quantity })) });
  record("CART", "carts.all", carts.map(cartPick), targetCarts.map(cartPick));
}

async function validateCommercePaymentFinance() {
  const orders = await client.commerceOrder.findMany({ include: { items: true, checkoutTransaction: true }, orderBy: { id: "asc" } });
  const collisionRanks = new Map();
  for (const row of [...orders].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
    const key = `${row.customerUserId}|${row.checkoutTransaction.idempotencyKey}|${row.storeId}`;
    if (!collisionRanks.has(key)) collisionRanks.set(key, []);
    collisionRanks.get(key).push(row.id);
  }
  const normalizedKey = (row) => { const ids = collisionRanks.get(`${row.customerUserId}|${row.checkoutTransaction.idempotencyKey}|${row.storeId}`); const rank = ids.indexOf(row.id); return ids.length > 1 && rank > 0 ? `${row.checkoutTransaction.idempotencyKey.slice(0, 87)}:legacy:${row.id.slice(-12)}` : row.checkoutTransaction.idempotencyKey; };
  const final = await client.targetCommerceOrder.findMany({ include: { items: true }, orderBy: { id: "asc" } });
  const sourcePick = (row) => ({ id: row.id, checkoutGroupId: row.checkoutTransactionId, checkoutIdempotencyKey: normalizedKey(row), storeId: row.storeId, customerUserId: row.customerUserId, orderCode: row.orderCode, fulfillmentStatus: statusFinal(row.fulfillmentStatus), paymentStatus: upper(row.paymentStatus), subtotal: num(row.productTotal), deliveryFee: num(row.deliveryFee), courierTip: num(row.courierTip), grandTotal: num(row.totalAmount), deliveryRate: num(row.deliveryRateSnapshot), distance: row.distanceKm == null ? null : Number(new Prisma.Decimal(row.distanceKm).toDecimalPlaces(2)), recipientName: row.recipientName, recipientPhone: row.recipientPhone, address: row.deliveryAddress, items: row.items.map((item) => ({ id: item.id, productId: item.productId, variantId: item.productVariantId, name: item.productName, sku: item.sku, unitPrice: num(item.unitPrice), quantity: item.quantity, subtotal: num(item.subtotal) })) });
  const targetPick = (row) => ({ id: row.id, checkoutGroupId: row.checkoutGroupId, checkoutIdempotencyKey: row.checkoutIdempotencyKey, storeId: row.storeId, customerUserId: row.customerUserId, orderCode: row.orderCode, fulfillmentStatus: row.fulfillmentStatus, paymentStatus: row.paymentStatus, subtotal: num(row.subtotal), deliveryFee: num(row.deliveryFee), courierTip: num(row.courierTip), grandTotal: num(row.grandTotal), deliveryRate: num(row.deliveryRatePerKmSnapshot), distance: num(row.deliveryDistanceKm), recipientName: row.recipientName, recipientPhone: row.recipientPhone, address: row.deliveryAddress, items: row.items.map((item) => ({ id: item.id, productId: item.productId, variantId: item.productVariantId, name: item.productNameSnapshot, sku: item.skuSnapshot, unitPrice: num(item.unitPrice), quantity: item.quantity, subtotal: num(item.subtotal) })) });
  record("COMMERCE", "orders.all", orders.map(sourcePick), final.map(targetPick), 6);
  const sourcePaymentCount = await client.paymentAttempt.count(); const installmentPaymentCount = await client.storeInstallmentPayment.count(); const paymentCount = await client.targetPaymentAttempt.count();
  const xor = await client.targetPaymentAttempt.count({ where: { OR: [{ commerceOrderId: null, merchantFeeId: null }, { commerceOrderId: { not: null }, merchantFeeId: { not: null } }] } });
  record("PAYMENT", "payments.retained-count-xor", { retained: sourcePaymentCount + installmentPaymentCount - 2, xor: 0 }, { retained: paymentCount, xor });
  const fees = await client.targetMerchantFee.findMany();
  const collectible = Number(fees.filter((row) => !(row.feeType === "INITIAL_STORE_FEE" && row.installmentCount > 0)).reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0)).toDecimalPlaces(2));
  const [initial, installments, penalties, admin, contributions] = await Promise.all([client.storeInitialFee.findMany(), client.storeInstallment.findMany(), client.storeInstallmentPenalty.findMany(), client.adminFeeObligation.findMany(), client.voluntaryContribution.findMany()]);
  const sourceCollectible = Number([...installments.map((row) => row.principalAmount), ...penalties.map((row) => row.penaltyAmount), ...admin.map((row) => row.feeAmount), ...contributions.map((row) => row.amount)].reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0)).toDecimalPlaces(2));
  record("FINANCE", "merchant-fees.economic-state", { count: initial.length + installments.length + penalties.length + admin.length + contributions.length, collectible: sourceCollectible, initial: initial.length, installments: installments.length, penalties: penalties.length, admin: admin.length, contribution: contributions.length }, { count: fees.length, collectible, initial: fees.filter((r)=>r.feeType==="INITIAL_STORE_FEE").length, installments: fees.filter((r)=>r.feeType==="INITIAL_STORE_INSTALLMENT").length, penalties: fees.filter((r)=>r.feeType==="LATE_PENALTY").length, admin: fees.filter((r)=>r.feeType==="ADMIN_FEE").length, contribution: fees.filter((r)=>r.feeType==="VOLUNTARY_CONTRIBUTION").length });
}

async function validateDeliveryReviewChatNotification() {
  const courier = await client.courierProfile.findMany({ orderBy: { userId: "asc" } }); const targetCourier = await client.targetCourierProfile.findMany({ orderBy: { userId: "asc" } });
  record("DELIVERY", "courier.profiles", courier.map((r)=>({userId:r.userId,maxActiveDeliveries:r.maxActiveDeliveries,isActive:r.isActive})), targetCourier.map((r)=>({userId:r.userId,maxActiveDeliveries:r.maxActiveDeliveries,isActive:r.isActive})));
  const batches = await client.deliveryBatch.findMany({ include: { orders: true }, orderBy: { id: "asc" } }); const targetBatches = await client.targetDeliveryBatch.findMany({ include: { orders: true }, orderBy: { id: "asc" } });
  const batchPick=(r)=>({id:r.id,courierUserId:r.courierUserId,deliveryDate:iso(r.deliveryDate),cutoffAt:iso(r.cutoffAt),dispatchAt:iso(r.dispatchAt),status:r.status,startedAt:iso(r.startedAt),completedAt:iso(r.completedAt),orders:r.orders.map(o=>({id:o.id,commerceOrderId:o.commerceOrderId,pickupSequence:o.pickupSequence,deliverySequence:o.deliverySequence,status:o.status}))});
  record("DELIVERY", "batches.assignments", batches.map(batchPick), targetBatches.map(batchPick));
  const sourceReviews = await client.review.findMany({ where: { productTarget: { isNot: null } }, include: { productTarget: true, photos: true, reply: true }, orderBy: { id: "asc" } }); const targetReviews = await client.targetReview.findMany({ orderBy: { id: "asc" } });
  const sourceReview=(r)=>({id:r.id,itemId:r.productTarget.commerceOrderItemId,customerUserId:r.customerUserId,storeId:r.storeId,rating:r.rating,comment:r.comment,photos:r.photos.sort((a,b)=>a.position-b.position).map(p=>p.url),reply:r.reply?.text||null,repliedBy:r.reply?.authorUserId||null,visibility:upper(r.visibility)}); const targetReview=(r)=>({id:r.id,itemId:r.commerceOrderItemId,customerUserId:r.customerUserId,storeId:r.storeId,rating:r.rating,comment:r.comment,photos:r.photoUrls||[],reply:r.merchantReply,repliedBy:r.repliedByUserId,visibility:r.visibilityStatus});
  record("REVIEW", "reviews.product", sourceReviews.map(sourceReview), targetReviews.map(targetReview));
  const conversations = await client.conversation.findMany({ include: { participants: { orderBy: { joinedAt: "asc" } }, context: true, messages: { include: { reads: true }, orderBy: { createdAt: "asc" } } }, orderBy: { id: "asc" } }); const targetConversations = await client.targetConversation.findMany({ include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { id: "asc" } });
  const sourceConversation=(r)=>({id:r.id,type:r.type,status:r.status,openKey:r.openKey,subject:r.subject,users:r.participants.map(p=>p.userId).sort(),storeId:r.context?.storeId||null,productId:r.context?.productId||null,orderId:r.context?.commerceOrderId||null,messages:r.messages.map(m=>({id:m.id,sender:m.senderUserId,message:m.message,attachment:m.attachmentUrl,readAt:m.reads.find(x=>x.userId!==m.senderUserId)?.readAt?iso(m.reads.find(x=>x.userId!==m.senderUserId).readAt):null}))}); const finalConversation=(r)=>({id:r.id,type:r.type,status:r.status,openKey:r.openKey,subject:r.subject,users:[r.requesterUserId,r.counterpartUserId].sort(),storeId:r.storeId,productId:r.productId,orderId:r.commerceOrderId,messages:r.messages.map(m=>({id:m.id,sender:m.senderUserId,message:m.message,attachment:m.attachmentUrl,readAt:iso(m.readAt)}))});
  record("CHAT", "conversations.messages", conversations.map(sourceConversation), targetConversations.map(finalConversation));
  const notifications = await client.notification.findMany({ where: { entityType: { notIn: ["TOURISM_GROUP_REQUEST", "TOURISM_BOOKING", "LIVE_IN_BOOKING"] } }, orderBy: { id: "asc" } }); const targetNotifications = await client.targetNotification.findMany({ orderBy: { id: "asc" } });
  const note=(r)=>({id:r.id,userId:r.userId,type:r.type,title:r.title,body:r.body,entityType:r.entityType==="ADMIN_FEE_OBLIGATION"?"MERCHANT_FEE":r.entityType,entityId:r.entityId,dedupeKey:r.dedupeKey,metadata:r.metadata,readAt:iso(r.readAt),expiresAt:iso(r.expiresAt),createdAt:iso(r.createdAt)});
  record("NOTIFICATION", "notifications.retained", notifications.map(note), targetNotifications.map(note), 3);
}

async function main() {
  await validateAuth(); await validateStoresProductsCarts(); await validateCommercePaymentFinance(); await validateDeliveryReviewChatNotification();
  result.summary = { operations: result.domains.length, recordsCompared: result.domains.reduce((sum,row)=>sum+row.recordsCompared,0), expectedNormalizedDifferences: result.domains.reduce((sum,row)=>sum+row.expectedNormalizedDifferences,0), unexpectedMismatches: result.domains.reduce((sum,row)=>sum+row.unexpectedMismatches,0) };
  console.log(`SHADOW_VALIDATION_JSON=${JSON.stringify(result)}`);
  if (result.summary.unexpectedMismatches) process.exitCode = 1;
}
main().catch((error)=>{ console.error(error); process.exitCode=1; }).finally(disconnectPrisma);
