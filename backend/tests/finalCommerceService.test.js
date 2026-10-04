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

test("final commerce insufficient stock rolls the entire checkout back", async () => withRollback(async (repo, tx) => {
  const fixture = await commerceFixture(tx); const service = createCommerceService(repo); const input = inputFor(fixture.products); input.items[1].quantity = 3;
  await assert.rejects(service.create(input, fixture.actor, `qa-${randomUUID()}`), (error) => error?.details?.quantity === "Stok produk tidak mencukupi.");
  assert.equal(await tx.targetCommerceOrder.count({ where: { customerUserId: fixture.actor.id } }), 0);
  assert.equal((await tx.targetProduct.findUnique({ where: { id: fixture.products[0].id } })).stock, 2);
}));

test.after(disconnectPrisma);
