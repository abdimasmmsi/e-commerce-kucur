const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createDeliveryService } = require("../services/deliveryService");

const prisma = getPrisma();
const ROLLBACK = Symbol("ROLLBACK");
async function rollback(work) {
  try {
    await prisma.$transaction(async (tx) => {
      const repository = createFinalPrismaRepository(tx);
      await work(createDeliveryService(repository), repository, tx);
      throw ROLLBACK;
    }, { timeout: 30000 });
    assert.fail("transaction must roll back");
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

async function fixture(tx, suffix = randomUUID()) {
  const customerId = randomUUID();
  const merchantId = randomUUID();
  const otherMerchantId = randomUUID();
  const courierId = randomUUID();
  const otherCourierId = randomUUID();
  const adminId = randomUUID();
  const storeId = randomUUID();
  await tx.targetUser.createMany({ data: [
    { id: customerId, email: `customer-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Customer", phone: "080000000001" },
    { id: merchantId, email: `merchant-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Merchant", phone: "080000000002" },
    { id: otherMerchantId, email: `other-merchant-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Other Merchant", phone: "080000000003" },
    { id: courierId, email: `courier-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Courier", phone: "080000000004" },
    { id: otherCourierId, email: `other-courier-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Other Courier", phone: "080000000005" },
    { id: adminId, email: `admin-${suffix}@qa.invalid`, passwordHash: "hash", fullName: "Admin", phone: "080000000006" },
  ] });
  await tx.targetUserRole.createMany({ data: [
    { userId: customerId, role: "CUSTOMER" },
    { userId: merchantId, role: "MERCHANT" },
    { userId: otherMerchantId, role: "MERCHANT" },
    { userId: courierId, role: "COURIER" },
    { userId: otherCourierId, role: "COURIER" },
    { userId: adminId, role: "ADMIN" },
  ] });
  await tx.targetCourierProfile.createMany({ data: [
    { userId: courierId, maxActiveDeliveries: 5 },
    { userId: otherCourierId, maxActiveDeliveries: 5 },
  ] });
  await tx.targetStore.create({ data: { id: storeId, merchantUserId: merchantId, name: "Delivery Store", status: "ACTIVE" } });
  await tx.targetPlatformSettings.upsert({
    where: { id: "active" },
    update: { orderCutoffTime: new Date("1970-01-01T23:59:00Z"), dispatchTime: new Date("1970-01-01T08:00:00Z"), maxDailyDeliveries: 20 },
    create: { id: "active", orderCutoffTime: new Date("1970-01-01T23:59:00Z"), dispatchTime: new Date("1970-01-01T08:00:00Z"), maxDailyDeliveries: 20 },
  });
  return { customerId, merchantId, otherMerchantId, courierId, otherCourierId, adminId, storeId };
}

async function createOrder(tx, f, status = "PROCESSING") {
  return tx.targetCommerceOrder.create({ data: {
    id: randomUUID(), checkoutGroupId: randomUUID(), checkoutIdempotencyKey: randomUUID(),
    storeId: f.storeId, customerUserId: f.customerId, orderCode: `DEL-${randomUUID()}`,
    fulfillmentStatus: status, paymentStatus: "PAID", subtotal: 1000, deliveryFee: 1000,
    grandTotal: 2000, recipientName: "QA", recipientPhone: "0800", deliveryAddress: "QA",
  } });
}

test("final Delivery profile role and availability history use CourierProfile only", async () => rollback(async (service, repository, tx) => {
  const f = await fixture(tx);
  const profile = await service.profile({ id: f.courierId });
  assert.equal(profile.user.id, f.courierId);
  const startAt = new Date(Date.now() + 86400000);
  const unavailable = await service.createAvailability({ startAt, reason: "QA" }, { id: f.courierId });
  assert.equal((await service.availability({ id: f.courierId })).length, 1);
  await assert.rejects(service.createAvailability({ startAt, endAt: new Date(startAt.getTime() + 7200000) }, { id: f.courierId }), /bertumpang tindih/i);
  assert.deepEqual(await service.endAvailability(unavailable.id, { id: f.courierId }), { ended: true });
  assert.equal((await repository.delivery.profile(f.courierId)).availabilityStatus, "AVAILABLE");
}));

test("final Delivery service completes readiness, pickup, proof, history, and batch", async () => rollback(async (service, repository, tx) => {
  const f = await fixture(tx);
  const order = await createOrder(tx, f);
  const deliveryDate = service.resolveDeliveryDate(order.createdAt, "23:59");
  const batch = await service.createBatch({ courierUserId: f.courierId, deliveryDate, commerceOrderIds: [order.id] }, { id: f.adminId, roles: ["admin"] });
  assert.equal(batch.orders.length, 1);
  await assert.rejects(service.createBatch({ courierUserId: f.courierId, deliveryDate, commerceOrderIds: [order.id] }, { id: f.adminId, roles: ["admin"] }), /sudah memiliki assignment/i);
  await assert.rejects(service.confirmReady(order.id, { isReady: true }, { id: f.otherMerchantId }), /bukan milik Merchant/i);
  const ready = await service.confirmReady(order.id, { isReady: true, note: "Siap" }, { id: f.merchantId });
  assert.equal(ready.note, "Siap");
  await assert.rejects(service.pickup(order.id, {}, { id: f.otherCourierId }), /tidak ditugaskan/i);
  const picked = await service.pickup(order.id, { note: "Picked" }, { id: f.courierId });
  assert.equal(picked.status, "PICKED_UP");
  assert.ok(picked.pickedUpAt);
  await assert.rejects(service.pickup(order.id, {}, { id: f.courierId }), /Status pickup tidak valid/i);
  const traveling = await service.outForDelivery(order.id, {}, { id: f.courierId });
  assert.equal(traveling.status, "OUT_FOR_DELIVERY");
  assert.ok(traveling.outForDeliveryAt);
  const proof = await service.proof(order.id, { photoUrl: "https://qa.invalid/proof.jpg", recipientName: "Recipient", note: "Done" }, { id: f.courierId });
  assert.equal(proof.photoUrl, "https://qa.invalid/proof.jpg");
  assert.equal((await service.proof(order.id, { photoUrl: "https://qa.invalid/other.jpg" }, { id: f.courierId })).id, proof.id);
  const assignment = await repository.delivery.latestAssignment(order.id);
  assert.equal(assignment.status, "DELIVERED");
  assert.deepEqual((await repository.delivery.activities(order.id)).map((entry) => entry.status), ["BATCHED", "READY", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"]);
  const completed = await service.completeBatch(batch.id, { id: f.courierId, roles: ["courier"] });
  assert.equal(completed.status, "COMPLETED");
}));

test("final Delivery failure remains historical and permits controlled rebatch", async () => rollback(async (service, repository, tx) => {
  const f = await fixture(tx);
  const order = await createOrder(tx, f);
  const deliveryDate = service.resolveDeliveryDate(order.createdAt, "23:59");
  const first = await service.createBatch({ courierUserId: f.courierId, deliveryDate, commerceOrderIds: [order.id] }, { id: f.adminId, roles: ["admin"] });
  const failed = await service.failed(order.id, { reason: "Alamat tidak ditemukan" }, { id: f.courierId });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.failureReason, "Alamat tidak ditemukan");
  await service.completeBatch(first.id, { id: f.adminId, roles: ["admin"] });
  const result = await service.rebatch(order.id, { courierUserId: f.otherCourierId, deliveryDate }, { id: f.adminId, roles: ["admin"] });
  assert.equal(result.assignment.status, "WAITING_PICKUP");
  assert.notEqual(result.assignment.id, failed.id);
  assert.equal((await tx.targetDeliveryBatchOrder.count({ where: { commerceOrderId: order.id } })), 2);
  assert.equal((await repository.delivery.activities(order.id)).at(-1).status, "REBATCHED");
}));

test.after(disconnectPrisma);
