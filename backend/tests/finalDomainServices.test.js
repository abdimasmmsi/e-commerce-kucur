const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createStoreService } = require("../services/storeService");
const { createProductService } = require("../services/productService");
const { createCartService } = require("../services/cartService");
const { createReviewService } = require("../services/reviewService");
const { createChatService } = require("../services/chatService");
const { createNotificationService } = require("../services/notificationService");

const prisma = getPrisma();
const ROLLBACK = Symbol("ROLLBACK");
async function rollback(work) { try { await prisma.$transaction(async (tx) => { const repo = createFinalPrismaRepository(tx); await work(repo, tx); throw ROLLBACK; }, { timeout: 30000 }); assert.fail("transaction must roll back"); } catch (error) { if (error !== ROLLBACK) throw error; } }
async function users(tx) {
  const customerId = randomUUID(), merchantId = randomUUID(), otherId = randomUUID(), adminId = randomUUID();
  await tx.targetUser.createMany({ data: [
    { id: customerId, email: `${customerId}@qa.invalid`, passwordHash: "hash", fullName: "Customer", phone: "0801" },
    { id: merchantId, email: `${merchantId}@qa.invalid`, passwordHash: "hash", fullName: "Merchant", phone: "0802" },
    { id: otherId, email: `${otherId}@qa.invalid`, passwordHash: "hash", fullName: "Other", phone: "0803" },
    { id: adminId, email: `${adminId}@qa.invalid`, passwordHash: "hash", fullName: "Admin", phone: "0804" },
  ] });
  await tx.targetUserRole.createMany({ data: [{ userId: customerId, role: "CUSTOMER" }, { userId: merchantId, role: "MERCHANT" }, { userId: otherId, role: "MERCHANT" }, { userId: adminId, role: "ADMIN" }] });
  return { customer: { id: customerId, fullName: "Customer", phone: "0801", roles: ["customer"] }, merchant: { id: merchantId, fullName: "Merchant", roles: ["merchant"] }, other: { id: otherId, fullName: "Other", roles: ["merchant"] }, admin: { id: adminId, fullName: "Admin", roles: ["admin"] } };
}
async function catalog(tx, actors) {
  const store = await tx.targetStore.create({ data: { id: randomUUID(), merchantUserId: actors.merchant.id, name: "QA Store", description: "QA", status: "ACTIVE", address: "QA", latitude: -7.1, longitude: 110.1 } });
  const simple = await tx.targetProduct.create({ data: { id: randomUUID(), storeId: store.id, name: "Simple", description: "QA", category: "QA", productType: "SIMPLE", price: 1000, stock: 5, images: [{ url: "https://qa.invalid/a.jpg", isPrimary: true }], options: [], status: "ACTIVE" } });
  const variant = await tx.targetProduct.create({ data: { id: randomUUID(), storeId: store.id, name: "Variant", description: "QA", category: "QA", productType: "VARIANT", images: [], options: [{ name: "Size", values: ["S"] }], status: "ACTIVE", variants: { create: { id: randomUUID(), sku: `SKU-${randomUUID()}`, combinationKey: "size=s", selectedOptions: { Size: "S" }, price: 2000, stock: 3, imageUrl: "https://qa.invalid/v.jpg", imageStorageKey: "v.jpg" } } } });
  return { store, simple, variant };
}

test("final Store service preserves approval, rejection, ownership, and coordinates", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const service = createStoreService(repo);
  const pending = await service.create({ name: "Pending", type: "product", description: "QA", location: { address: "QA", latitude: null, longitude: null } }, a.customer);
  assert.equal(pending.approvalStatus, "PENDING");
  await assert.rejects(service.get(pending.id, a.other), /bukan milik/i);
  const approved = await service.reviewApplication(pending.id, { status: "APPROVED" }, a.admin);
  assert.equal(approved.status, "pending-initial-payment"); assert.equal(approved.reviewedByUserId, a.admin.id);
  assert.equal(await tx.targetUserRole.count({ where: { userId: a.customer.id, role: "MERCHANT" } }), 1);
  const rejectedSource = await service.create({ name: "Rejected", type: "product", description: "QA" }, a.merchant);
  await assert.rejects(service.reviewApplication(rejectedSource.id, { status: "REJECTED" }, a.admin), (error) => /Alasan penolakan/i.test(error.details?.reason || ""));
  const rejected = await service.reviewApplication(rejectedSource.id, { status: "REJECTED", reason: "Tidak valid" }, a.admin);
  assert.equal(rejected.status, "rejected"); assert.equal(rejected.rejectionReason, "Tidak valid");
  await assert.rejects(service.create({ name: "Bad", type: "product", description: "QA", location: { latitude: -7 } }, a.merchant), (error) => /Latitude dan longitude/i.test(error.details?.location || ""));
}));

test("final Product and Cart services cover simple and variant validation/write paths", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const c = await catalog(tx, a); const products = createProductService(repo), cart = createCartService(repo);
  const created = await products.create({ storeId: c.store.id, name: "Created", description: "QA", category: "QA", status: "active", hasVariants: false, price: 500, stock: 2, images: [] }, a.merchant);
  assert.equal(created.stock, 2);
  const updated = await products.update(created.id, { stock: 4, price: 750 }, a.merchant); assert.equal(updated.stock, 4);
  await assert.rejects(products.update(created.id, { price: -1 }, a.merchant), (error) => /non-negatif/i.test(error.details?.price || ""));
  await assert.rejects(products.update(created.id, {}, a.other), /bukan milik/i);
  await assert.rejects(products.create({ storeId: c.store.id, name: "Duplicate", description: "QA", category: "QA", hasVariants: true, variantGroups: [{ name: "Size", options: ["S"] }], variants: [{ sku: "SAME", options: { Size: "S" }, price: 1, stock: 1 }, { sku: "SAME", options: { Size: "S" }, price: 1, stock: 1 }] }, a.merchant), /SKU harus unik/i);
  let value = await cart.add({ productId: c.simple.id, quantity: 1 }, a.customer); assert.equal(value.items.length, 1);
  value = await cart.add({ productId: c.variant.id, productVariantId: c.variant.variants?.[0]?.id || (await repo.products.findById(c.variant.id)).variants[0].id, quantity: 1 }, a.customer); assert.equal(value.items.length, 2);
  const item = value.items[0]; value = await cart.update(item.id, { quantity: 2 }, a.customer); assert.equal(value.items[0].quantity, 2);
  await assert.rejects(cart.update(item.id, { quantity: 0 }, a.customer), (error) => /minimal 1/i.test(error.details?.quantity || ""));
  value = await cart.remove(item.id, a.customer); assert.equal(value.items.length, 1);
  assert.equal(await tx.targetCart.count({ where: { customerUserId: a.customer.id } }), 1);
}));

test("final PaymentAttempt preserves all approved statuses, history, response, and XOR", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const c = await catalog(tx, a);
  const order = await tx.targetCommerceOrder.create({ data: { id: randomUUID(), checkoutGroupId: randomUUID(), checkoutIdempotencyKey: randomUUID(), storeId: c.store.id, customerUserId: a.customer.id, orderCode: `PAY-${randomUUID()}`, subtotal: 1000, grandTotal: 1000, recipientName: "QA", recipientPhone: "0800", deliveryAddress: "QA" } });
  const fee = await tx.targetMerchantFee.create({ data: { id: randomUUID(), merchantUserId: a.merchant.id, storeId: c.store.id, feeType: "ADMIN_FEE", amount: 1000 } });
  for (const status of ["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED"]) await repo.finance.createPaymentAttempt({ commerceOrderId: order.id, provider: "MANUAL", method: "QA", amount: 1000, status, providerResponse: { status }, paidAt: status === "PAID" ? new Date() : null, expiredAt: status === "EXPIRED" ? new Date() : null });
  await repo.finance.createPaymentAttempt({ merchantFeeId: fee.id, provider: "MANUAL", method: "QA", amount: 1000, status: "FAILED" });
  await repo.finance.createPaymentAttempt({ merchantFeeId: fee.id, provider: "MANUAL", method: "QA", amount: 1000, status: "PAID", paidAt: new Date() });
  assert.equal(await tx.targetPaymentAttempt.count({ where: { commerceOrderId: order.id } }), 5);
  assert.equal(await tx.targetPaymentAttempt.count({ where: { merchantFeeId: fee.id } }), 2);
  await assert.rejects(repo.finance.createPaymentAttempt({ provider: "MANUAL", method: "QA", amount: 1, status: "PENDING" }), /chk_payment_target_xor/i);
  await assert.rejects(repo.finance.createPaymentAttempt({ commerceOrderId: order.id, merchantFeeId: fee.id, provider: "MANUAL", method: "QA", amount: 1, status: "PENDING" }), /chk_payment_target_xor/i);
}));

test("final Review service covers eligibility, uniqueness, reply, and moderation", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const c = await catalog(tx, a); const service = createReviewService(repo);
  const order = await tx.targetCommerceOrder.create({ data: { id: randomUUID(), checkoutGroupId: randomUUID(), checkoutIdempotencyKey: randomUUID(), storeId: c.store.id, customerUserId: a.customer.id, orderCode: `REV-${randomUUID()}`, fulfillmentStatus: "COMPLETED", paymentStatus: "PAID", subtotal: 1000, grandTotal: 1000, recipientName: "QA", recipientPhone: "0800", deliveryAddress: "QA" } });
  const item = await tx.targetCommerceOrderItem.create({ data: { id: randomUUID(), commerceOrderId: order.id, productId: c.simple.id, productNameSnapshot: c.simple.name, storeNameSnapshot: c.store.name, unitPrice: 1000, quantity: 1, subtotal: 1000, stockStatus: "CONSUMED" } });
  await assert.rejects(service.createProduct(item.id, { rating: 6 }, a.customer), (error) => /1 sampai 5/i.test(error.details?.rating || ""));
  const review = await service.createProduct(item.id, { rating: 5, comment: "Bagus", photos: [{ url: "https://qa.invalid/review.jpg" }] }, a.customer);
  assert.equal(review.rating, 5); assert.equal(review.photos.length, 1);
  await assert.rejects(service.createProduct(item.id, { rating: 4 }, a.customer), /sudah ada/i);
  await assert.rejects(service.reply(review.id, { text: "No" }, a.other), (error) => error.code === "FORBIDDEN");
  assert.equal((await service.reply(review.id, { text: "Terima kasih" }, a.merchant)).merchantReply.text, "Terima kasih");
  await assert.rejects(service.moderate(review.id, true, { reason: "QA" }, a.merchant), (error) => error.code === "FORBIDDEN");
  await assert.rejects(service.moderate(review.id, true, {}, a.admin), (error) => /Alasan moderasi/i.test(error.details?.reason || ""));
  assert.equal((await service.moderate(review.id, true, { reason: "Spam" }, a.admin)).isHidden, true);
  assert.equal((await service.moderate(review.id, false, {}, a.admin)).isHidden, false);
}));

test("final Chat service covers context, openKey, authorization, read, and close", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const c = await catalog(tx, a); const service = createChatService(repo);
  const first = await service.customerMerchant({ productId: c.simple.id }, a.customer);
  const duplicate = await service.customerMerchant({ productId: c.simple.id }, a.customer); assert.equal(duplicate.id, first.id);
  await assert.rejects(service.get(first.id, a.other), /bukan peserta/i);
  await service.send(first.id, { message: "Halo" }, a.customer);
  const read = await service.read(first.id, a.merchant); assert.equal(read.updatedCount, 1);
  const messages = await service.messages(first.id, a.merchant); assert.equal(messages.items[0].readBy.includes(a.merchant.id), true);
  await service.close(first.id, a.merchant);
  await assert.rejects(service.send(first.id, { message: "Closed" }, a.customer), /sudah ditutup/i);
  await assert.rejects(repo.chats.create({ type: "SUPPORT", requesterUserId: a.admin.id, counterpartUserId: a.admin.id }), /distinct participants/i);
}));

test("final Notification service covers ownership, dedupe, metadata, read, and expiry", async () => rollback(async (repo, tx) => {
  const a = await users(tx); const service = createNotificationService(repo); const key = `qa:${randomUUID()}`;
  const input = { userId: a.customer.id, type: "CHAT_MESSAGE_RECEIVED", title: "QA", body: "QA", entityType: "CONVERSATION", entityId: randomUUID(), metadata: { domain: "chat" }, dedupeKey: key };
  assert.equal((await service.createNotification(input)).created, true);
  assert.equal((await service.createNotification(input)).created, false);
  const expired = await service.createNotification({ ...input, dedupeKey: `${key}:expired`, expiresAt: new Date(Date.now() - 1000) });
  const listed = await service.list(a.customer); assert.equal(listed.items.length, 1);
  await assert.rejects(service.markRead(listed.items[0].id, a.other), /tidak ditemukan/i);
  assert.equal((await service.markRead(listed.items[0].id, a.customer)).isRead, true);
  assert.equal((await repo.notifications.findById(expired.notification.id)).metadata.domain, "chat");
}));

test.after(disconnectPrisma);
