const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRepository } = require("./repositories/memoryRepository");
const { createCartService } = require("./services/cartService");
const { createCommerceService } = require("./services/commerceService");

const customer = { id: "CUSTOMER", fullName: "Customer", phone: "0812", roles: ["customer"] };
const merchantA = { id: "MERCHANT-A", roles: ["customer", "merchant"] };
const merchantB = { id: "MERCHANT-B", roles: ["customer", "merchant"] };
const admin = { id: "ADMIN", roles: ["admin"] };
const product = { id: "PRODUCT-A", storeId: "STORE-A", name: "Kopi", description: "", category: "Minuman", status: "active", hasVariants: false, price: 10000, stock: 3, images: [], variantGroups: [], variants: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const variantProduct = { ...product, id: "PRODUCT-V", name: "Keripik", hasVariants: true, price: null, stock: null, variants: [{ id: "VARIANT-V", sku: "V-1", options: { Rasa: "Pedas" }, price: 12000, stock: 2, status: "active" }] };
const fixture = () => { const repository = createMemoryRepository({ stores: [{ id: "STORE-A", merchantUserId: "MERCHANT-A", name: "Store A", status: "active", location: { latitude: -7.9, longitude: 112.6 } }], products: [product, variantProduct], settings: { deliveryBaseFee: 6000, deliveryRatePerKm: 1500 } }); return { repository, cart: createCartService(repository), commerce: createCommerceService(repository) }; };
const checkout = { items: [{ productId: "PRODUCT-A", quantity: 2 }], paymentMethod: "COD", delivery: { address: "Kucur", recipientName: "Customer", recipientPhone: "0812", location: { latitude: -7.89, longitude: 112.6 } }, productTotal: 1, grandTotal: 1 };

test("Cart validates simple and exact variant inventory and mutations", async () => {
  const { cart } = fixture();
  let value = await cart.add({ productId: "PRODUCT-A", quantity: 1 }, customer); assert.equal(value.items[0].quantity, 1);
  value = await cart.update(value.items[0].id, { quantity: 2 }, customer); assert.equal(value.items[0].quantity, 2);
  await assert.rejects(cart.add({ productId: "PRODUCT-V", quantity: 1 }, customer), (error) => error.code === "VALIDATION_ERROR");
  value = await cart.add({ productId: "PRODUCT-V", productVariantId: "VARIANT-V", quantity: 1 }, customer); assert.equal(value.items.length, 2);
  value = await cart.remove(value.items[0].id, customer); assert.equal(value.items.length, 1);
});

test("Checkout ignores forged totals, reserves stock, snapshots and is idempotent", async () => {
  const { repository, commerce } = fixture();
  const created = await commerce.create(checkout, customer, "same-key");
  assert.equal(created.orders[0].productTotal, 20000); assert.equal(created.orders[0].deliveryFee, 6000); assert.equal(created.orders[0].paymentStatus, "pending");
  assert.equal(created.orders[0].items[0].productName, "Kopi"); assert.equal(repository.products.findById("PRODUCT-A").stock, 1);
  const repeated = await commerce.create(checkout, customer, "same-key"); assert.equal(repeated.id, created.id); assert.equal(repository.products.findById("PRODUCT-A").stock, 1);
});

test("Order ownership, merchant isolation, admin access and cancellation release", async () => {
  const { repository, commerce } = fixture(); const created = await commerce.create(checkout, customer, "cancel-key"); const order = created.orders[0];
  await assert.rejects(commerce.get(order.id, merchantB), (error) => error.code === "FORBIDDEN");
  assert.equal((await commerce.get(order.id, merchantA)).id, order.id); assert.equal((await commerce.get(order.id, admin)).id, order.id);
  const cancelled = await commerce.cancel(order.id, "changed mind", customer); assert.equal(cancelled.fulfillmentStatus, "cancelled"); assert.equal(repository.products.findById("PRODUCT-A").stock, 3);
  await assert.rejects(commerce.cancel(order.id, "again", customer)); assert.equal(repository.products.findById("PRODUCT-A").stock, 3);
});

test("Failed multi-item checkout rolls back stock and checkout transaction", async () => {
  const { repository, commerce } = fixture();
  await assert.rejects(commerce.create({ ...checkout, items: [{ productId: "PRODUCT-A", quantity: 2 }, { productId: "PRODUCT-V", productVariantId: "VARIANT-V", quantity: 3 }] }, customer, "rollback-key"));
  assert.equal(repository.products.findById("PRODUCT-A").stock, 3); assert.equal(await repository.commerce.findCheckout(customer.id, "rollback-key"), undefined);
});

test("Parallel checkout with the same idempotency key returns the winning checkout instead of a 409", async () => {
  let lookups = 0; const winner = { id: "CHECKOUT-W", idempotencyKey: "same", orders: [{ id: "ORDER-W" }] };
  const repository = { commerce: { findCheckout: async () => (lookups++ === 0 ? null : winner) }, transaction: async () => { const error = new Error("Unique constraint failed"); error.code = "P2002"; throw error; } };
  const result = await createCommerceService(repository).create(checkout, customer, "same");
  assert.equal(result, winner);
});

test("Fulfillment endpoint cannot cancel or skip the courier; only the store owner advances store steps", async () => {
  const { repository, commerce } = fixture(); const order = (await commerce.create(checkout, customer, "transition-key")).orders[0];
  await assert.rejects(commerce.transition(order.id, "cancelled", customer), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(commerce.transition(order.id, "confirmed", customer), (error) => error.code === "FORBIDDEN");
  assert.equal(repository.products.findById("PRODUCT-A").stock, 1, "stok tidak boleh berubah tanpa pembatalan resmi");
  await assert.rejects(commerce.transition(order.id, "confirmed", merchantB), (error) => error.code === "FORBIDDEN");
  for (const status of ["confirmed", "processing"]) assert.equal((await commerce.transition(order.id, status, merchantA)).fulfillmentStatus, status);
});

test("Store or admin cancellation requires a reason for the buyer", async () => {
  const { commerce } = fixture(); const order = (await commerce.create(checkout, customer, "reason-key")).orders[0];
  await assert.rejects(commerce.cancel(order.id, "   ", merchantA), (error) => error.code === "VALIDATION_ERROR" && Boolean(error.details?.reason));
  assert.equal((await commerce.cancel(order.id, "Stok habis", merchantA)).fulfillmentStatus, "cancelled");
});

test("Daftar pesanan mengikuti scope: milik sendiri, toko milik, atau semua (admin) — tanpa menarik pesanan orang lain", async () => {
  const { repository, commerce } = fixture();
  const first = await commerce.create(checkout, customer, "scope-a");
  const merchantOwnPurchase = await commerce.create({ ...checkout, items: [{ productId: "PRODUCT-A", quantity: 1 }] }, merchantA, "scope-b");
  const ids = (rows) => rows.map((order) => order.id).sort();
  // pembeli biasa: hanya miliknya
  assert.deepEqual(ids(await commerce.list(customer)), [first.orders[0].id]);
  // penjual yang juga pembeli: tanpa scope = belanjanya sendiri (bukan pesanan toko), scope merchant = pesanan tokonya
  assert.deepEqual(ids(await commerce.list(merchantA)), [merchantOwnPurchase.orders[0].id]);
  assert.deepEqual(ids(await commerce.list(merchantA, { scope: "merchant" })), ids([first.orders[0], merchantOwnPurchase.orders[0]]));
  assert.deepEqual(await commerce.list(merchantB, { scope: "merchant" }), []);
  assert.deepEqual(await commerce.list(merchantA, { scope: "merchant", storeId: "STORE-LAIN" }), []);
  // scope admin hanya untuk admin
  await assert.rejects(commerce.list(customer, { scope: "admin" }), (error) => error.code === "FORBIDDEN");
  await assert.rejects(commerce.list(merchantA, { scope: "admin" }), (error) => error.code === "FORBIDDEN");
  await assert.rejects(commerce.list(customer, { scope: "merchant" }), (error) => error.code === "FORBIDDEN");
  assert.equal((await commerce.list(admin, { scope: "admin" })).length, 2);
  // batas jumlah & tanggal
  assert.equal((await commerce.list(admin, { scope: "admin", limit: "1" })).length, 1);
  assert.equal((await commerce.list(admin, { scope: "admin", since: "2999-01-01" })).length, 0);
  assert.equal(repository.products.findById("PRODUCT-A").stock, 0);
});

