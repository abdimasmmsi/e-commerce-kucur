const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createCommerceService } = require("../services/commerceService");

const prisma = getPrisma();
const ROLLBACK = Symbol("ROLLBACK");
const withRollback = async (work) => {
  try {
    await prisma.$transaction(async (tx) => { await work(createFinalPrismaRepository(tx), tx); throw ROLLBACK; }, { timeout: 30000 });
    assert.fail("transaction must roll back");
  } catch (error) { if (error !== ROLLBACK) throw error; }
};

async function commerceFixture(tx) {
  const customerId = randomUUID(); const merchantAId = randomUUID(); const merchantBId = randomUUID();
  await tx.targetUser.createMany({ data: [
    { id: customerId, email: `${customerId}@qa.invalid`, passwordHash: "hash", fullName: "QA Customer", phone: "080000000001" },
    { id: merchantAId, email: `${merchantAId}@qa.invalid`, passwordHash: "hash", fullName: "QA Merchant A", phone: "080000000002" },
    { id: merchantBId, email: `${merchantBId}@qa.invalid`, passwordHash: "hash", fullName: "QA Merchant B", phone: "080000000003" },
  ] });
  await tx.targetUserRole.createMany({ data: [{ userId: customerId, role: "CUSTOMER" }, { userId: merchantAId, role: "MERCHANT" }, { userId: merchantBId, role: "MERCHANT" }] });
  const stores = [{ id: randomUUID(), merchantUserId: merchantAId, name: "QA Store A" }, { id: randomUUID(), merchantUserId: merchantBId, name: "QA Store B" }];
  for (const store of stores) await tx.targetStore.create({ data: { ...store, status: "ACTIVE", address: "Kucur", latitude: -7.95, longitude: 112.54 } });
  const products = [];
  for (const [index, store] of stores.entries()) { const product = { id: randomUUID(), storeId: store.id, name: `QA Product ${index}`, productType: "SIMPLE", price: 10000, stock: 2, images: [], options: [], status: "ACTIVE" }; await tx.targetProduct.create({ data: product }); products.push(product); }
  return { actor: { id: customerId, fullName: "QA Customer", phone: "080000000001", roles: ["customer"] }, products };
}

const inputFor = (products) => ({ items: products.map((product) => ({ productId: product.id, quantity: 1 })), paymentMethod: "COD", delivery: { address: "QA Address", recipientName: "QA Customer", recipientPhone: "080000000001", location: { latitude: -7.951, longitude: 112.541 } } });

test("final commerce service creates multi-Store checkout and preserves idempotency", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo); const key = `qa-${randomUUID()}`;
  const created = await service.create(inputFor(fixture.products), fixture.actor, key);
  assert.equal(created.orders.length, 2);
  assert.equal(new Set(created.orders.map((order) => order.checkoutGroupId)).size, 1);
  assert.equal(created.orders.every((order) => order.checkoutIdempotencyKey === key), true);
  assert.equal(created.orders.every((order) => order.items[0].stockStatus === "reserved"), true);
  const repeated = await service.create(inputFor(fixture.products), fixture.actor, key);
  assert.deepEqual(repeated.orders.map((order) => order.id), created.orders.map((order) => order.id));
  assert.equal(await tx.targetCommerceOrder.count({ where: { customerUserId: fixture.actor.id, checkoutIdempotencyKey: key } }), 2);
}));

test("final checkout snapshots global PPN per order and includes it in the COD total", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo);
  await tx.targetPlatformSettings.updateMany({ data: { taxPercent: 11 } });
  const { orders: [order] } = await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`);
  assert.equal(order.taxPercentSnapshot, 11);
  assert.equal(order.taxAmount, 1100);
  assert.equal(order.grandTotal, order.productTotal + order.taxAmount + order.deliveryFee + order.courierTip);
  const attempt = await tx.targetPaymentAttempt.findFirst({ where: { commerceOrderId: order.id } });
  assert.equal(Number(attempt.amount), order.grandTotal);
}));

test("final commerce cancellation releases stock and appends deterministic history", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo);
  const created = await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`);
  assert.equal((await tx.targetProduct.findUnique({ where: { id: fixture.products[0].id } })).stock, 1);
  const cancelled = await service.cancel(created.orders[0].id, "QA cancellation", fixture.actor);
  assert.equal(cancelled.fulfillmentStatus, "cancelled");
  assert.equal(cancelled.reservations[0].status, "released");
  assert.equal((await tx.targetProduct.findUnique({ where: { id: fixture.products[0].id } })).stock, 2);
  const stored = await tx.targetCommerceOrder.findUnique({ where: { id: created.orders[0].id } });
  assert.deepEqual(stored.activityHistory.map((event) => event.type), ["ORDER_CREATED", "ORDER_CANCELLED"]);
}));

test("customer cannot cancel once the store starts packing, but the store still can", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo);
  const { orders: [order] } = await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`);
  await tx.targetCommerceOrder.update({ where: { id: order.id }, data: { fulfillmentStatus: "CONFIRMED" } });
  const second = (await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`)).orders[0];
  assert.equal((await service.cancel(order.id, "Berubah pikiran", fixture.actor)).fulfillmentStatus, "cancelled");
  const owner = (await tx.targetStore.findUnique({ where: { id: fixture.products[0].storeId } })).merchantUserId;
  const merchantNotice = await tx.targetNotification.findFirst({ where: { userId: owner, type: "COMMERCE_ORDER_CANCELLED", entityId: order.id } });
  assert.match(merchantNotice?.body ?? "", /dibatalkan pembeli.*Berubah pikiran/);
  const customerNotice = await tx.targetNotification.findFirst({ where: { userId: fixture.actor.id, type: "COMMERCE_ORDER_CANCELLED", entityId: order.id } });
  assert.match(customerNotice?.body ?? "", /Alasan: Berubah pikiran/);
  await tx.targetCommerceOrder.update({ where: { id: second.id }, data: { fulfillmentStatus: "PROCESSING" } });
  await assert.rejects(service.cancel(second.id, "Berubah pikiran", fixture.actor), (error) => /sudah dikemas/i.test(error?.details?.status || ""));
  const store = await tx.targetStore.findUnique({ where: { id: fixture.products[0].storeId } });
  const merchant = { id: store.merchantUserId, roles: ["merchant"] };
  assert.equal((await service.cancel(second.id, "Stok rusak", merchant)).fulfillmentStatus, "cancelled");
}));

test("store owner is notified when an application is approved or rejected", async () => withRollback(async (repo, tx) => {
  const { createStoreService } = require("../services/storeService");
  const service = createStoreService(repo);
  const ownerId = randomUUID(); const storeId = randomUUID();
  await tx.targetUser.create({ data: { id: ownerId, email: `${ownerId}@qa.invalid`, passwordHash: "hash", fullName: "QA Owner", phone: "080000000010" } });
  await tx.targetStore.create({ data: { id: storeId, merchantUserId: ownerId, name: "QA Lapak Baru", status: "PENDING", address: "Kucur" } });
  await service.reviewApplication(storeId, { status: "REJECTED", reason: "Foto lapak kurang jelas" }, { id: null, roles: ["admin"] });
  const notice = await tx.targetNotification.findFirst({ where: { userId: ownerId, type: "STORE_REJECTED" } });
  assert.match(notice?.body ?? "", /Foto lapak kurang jelas/);
}));

test("store is notified when an order leaves a product almost out of stock", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo);
  await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`);
  const owner = (await tx.targetStore.findUnique({ where: { id: fixture.products[0].storeId } })).merchantUserId;
  const notice = await tx.targetNotification.findFirst({ where: { userId: owner, type: "PRODUCT_LOW_STOCK", entityId: fixture.products[0].id } });
  assert.match(notice?.body ?? "", /tinggal 1/);
}));

test("final commerce insufficient stock rolls the entire checkout back", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo); const input = inputFor(fixture.products); input.items[1].quantity = 3;
  await assert.rejects(service.create(input, fixture.actor, `qa-${randomUUID()}`), (error) => error?.details?.quantity === "Stok produk tidak mencukupi.");
  assert.equal(await tx.targetCommerceOrder.count({ where: { customerUserId: fixture.actor.id } }), 0);
  assert.equal((await tx.targetProduct.findUnique({ where: { id: fixture.products[0].id } })).stock, 2);
}));

test("final checkout rejects addresses beyond the configured maximum delivery distance", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo);
  await tx.targetPlatformSettings.updateMany({ data: { maxDeliveryDistanceKm: 2 } });
  const far = inputFor([fixture.products[0]]); far.delivery.location = { latitude: -7.98, longitude: 112.63 };
  await assert.rejects(service.create(far, fixture.actor, `qa-${randomUUID()}`), (error) => /jangkauan pengiriman/i.test(error?.details?.distanceKm || ""));
  const near = await service.create(inputFor([fixture.products[0]]), fixture.actor, `qa-${randomUUID()}`);
  assert.equal(near.orders.length, 1);
}));

test("final settings persist installment toggles and admin contact", async () => withRollback(async (repo) => {
  await repo.settings.update({ installment6MonthsEnabled: false, adminContactName: "Pengelola QA", adminContactPhone: "0812 3456", maxDeliveryDistanceKm: 15 });
  const settings = await repo.settings.get();
  assert.equal(settings.installment6MonthsEnabled, false);
  assert.equal(settings.installmentFullEnabled, true);
  assert.equal(settings.adminContactName, "Pengelola QA");
  assert.equal(settings.maxDeliveryDistanceKm, 15);
}));

test("customer addresses keep one primary, require a map point, and allow at most five", async () => withRollback(async (repo, tx) => {
  const { createUserService } = require("../services/userService");
  const service = createUserService(repo);
  const userId = randomUUID();
  await tx.targetUser.create({ data: { id: userId, email: `${userId}@qa.invalid`, passwordHash: "hash", fullName: "QA Address", phone: "080000000009" } });
  const actor = { id: userId, roles: ["customer"] };
  const address = (label, extra = {}) => ({ label, recipientName: "QA", phone: "081234567890", address: `Jalan ${label}`, latitude: -7.95, longitude: 112.54, ...extra });
  const saved = await service.updateAddresses(actor, { addresses: [address("Rumah"), address("Kantor", { isPrimary: true })] });
  assert.deepEqual(saved.addresses.map((row) => [row.label, row.isPrimary]), [["Rumah", false], ["Kantor", true]]);
  const fallback = await service.updateAddresses(actor, { addresses: [address("Rumah"), address("Kebun")] });
  assert.deepEqual(fallback.addresses.map((row) => row.isPrimary), [true, false]);
  await assert.rejects(service.updateAddresses(actor, { addresses: Array.from({ length: 6 }, (_, index) => address(`A${index}`)) }), /validation|tidak valid|Maksimal/i);
  await assert.rejects(service.updateAddresses(actor, { addresses: [address("Tanpa titik", { latitude: null, longitude: null })] }), (error) => Boolean(error?.details?.["addresses.0.location"]));
}));

test("settings service accepts times echoed back as HH:MM:SS and persists the admin fee grace time", async () => withRollback(async (repo) => {
  const { createSettingsService } = require("../services/settingsService");
  const service = createSettingsService(repo);
  const actor = { id: null, roles: ["admin"] };
  await service.update({ deliveryOrderCutoffTime: "15:30:00", deliveryDispatchTime: "17:00", adminFeeGraceTime: "10:30" }, actor);
  const settings = await repo.settings.get();
  assert.equal(settings.deliveryOrderCutoffTime, "15:30:00");
  assert.equal(settings.adminFeeGraceTime, "10:30:00");
}));

test.after(disconnectPrisma);
