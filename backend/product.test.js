const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRepository } = require("./repositories/memoryRepository");
const { createProductService, validateProduct } = require("./services/productService");

const actor = { id: "MERCHANT-A", roles: ["customer", "merchant"] };
const simple = { storeId: "STORE-A", name: "Kopi Kucur", description: "Kopi lokal", category: "Minuman", price: 25000, stock: 4, status: "active", hasVariants: false, images: [] };
const variant = { ...simple, name: "Keripik Variasi", hasVariants: true, price: null, stock: null, variantGroups: [{ name: "Rasa", options: ["Original", "Balado"] }], variants: [{ sku: "ORI", options: { Rasa: "Original" }, price: 20000, stock: 2, status: "active" }, { sku: "BAL", options: { Rasa: "Balado" }, price: 22000, stock: 0, status: "active" }] };
const repository = () => createMemoryRepository({ stores: [{ id: "STORE-A", merchantUserId: "MERCHANT-A", name: "A", type: "product", status: "active" }, { id: "STORE-B", merchantUserId: "MERCHANT-B", name: "B", type: "product", status: "active" }, { id: "STORE-C", merchantUserId: "MERCHANT-A", name: "C", type: "product", status: "active" }] });

test("Product validation rejects negative inventory and duplicate combinations", () => {
  assert.throws(() => validateProduct({ ...simple, stock: -1 }), (error) => error.code === "VALIDATION_ERROR");
  assert.throws(() => validateProduct({ ...variant, variants: [...variant.variants, { ...variant.variants[0], sku: "OTHER" }] }), (error) => error.code === "CONFLICT");
});

test("Product create persists canonical ownership and audit", async () => {
  const repo = repository(); const service = createProductService(repo);
  const created = await service.create({ ...variant, merchantUserId: "MERCHANT-B" }, actor);
  assert.equal(created.storeId, "STORE-A");
  assert.equal(created.variants.length, 2);
  assert.equal(repo.audits.list().at(-1).activityType, "PRODUCT_CREATED");
});

test("Product management is owner-scoped while public reads hide inactive products", async () => {
  const repo = repository(); const service = createProductService(repo);
  const created = await service.create(simple, actor);
  await service.update(created.id, { status: "inactive" }, actor);
  assert.equal((await service.list(null, false)).length, 0);
  assert.equal((await service.list(actor, true)).length, 1);
  await assert.rejects(service.update(created.id, { storeId: "STORE-B" }, actor), (error) => error.code === "FORBIDDEN");
});

test("Public product reads hide active products when their store is inactive", async () => {
  const repo = repository(); const service = createProductService(repo);
  const created = await service.create(simple, actor);
  assert.equal((await service.list(null, false)).length, 1);

  await repo.stores.update("STORE-A", { status: "inactive" });

  assert.equal((await service.list(null, false)).length, 0);
  await assert.rejects(service.get(created.id, null, false), (error) => error.code === "NOT_FOUND");
  assert.equal((await service.list(actor, true)).length, 1);
  assert.equal((await service.get(created.id, actor, true)).id, created.id);
});

test("Product management scopes lists and details to the selected store", async () => {
  const repo = repository(); const service = createProductService(repo);
  const storeAProduct = await service.create(simple, actor);
  const storeCProduct = await service.create({ ...simple, storeId: "STORE-C", name: "Madu Kucur" }, actor);

  const storeAProducts = await service.list(actor, true, { storeId: "STORE-A" });
  assert.deepEqual(storeAProducts.map((product) => product.id), [storeAProduct.id]);
  await assert.rejects(
    service.get(storeCProduct.id, actor, true, { storeId: "STORE-A" }),
    (error) => error.code === "NOT_FOUND",
  );
  assert.equal((await service.get(storeCProduct.id, actor, true, { storeId: "STORE-C" })).id, storeCProduct.id);
});
