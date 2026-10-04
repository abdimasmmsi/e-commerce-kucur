const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");

const prisma = getPrisma();
const ROLLBACK = Symbol("ROLLBACK");
const withRollback = async (work) => {
  try {
    await prisma.$transaction(async (tx) => { await work(createFinalPrismaRepository(tx), tx); throw ROLLBACK; }, { timeout: 30000 });
    assert.fail("transaction must roll back");
  } catch (error) { if (error !== ROLLBACK) throw error; }
};
const fixture = async (tx) => {
  const userId = randomUUID(); const merchantId = randomUUID(); const storeId = randomUUID(); const productId = randomUUID();
  await tx.targetUser.createMany({ data: [
    { id: userId, email: `${userId}@qa.invalid`, passwordHash: "hash", fullName: "QA Customer", phone: "080000000001" },
    { id: merchantId, email: `${merchantId}@qa.invalid`, passwordHash: "hash", fullName: "QA Merchant", phone: "080000000002" },
  ] });
  await tx.targetUserRole.createMany({ data: [{ userId, role: "CUSTOMER" }, { userId: merchantId, role: "MERCHANT" }] });
  await tx.targetStore.create({ data: { id: storeId, merchantUserId: merchantId, name: "Disposable Store", status: "ACTIVE" } });
  await tx.targetProduct.create({ data: { id: productId, storeId, name: "Disposable Product", productType: "SIMPLE", price: 1000, stock: 1, images: [], options: [], status: "ACTIVE" } });
  return { userId, merchantId, storeId, productId };
};

test("final AUTH session create/read/revoke is isolated", async () => withRollback(async (repo, tx) => {
  const { userId } = await fixture(tx); const tokenHash = createHash("sha256").update(randomUUID()).digest("hex");
  await repo.sessions.create({ tokenHash, userId, expiresAt: new Date(Date.now() + 60000) });
  assert.equal((await repo.sessions.findActiveByTokenHash(tokenHash)).user.id, userId);
  assert.equal((await repo.sessions.revokeByTokenHash(tokenHash)).count, 1);
  assert.equal(await repo.sessions.findActiveByTokenHash(tokenHash), null);
}));

test("final Store Product Cart writes preserve service-shaped operations", async () => withRollback(async (repo, tx) => {
  const f = await fixture(tx);
  assert.equal((await repo.stores.update(f.storeId, { status: "suspended-admin-fee", rejectionReason: "QA" })).status, "suspended-admin-fee");
  const product = await repo.products.findById(f.productId); assert.equal(product.stock, 1);
  const cart = await repo.commerce.ensureCart(f.userId); const item = await repo.commerce.addCartItem({ cartId: cart.id, productId: f.productId, quantity: 1 });
  await repo.commerce.updateCartItem(item.id, 2); assert.equal((await repo.commerce.getCart(f.userId)).items[0].quantity, 2);
  await repo.commerce.deleteCartItem(item.id); assert.equal((await repo.commerce.getCart(f.userId)).items.length, 0);
}));

test("final Commerce stock reservation prevents concurrent oversell", async () => withRollback(async (repo, tx) => {
  const f = await fixture(tx);
  const results = await Promise.all([repo.commerce.reserveSimple(f.productId, 1), repo.commerce.reserveSimple(f.productId, 1)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal((await tx.targetProduct.findUnique({ where: { id: f.productId } })).stock, 0);
  await repo.commerce.releaseSimple(f.productId, 1); assert.equal((await tx.targetProduct.findUnique({ where: { id: f.productId } })).stock, 1);
}));

test("final unique checkout, Review, Conversation, Notification and Payment XOR constraints reject duplicates", async () => withRollback(async (repo, tx) => {
  const f = await fixture(tx); const orderId = randomUUID();
  const order = { id: orderId, checkoutGroupId: randomUUID(), checkoutIdempotencyKey: "disposable-key", storeId: f.storeId, customerUserId: f.userId, orderCode: `QA-${orderId}`, subtotal: 1000, grandTotal: 1000, recipientName: "QA", recipientPhone: "0800", deliveryAddress: "QA" };
  await tx.targetCommerceOrder.create({ data: order });
  await assert.rejects(tx.targetCommerceOrder.create({ data: { ...order, id: randomUUID(), orderCode: `QA-${randomUUID()}` } }));
  const item = await tx.targetCommerceOrderItem.create({ data: { id: randomUUID(), commerceOrderId: orderId, productId: f.productId, productNameSnapshot: "Disposable Product", storeNameSnapshot: "Disposable Store", unitPrice: 1000, quantity: 1, subtotal: 1000 } });
  await tx.targetReview.create({ data: { id: randomUUID(), commerceOrderItemId: item.id, customerUserId: f.userId, storeId: f.storeId, rating: 5 } });
  await assert.rejects(tx.targetReview.create({ data: { id: randomUUID(), commerceOrderItemId: item.id, customerUserId: f.userId, storeId: f.storeId, rating: 4 } }));
  const openKey = `qa:${randomUUID()}`;
  await tx.targetConversation.create({ data: { id: randomUUID(), type: "CUSTOMER_MERCHANT", openKey, requesterUserId: f.userId, counterpartUserId: f.merchantId, storeId: f.storeId } });
  await assert.rejects(tx.targetConversation.create({ data: { id: randomUUID(), type: "CUSTOMER_MERCHANT", openKey, requesterUserId: f.userId, counterpartUserId: f.merchantId } }));
  const dedupeKey = `qa:${randomUUID()}`;
  await repo.notifications.create({ userId: f.userId, type: "QA", title: "QA", body: "QA", dedupeKey });
  await assert.rejects(repo.notifications.create({ userId: f.userId, type: "QA", title: "QA", body: "QA", dedupeKey }));
  const fee = await tx.targetMerchantFee.create({ data: { id: randomUUID(), merchantUserId: f.merchantId, storeId: f.storeId, feeType: "ADMIN_FEE", amount: 1000 } });
  await assert.rejects(tx.targetPaymentAttempt.create({ data: { id: randomUUID(), commerceOrderId: orderId, merchantFeeId: fee.id, provider: "MANUAL", method: "QA", amount: 1000 } }), (error) => /chk_payment_target_xor/i.test(String(error.message)));
}));

test("final Delivery consolidated write and Chat read/close paths are isolated", async () => withRollback(async (repo, tx) => {
  const f = await fixture(tx); const courierId = randomUUID();
  await tx.targetUser.create({ data: { id: courierId, email: `${courierId}@qa.invalid`, passwordHash: "hash", fullName: "QA Courier", phone: "080000000003" } });
  await tx.targetCourierProfile.create({ data: { userId: courierId } });
  const order = await tx.targetCommerceOrder.create({ data: { id: randomUUID(), checkoutGroupId: randomUUID(), checkoutIdempotencyKey: randomUUID(), storeId: f.storeId, customerUserId: f.userId, orderCode: `QA-${randomUUID()}`, subtotal: 1000, grandTotal: 1000, recipientName: "QA", recipientPhone: "0800", deliveryAddress: "QA" } });
  const batch = await tx.targetDeliveryBatch.create({ data: { id: randomUUID(), courierUserId: courierId, deliveryDate: new Date(), cutoffAt: new Date(), dispatchAt: new Date() } });
  await tx.targetDeliveryBatchOrder.create({ data: { id: randomUUID(), deliveryBatchId: batch.id, commerceOrderId: order.id } });
  await repo.delivery.pickupConfirmation({ deliveryBatchId: batch.id, commerceOrderId: order.id, isReady: true, note: "ready", confirmedAt: new Date() });
  await repo.delivery.createProof({ deliveryBatchId: batch.id, commerceOrderId: order.id, photoUrl: "https://qa.invalid/proof.jpg", recipientName: "QA", note: "done", deliveredAt: new Date() });
  assert.equal((await repo.delivery.proof(order.id)).photoUrl, "https://qa.invalid/proof.jpg");
  const conversation = await tx.targetConversation.create({ data: { id: randomUUID(), type: "CUSTOMER_MERCHANT", requesterUserId: f.userId, counterpartUserId: f.merchantId, storeId: f.storeId } });
  await repo.chats.createMessage(conversation.id, f.userId, "QA message");
  assert.equal(await repo.chats.messageCount(conversation.id), 1);
  assert.equal(await repo.chats.markRead(conversation.id, f.merchantId), 1);
  await repo.chats.update(conversation.id, { status: "closed", closedByUserId: f.merchantId, closedAt: new Date() });
  assert.equal((await repo.chats.find(conversation.id)).status, "CLOSED");
}));

test.after(disconnectPrisma);
