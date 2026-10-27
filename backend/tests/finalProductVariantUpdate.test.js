const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
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

// Mengedit produk bervarian (mis. memasang foto) pernah gagal 500 karena varian baru tidak diberi id.
test("updating a product with variants keeps its variants and accepts new images", async () => withRollback(async (repo, tx) => {
  const merchantId = randomUUID(); const storeId = randomUUID();
  await tx.targetUser.create({ data: { id: merchantId, email: `${merchantId}@qa.invalid`, passwordHash: "hash", fullName: "QA Merchant", phone: "080000000009" } });
  await tx.targetStore.create({ data: { id: storeId, merchantUserId: merchantId, name: "QA Store", status: "ACTIVE", address: "Kucur", latitude: -7.95, longitude: 112.54 } });
  const base = { name: "QA Keripik", price: 10000, stock: 10, status: "active", hasVariants: true, images: [], variantGroups: [{ name: "Rasa", options: ["Asin", "Balado"], position: 0 }] };
  const variants = [{ sku: "QA-1", combinationKey: "Asin", options: { Rasa: "Asin" }, price: 10000, stock: 5, status: "active" }, { sku: "QA-2", combinationKey: "Balado", options: { Rasa: "Balado" }, price: 11000, stock: 5, status: "active" }];
  const created = await repo.products.create({ ...base, storeId, variants });
  assert.equal(created.variants.length, 2);
  const updated = await repo.products.update(created.id, { ...base, storeId, variants, images: [{ url: "/uploads/stores/qa.png", position: 0, isPrimary: true }] });
  assert.equal(updated.variants.length, 2);
  assert.equal(updated.images[0].url, "/uploads/stores/qa.png");
}));

test.after(() => disconnectPrisma());
