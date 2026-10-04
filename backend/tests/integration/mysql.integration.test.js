const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createApp } = require("../../app");
const { getPrisma, disconnectPrisma } = require("../../config/prisma");
const { createPrismaRepository } = require("../../repositories/prismaRepository");
const { createAuthService } = require("../../services/authService");
const { generateCommerceFinance } = require("../../services/financeService");
const { createNotificationService } = require("../../services/notificationService");
const { assertDedicatedTestDatabase } = require("../helpers/testDatabaseGuard");

assertDedicatedTestDatabase(process.env.DATABASE_URL);
const prisma = getPrisma();
let server;
let baseUrl;

const request = async (path, { token, body, method = "GET", headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const login = async (email, password = process.env.DEV_SEED_PASSWORD) => (await request("/api/auth/login", { method: "POST", body: { email, password } })).body.data.token;

test.before(async () => {
  await prisma.$connect();
  await prisma.session.deleteMany({ where: { user: { email: { endsWith: "@integration.kucur.test" } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@integration.kucur.test" } } });
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await disconnectPrisma();
});

test("seed is idempotent and contains normalized shared records", async () => {
  assert.equal(await prisma.role.count(), 4);
  assert.equal(await prisma.platformSettings.count({ where: { id: "active" } }), 1);
  assert.equal(await prisma.user.count({ where: { email: { in: ["admin@kucur.test", "customer@kucur.test", "merchant.a@kucur.test", "merchant.b@kucur.test", "courier@kucur.test"] } } }), 5);
  const seeded = await prisma.user.findUniqueOrThrow({ where: { email: "customer@kucur.test" }, select: { passwordHash: true } });
  assert.match(seeded.passwordHash, /^scrypt:/);
  assert.notEqual(seeded.passwordHash, process.env.DEV_SEED_PASSWORD);
  assert.equal(await prisma.product.count({ where: { id: { in: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "20000000-0000-4000-8000-000000000003"] } } }), 3);
  assert.equal(await prisma.productVariant.count({ where: { productId: "20000000-0000-4000-8000-000000000002" } }), 3);
  assert.equal(await prisma.productVariant.count({ where: { productId: "20000000-0000-4000-8000-000000000002", stock: 0 } }), 1);
  assert.equal(await prisma.storeInitialFee.count({ where: { id: { in: ["31000000-0000-4000-8000-000000000001", "31000000-0000-4000-8000-000000000002", "31000000-0000-4000-8000-000000000003"] } } }), 3);
  assert.equal(await prisma.storeInstallment.count({ where: { storeInitialFeeId: "31000000-0000-4000-8000-000000000003" } }), 6);
  assert.equal(await prisma.adminFeeObligation.count({ where: { id: { in: ["44000000-0000-4000-8000-000000000001", "44000000-0000-4000-8000-000000000002"] } } }), 2);
});

test("Product catalog enforces Store ownership, nested integrity, visibility, and audit", async () => {
  const merchantA = await login("merchant.a@kucur.test");
  const merchantB = await login("merchant.b@kucur.test");
  const payload = { storeId: "10000000-0000-4000-8000-000000000001", name: `Integration Product ${Date.now()}`, description: "Nested transaction fixture", category: "Makanan", status: "active", hasVariants: true, images: [], variantGroups: [{ name: "Rasa", options: ["Original", "Pedas"] }], variants: [{ sku: `INT-ORI-${Date.now()}`, options: { Rasa: "Original" }, price: 10000, stock: 3, status: "active" }, { sku: `INT-PED-${Date.now()}`, options: { Rasa: "Pedas" }, price: 12000, stock: 0, status: "active" }] };
  const created = await request("/api/products", { token: merchantA, method: "POST", body: payload });
  assert.equal(created.status, 201);
  const productId = created.body.data.id;
  assert.equal((await request(`/api/products/${productId}`)).status, 200);
  assert.equal((await request(`/api/products/${productId}?scope=manage`, { token: merchantB })).status, 403);
  assert.equal((await request("/api/products", { token: merchantB, method: "POST", body: payload })).status, 403);
  const duplicate = { ...payload, variants: [payload.variants[0], { ...payload.variants[0], sku: `INT-DUP-${Date.now()}` }] };
  assert.equal((await request("/api/products", { token: merchantA, method: "POST", body: duplicate })).status, 409);
  assert.equal((await request(`/api/products/${productId}`, { token: merchantA, method: "PATCH", body: { status: "inactive" } })).status, 200);
  assert.equal((await request(`/api/products/${productId}`)).status, 404);
  assert.equal((await request(`/api/products/${productId}?scope=manage`, { token: merchantA })).status, 200);
  assert.ok(await prisma.auditRecord.findFirst({ where: { entityType: "product", entityId: productId, activityType: "PRODUCT_CREATED" } }));
});

test("register, conflict, login, persistent session, expiration, and logout use MySQL", async () => {
  const email = "registered@integration.kucur.test";
  const registration = await request("/api/auth/register", { method: "POST", body: { fullName: "Integration Customer", email, phone: "081288887777", password: "Integration123!" } });
  assert.equal(registration.status, 201);
  assert.deepEqual(registration.body.data.roles, ["customer"]);
  const persisted = await prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } } } });
  assert.match(persisted.passwordHash, /^scrypt:/);
  assert.notEqual(persisted.passwordHash, "Integration123!");
  const duplicate = await request("/api/auth/register", { method: "POST", body: { fullName: "Duplicate", email, phone: "081288887777", password: "Integration123!" } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "CONFLICT");
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email, password: "wrong-password" } })).status, 401);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "unknown@integration.kucur.test", password: "wrong-password" } })).status, 401);
  const token = await login(email, "Integration123!");
  const storedSession = await prisma.session.findUniqueOrThrow({ where: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") } });
  assert.notEqual(storedSession.tokenHash, token);
  assert.equal((await request("/api/auth/me", { token })).status, 200);
  const reconnectedAuth = createAuthService(createPrismaRepository(prisma));
  assert.equal((await reconnectedAuth.authenticate(token)).email, email);
  const expiredToken = "controlled-expired-token";
  await prisma.session.create({ data: { tokenHash: crypto.createHash("sha256").update(expiredToken).digest("hex"), userId: persisted.id, expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await reconnectedAuth.authenticate(expiredToken), null);
  assert.equal((await request("/api/auth/logout", { token, method: "POST" })).status, 204);
  assert.equal((await request("/api/auth/me", { token })).status, 401);
  assert.ok((await prisma.session.findUniqueOrThrow({ where: { id: storedSession.id } })).revokedAt);
  const merchantToken = await login("merchant.a@kucur.test");
  assert.deepEqual((await request("/api/auth/me", { token: merchantToken })).body.data.roles.sort(), ["customer", "merchant"]);
});

test("Store ownership, location, Settings, Audit, and transaction rollback persist", async () => {
  const merchantA = await login("merchant.a@kucur.test");
  const merchantB = await login("merchant.b@kucur.test");
  const customer = await login("customer@kucur.test");
  const admin = await login("admin@kucur.test");
  const created = await request("/api/stores", { token: merchantA, method: "POST", body: { name: `Integration Store ${Date.now()}`, type: "live-in", description: "Persistent Store", phone: "081234567890", image: "https://example.test/store.webp", merchantUserId: "00000000-0000-4000-8000-000000000004", location: { source: "local", locationRef: null, label: "Kucur", address: "Malang", latitude: null, longitude: null } } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.merchantUserId, "00000000-0000-4000-8000-000000000003");
  const storeId = created.body.data.id;
  const restartedRepositoryStore = await createPrismaRepository(prisma).stores.findById(storeId);
  assert.equal(restartedRepositoryStore.location.latitude, null);
  assert.equal(restartedRepositoryStore.location.source, "local");
  assert.equal(restartedRepositoryStore.phone, "081234567890");
  assert.equal((await request(`/api/stores/${storeId}`, { token: merchantA })).status, 200);
  assert.equal((await request(`/api/stores/${storeId}`, { token: merchantB })).status, 403);
  assert.equal((await request("/api/stores", { token: merchantB })).body.data.some((store) => store.id === storeId), false);
  assert.equal((await request("/api/stores", { token: merchantA, method: "POST", body: { name: "Invalid Type", type: "all", description: "Must fail" } })).status, 400);
  const forbidden = await request(`/api/stores/${storeId}`, { token: merchantB, method: "PATCH", body: { name: "Hijacked" } });
  assert.equal(forbidden.status, 403);
  assert.notEqual((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).name, "Hijacked");
  assert.equal((await request(`/api/stores/${storeId}`, { token: merchantA, method: "PATCH", body: { location: { label: "Kucur", address: "Malang", latitude: -7.95, longitude: 112.55 } } })).status, 200);
  assert.equal(Number((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).latitude), -7.95);
  assert.equal((await request(`/api/stores/${storeId}`, { token: merchantA, method: "PATCH", body: { location: { latitude: -91, longitude: 112 } } })).status, 400);
  assert.equal((await request(`/api/stores/${storeId}`, { token: merchantA, method: "PATCH", body: { location: { latitude: -7, longitude: null } } })).status, 400);
  assert.equal((await request("/api/settings", { token: customer, method: "PATCH", body: { maxDailyDeliveries: 41 } })).status, 403);
  assert.equal((await request("/api/settings", { token: merchantA, method: "PATCH", body: { maxDailyDeliveries: 41 } })).status, 403);
  assert.equal((await request("/api/settings", { token: admin, method: "PATCH", body: { maxDailyDeliveries: 41 } })).status, 200);
  assert.equal((await createPrismaRepository(prisma).settings.get()).maxDailyDeliveries, 41);
  assert.equal((await request("/api/settings", { token: customer })).body.data.maxDailyDeliveries, 41);
  const financial = { initialStoreFeeAmount: 125000, installmentLateInterestPercent: 2.5, adminFeeType: "fixed", adminFeeValue: 4500, adminFeeCutoffDay: 1, adminFeeGraceTime: "12:00", taxPercent: 11, prideTransactionValueWeight: 40, prideTransactionCountWeight: 20, prideRatingWeight: 20, prideCompletionRateWeight: 20, prideLeaderboardSize: 7 };
  assert.equal((await request("/api/settings", { token: admin, method: "PATCH", body: financial })).status, 200);
  const recreatedSettings = await createPrismaRepository(prisma).settings.get();
  for (const [key, value] of Object.entries(financial)) assert.equal(recreatedSettings[key], value);
  const settingsBeforeInvalid = { ...recreatedSettings };
  assert.equal((await request("/api/settings", { token: admin, method: "PATCH", body: { prideTransactionValueWeight: 80, adminFeeValue: 9000 } })).status, 400);
  const settingsAfterInvalid = await createPrismaRepository(prisma).settings.get();
  assert.equal(settingsAfterInvalid.prideTransactionValueWeight, settingsBeforeInvalid.prideTransactionValueWeight);
  assert.equal(settingsAfterInvalid.adminFeeValue, settingsBeforeInvalid.adminFeeValue);
  assert.ok(await prisma.auditRecord.findFirst({ where: { entityType: "store", entityId: storeId, activityType: "STORE_CREATED" } }));
  assert.ok(await prisma.auditRecord.findFirst({ where: { entityType: "platform-settings", activityType: "SETTINGS_UPDATED" } }));
  const rollbackName = `Rollback ${Date.now()}`;
  await assert.rejects(createPrismaRepository(prisma).transaction(async (tx) => {
    const store = await tx.stores.create({ merchantUserId: "00000000-0000-4000-8000-000000000003", name: rollbackName, type: "product", description: "Must roll back", status: "active", location: { label: null, address: null, latitude: null, longitude: null } });
    await tx.audits.append({ entityType: "store", entityId: store.id, actorId: "ffffffff-ffff-4fff-8fff-ffffffffffff", actorRole: "merchant", activityType: "FORCED_FAILURE", description: "Foreign key failure", isSystem: false });
  }));
  assert.equal(await prisma.store.count({ where: { name: rollbackName } }), 0);
});

test("health endpoints distinguish liveness and database readiness", async () => {
  assert.deepEqual((await request("/health/live")).body.data, { status: "alive" });
  assert.deepEqual((await request("/health/ready")).body.data, { status: "ready", database: "reachable" });
});

test("account mutations persist profile, preferences, and scrypt password in MySQL", async () => {
  const email = `account.${Date.now()}@integration.kucur.test`;
  await request("/api/auth/register", { method: "POST", body: { fullName: "Account Integration", email, phone: "081277776666", password: "Integration123!" } });
  const token = await login(email, "Integration123!");
  const nextEmail = `account.updated.${Date.now()}@integration.kucur.test`;
  assert.equal((await request("/api/users/me", { token, method: "PATCH", body: { fullName: "Account Updated", email: nextEmail, phone: "081277776665" } })).status, 200);
  const preferences = await request("/api/users/me/preferences", { token, method: "PATCH", body: { language: "en", theme: "dark" } });
  assert.deepEqual(preferences.body.data.preferences, { language: "en", theme: "dark" });
  assert.equal((await request("/api/users/me/password", { token, method: "PATCH", body: { currentPassword: "Integration123!", newPassword: "Integration456!" } })).status, 200);
  assert.equal((await request("/api/auth/me", { token })).status, 200);
  const persisted = await prisma.user.findUniqueOrThrow({ where: { email: nextEmail } });
  assert.equal(persisted.language, "en"); assert.equal(persisted.theme, "dark"); assert.match(persisted.passwordHash, /^scrypt:/);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: nextEmail, password: "Integration456!" } })).status, 200);
});

test("Cart, multi-Store checkout, snapshots, idempotency, ownership and stock release persist in MySQL", async () => {
  const customer = await login("customer@kucur.test"); const merchantA = await login("merchant.a@kucur.test"); const merchantB = await login("merchant.b@kucur.test"); const admin = await login("admin@kucur.test");
  const productA = "20000000-0000-4000-8000-000000000001"; const productB = "20000000-0000-4000-8000-000000000003";
  const originalA = (await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock; const originalB = (await prisma.product.findUniqueOrThrow({ where: { id: productB } })).stock;
  let checkoutId;
  try {
    await prisma.cart.deleteMany({ where: { customer: { email: "customer@kucur.test" } } });
    assert.equal((await request("/api/cart/items", { token: customer, method: "POST", body: { productId: productA, quantity: 1, customerUserId: "00000000-0000-4000-8000-000000000004" } })).status, 201);
    assert.equal((await request("/api/cart/items", { token: customer, method: "POST", body: { productId: productB, quantity: 1 } })).status, 201);
    const persistedCart = await createPrismaRepository(prisma).commerce.getCart("00000000-0000-4000-8000-000000000002"); assert.equal(persistedCart.items.length, 2);
    const previewPayload = { cartItemIds: persistedCart.items.map((item) => item.id), productTotal: 1, delivery: { address: "Desa Kucur", recipientName: "Customer", recipientPhone: "081234567890", location: { latitude: -7.94, longitude: 112.57 } }, paymentMethod: "COD" };
    const key = `integration-${Date.now()}`; const created = await request("/api/checkout/orders", { token: customer, method: "POST", headers: { "Idempotency-Key": key }, body: previewPayload });
    assert.equal(created.status, 201); checkoutId = created.body.data.id; assert.equal(created.body.data.orders.length, 2); assert.equal(created.body.data.orders.reduce((sum, order) => sum + order.productTotal, 0), 90000);
    const repeated = await request("/api/checkout/orders", { token: customer, method: "POST", headers: { "Idempotency-Key": key }, body: previewPayload }); assert.equal(repeated.body.data.id, checkoutId);
    assert.equal((await request("/api/cart", { token: customer })).body.data.items.length, 0);
    const [orderA, orderB] = created.body.data.orders; assert.equal((await request(`/api/orders/${orderA.id}`, { token: merchantA })).status, 200); assert.equal((await request(`/api/orders/${orderA.id}`, { token: merchantB })).status, 403); assert.equal((await request(`/api/orders/${orderA.id}`, { token: admin })).status, 200);
    assert.equal((await prisma.stockReservation.count({ where: { order: { checkoutTransactionId: checkoutId }, status: "reserved" } })), 2);
    assert.equal((await prisma.commerceOrderItem.findFirstOrThrow({ where: { orderId: orderA.id } })).productName, "Keripik Tempe Kucur");
    assert.equal((await request(`/api/orders/${orderA.id}/cancel`, { token: customer, method: "POST", body: { reason: "integration cleanup" } })).status, 200);
    assert.equal((await request(`/api/orders/${orderB.id}/cancel`, { token: customer, method: "POST", body: { reason: "integration cleanup" } })).status, 200);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock, originalA); assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productB } })).stock, originalB);
  } finally {
    if (checkoutId) { await prisma.commerceOrder.deleteMany({ where: { checkoutTransactionId: checkoutId } }); await prisma.checkoutTransaction.deleteMany({ where: { id: checkoutId } }); }
    await prisma.cart.deleteMany({ where: { customer: { email: "customer@kucur.test" } } });
    await prisma.product.update({ where: { id: productA }, data: { stock: originalA } }); await prisma.product.update({ where: { id: productB }, data: { stock: originalB } });
  }
});

test("Concurrent checkout cannot oversell and Midtrans unavailable is controlled", async () => {
  const customer = await login("customer@kucur.test"); const productId = "20000000-0000-4000-8000-000000000001"; const originalStock = (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
  const checkoutIds = [];
  const payload = { items: [{ productId, quantity: 1 }], paymentMethod: "COD", delivery: { address: "Desa Kucur", recipientName: "Customer", recipientPhone: "081234567890", location: { latitude: -7.94, longitude: 112.57 } } };
  try {
    await prisma.product.update({ where: { id: productId }, data: { stock: 1 } });
    const [first, second] = await Promise.all([request("/api/checkout/orders", { token: customer, method: "POST", headers: { "Idempotency-Key": `race-a-${Date.now()}` }, body: payload }), request("/api/checkout/orders", { token: customer, method: "POST", headers: { "Idempotency-Key": `race-b-${Date.now()}` }, body: payload })]);
    assert.deepEqual([first.status, second.status].sort(), [201, 409]); const winner = first.status === 201 ? first : second; checkoutIds.push(winner.body.data.id);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock, 0); assert.equal(await prisma.stockReservation.count({ where: { order: { checkoutTransactionId: winner.body.data.id }, status: "reserved" } }), 1);
    const orderId = winner.body.data.orders[0].id; assert.equal((await request(`/api/orders/${orderId}/cancel`, { token: customer, method: "POST", body: { reason: "race cleanup" } })).status, 200); assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock, 1);
    const providers = await request("/api/payments/providers"); assert.equal(providers.body.midtrans.configured, false);
    const midtrans = await request("/api/checkout/preview", { token: customer, method: "POST", body: { ...payload, paymentMethod: "MIDTRANS" } }); assert.equal(midtrans.status, 503); assert.equal(midtrans.body.code, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  } finally {
    for (const id of checkoutIds) { await prisma.commerceOrder.deleteMany({ where: { checkoutTransactionId: id } }); await prisma.checkoutTransaction.deleteMany({ where: { id } }); }
    await prisma.product.update({ where: { id: productId }, data: { stock: originalStock } });
  }
});

test("Tourism persists packages, overlap guard, concurrent capacity, PPN ledger, cancellation and Admin Fee", async () => {
  const merchant = await login("merchant.a@kucur.test"); const customer = await login("customer@kucur.test"); const suffix = crypto.randomUUID();
  const storeId = "51000000-0000-4000-8000-000000000001"; let packageId; const bookingIds = [];
  try {
    const created = await request("/api/tourism/packages", { token: merchant, method: "POST", body: { storeId, name: `Wisata Integration ${suffix}`, category: "NON_EDUCATIONAL", description: "MySQL tourism integration fixture", durationMinutes: 90, pricePerPax: 25000 } });
    assert.equal(created.status, 201); packageId = created.body.data.id;
    assert.equal((await request("/api/tourism/packages", { method: "POST", token: customer, body: { storeId, name: "Forbidden", category: "EDUCATIONAL", description: "Forbidden", durationMinutes: 60, pricePerPax: 1 } })).status, 403);
    const startAt = new Date(Date.now() + 7 * 86400000); startAt.setUTCMinutes(0, 0, 0);
    const schedule = await request(`/api/tourism/packages/${packageId}/schedules`, { token: merchant, method: "POST", body: { startAt: startAt.toISOString(), capacity: 2 } }); assert.equal(schedule.status, 201);
    assert.equal((await request(`/api/tourism/packages/${packageId}/schedules`, { token: merchant, method: "POST", body: { startAt: new Date(startAt.getTime() + 30 * 60000).toISOString(), capacity: 10 } })).status, 409);
    const payload = { tourismPackageId: packageId, tourismScheduleId: schedule.body.data.id, paxCount: 2, bookingName: "Integration Group", paymentMethod: "COD" };
    const attempts = await Promise.all([request("/api/tourism/bookings", { token: customer, method: "POST", body: payload }), request("/api/tourism/bookings", { token: customer, method: "POST", body: payload })]);
    assert.deepEqual(attempts.map((row) => row.status).sort(), [201, 409]); const winner = attempts.find((row) => row.status === 201).body.data; bookingIds.push(winner.id);
    const persisted = await prisma.tourismBooking.findUniqueOrThrow({ where: { id: winner.id }, include: { platformTransaction: { include: { paymentAttempts: true } } } });
    assert.equal(Number(persisted.taxPercentSnapshot), 11); assert.equal(persisted.platformTransaction.type, "TOURISM"); assert.equal(persisted.platformTransaction.paymentAttempts.length, 1);
    assert.equal((await prisma.tourismSchedule.findUniqueOrThrow({ where: { id: schedule.body.data.id } })).reservedPax, 2);
    assert.equal((await request(`/api/tourism/bookings/${winner.id}/status`, { token: customer, method: "PATCH", body: { status: "CANCELLED", reason: "capacity check" } })).status, 200);
    assert.equal((await prisma.tourismSchedule.findUniqueOrThrow({ where: { id: schedule.body.data.id } })).reservedPax, 0);
    const secondSchedule = await request(`/api/tourism/packages/${packageId}/schedules`, { token: merchant, method: "POST", body: { startAt: new Date(startAt.getTime() + 3 * 3600000).toISOString(), capacity: 3 } });
    const second = await request("/api/tourism/bookings", { token: customer, method: "POST", body: { ...payload, tourismScheduleId: secondSchedule.body.data.id, paxCount: 1 } }); assert.equal(second.status, 201); bookingIds.push(second.body.data.id);
    assert.equal((await request(`/api/tourism/bookings/${second.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "APPROVED" } })).status, 200);
    assert.equal((await request(`/api/tourism/bookings/${second.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "COMPLETED" } })).status, 200);
    assert.equal(await prisma.adminFeeObligation.count({ where: { platformTransactionId: second.body.data.platformTransactionId } }), 1);
  } finally {
    if (packageId) { await prisma.adminFeeObligation.deleteMany({ where: { platformTransaction: { tourismBooking: { tourismPackageId: packageId } } } }); await prisma.paymentAttempt.deleteMany({ where: { platformTransaction: { tourismBooking: { tourismPackageId: packageId } } } }); await prisma.tourismBookingActivity.deleteMany({ where: { booking: { tourismPackageId: packageId } } }); await prisma.auditRecord.deleteMany({ where: { entityType: "tourism", entityId: { in: [packageId, ...bookingIds] } } }); await prisma.tourismBooking.deleteMany({ where: { tourismPackageId: packageId } }); await prisma.platformTransaction.deleteMany({ where: { storeId, sourceEntityId: { in: bookingIds } } }); await prisma.tourismSchedule.deleteMany({ where: { tourismPackageId: packageId } }); await prisma.tourismPackage.deleteMany({ where: { id: packageId } }); }
  }
});

test("Live In persists meals, multi-room snapshots, availability locking, group acceptance and finance", async () => {
  const merchant = await login("merchant.a@kucur.test"); const customerA = await login("customer@kucur.test"); const customerB = await login("merchant.b@kucur.test");
  const profileId = "62000000-0000-4000-8000-000000000001"; const storeId = "61000000-0000-4000-8000-000000000001"; const roomIds = []; const bookingIds = []; let groupRequestId;
  try {
    const profile = await request(`/api/live-in/profiles/${profileId}`); assert.equal(profile.status, 200); assert.equal(profile.body.data.mealPlan.mealsPerDay, 2);
    const first = await request(`/api/live-in/profiles/${profileId}/rooms`, { token: merchant, method: "POST", body: { name: `Integration Room A ${Date.now()}`, capacity: 2, pricePerNight: 100000 } }); const second = await request(`/api/live-in/profiles/${profileId}/rooms`, { token: merchant, method: "POST", body: { name: `Integration Room B ${Date.now()}`, capacity: 4, pricePerNight: 150000 } }); assert.equal(first.status, 201); assert.equal(second.status, 201); roomIds.push(first.body.data.id, second.body.data.id);
    assert.equal((await request(`/api/live-in/rooms/${second.body.data.id}/meal-override`, { token: merchant, method: "PUT", body: { mealsPerDay: 3, notes: "Integration override" } })).status, 200);
    assert.equal((await request(`/api/live-in/profiles/${profileId}/rooms`, { token: customerA, method: "POST", body: { name: "Forbidden", capacity: 1, pricePerNight: 1 } })).status, 403);
    const multi = await request("/api/live-in/bookings", { token: customerA, method: "POST", body: { liveInProfileId: profileId, roomIds, checkIn: "2026-11-10", checkOut: "2026-11-12", bookingName: "Multi Room QA", paymentMethod: "COD" } }); assert.equal(multi.status, 201); bookingIds.push(multi.body.data.id); assert.equal(multi.body.data.rooms.length, 2); assert.equal(multi.body.data.nightCount, 2); assert.equal(Number(multi.body.data.subtotal), 500000); assert.deepEqual(multi.body.data.rooms.map((row) => row.mealsPerDaySnapshot).sort(), [2, 3]);
    const overlap = await request(`/api/live-in/profiles/${profileId}/availability?checkIn=2026-11-11&checkOut=2026-11-13`); assert.equal(Number(overlap.body.data.taxPercent), 11); assert.equal(overlap.body.data.rooms.filter((room) => roomIds.includes(room.id)).every((room) => !room.available), true);
    const adjacent = await request(`/api/live-in/profiles/${profileId}/availability?checkIn=2026-11-12&checkOut=2026-11-14`); assert.equal(adjacent.body.data.rooms.filter((room) => roomIds.includes(room.id)).every((room) => room.available), true);
    const racePayload = { liveInProfileId: profileId, roomIds: [roomIds[0]], checkIn: "2026-12-10", checkOut: "2026-12-12", bookingName: "Race QA", paymentMethod: "COD" }; const race = await Promise.all([request("/api/live-in/bookings", { token: customerA, method: "POST", body: racePayload }), request("/api/live-in/bookings", { token: customerB, method: "POST", body: racePayload })]); assert.deepEqual(race.map((row) => row.status).sort(), [201, 409]); const raceWinner = race.find((row) => row.status === 201).body.data; bookingIds.push(raceWinner.id);
    assert.equal((await prisma.liveInRoomNightReservation.count({ where: { liveInRoomId: roomIds[0], stayDate: { in: [new Date("2026-12-10"), new Date("2026-12-11")] } } })), 2);
    assert.equal((await request(`/api/live-in/bookings/${raceWinner.id}/status`, { token: raceWinner.customerUserId === "00000000-0000-4000-8000-000000000002" ? customerA : customerB, method: "PATCH", body: { status: "CANCELLED" } })).status, 200); assert.equal(await prisma.liveInRoomNightReservation.count({ where: { liveInBookingId: raceWinner.id } }), 0); assert.equal(await prisma.paymentAttempt.count({ where: { platformTransactionId: raceWinner.platformTransactionId, status: "cancelled" } }), 1);
    const complete = await request("/api/live-in/bookings", { token: customerA, method: "POST", body: { ...racePayload, checkIn: "2027-01-10", checkOut: "2027-01-11" } }); assert.equal(complete.status, 201); bookingIds.push(complete.body.data.id); assert.equal((await request(`/api/live-in/bookings/${complete.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "CONFIRMED" } })).status, 200); assert.equal((await request(`/api/live-in/bookings/${complete.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "CHECKED_IN" } })).status, 200); assert.equal((await request(`/api/live-in/bookings/${complete.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "COMPLETED" } })).status, 200); assert.equal((await request(`/api/live-in/bookings/${complete.body.data.id}/status`, { token: merchant, method: "PATCH", body: { status: "COMPLETED" } })).status, 200); assert.equal(await prisma.adminFeeObligation.count({ where: { platformTransactionId: complete.body.data.platformTransactionId } }), 1);
    const group = await request("/api/live-in/group-requests", { token: customerA, method: "POST", body: { liveInProfileId: profileId, groupName: "Integration Group", requestedCheckIn: "2027-02-10", requestedCheckOut: "2027-02-12", paxCount: 6, notes: "Integration" } }); assert.equal(group.status, 201); groupRequestId = group.body.data.id;
    const offer = await request(`/api/live-in/group-requests/${groupRequestId}/offers`, { token: merchant, method: "POST", body: { offeredCheckIn: "2027-02-10", offeredCheckOut: "2027-02-12", offeredPax: 6, offeredPrice: 900000, roomIds, mealNotes: "Custom meals", expiresAt: "2027-02-01T00:00:00.000Z" } }); assert.equal(offer.status, 201); assert.equal(offer.body.data.rooms.length, 2);
    const accepted = await request(`/api/live-in/group-offers/${offer.body.data.id}/accept`, { token: customerA, method: "POST" }); assert.equal(accepted.status, 200); bookingIds.push(accepted.body.data.id); assert.equal(accepted.body.data.bookingType, "CUSTOM_GROUP"); const retried = await request(`/api/live-in/group-offers/${offer.body.data.id}/accept`, { token: customerA, method: "POST" }); assert.equal(retried.body.data.id, accepted.body.data.id); assert.equal(await prisma.platformTransaction.count({ where: { sourceEntityId: accepted.body.data.id, type: "LIVE_IN" } }), 1);
  } finally {
    await prisma.adminFeeObligation.deleteMany({ where: { platformTransaction: { sourceEntityId: { in: bookingIds } } } }); await prisma.paymentAttempt.deleteMany({ where: { platformTransaction: { sourceEntityId: { in: bookingIds } } } }); await prisma.liveInBookingActivity.deleteMany({ where: { booking: { id: { in: bookingIds } } } }); await prisma.liveInRoomNightReservation.deleteMany({ where: { liveInBookingId: { in: bookingIds } } }); await prisma.liveInBookingRoom.deleteMany({ where: { liveInBookingId: { in: bookingIds } } }); await prisma.liveInBooking.deleteMany({ where: { id: { in: bookingIds } } }); await prisma.platformTransaction.deleteMany({ where: { sourceEntityId: { in: bookingIds } } }); if (groupRequestId) { await prisma.liveInGroupOfferRoom.deleteMany({ where: { offer: { groupRequestId } } }); await prisma.liveInGroupOffer.deleteMany({ where: { groupRequestId } }); await prisma.liveInGroupRequest.deleteMany({ where: { id: groupRequestId } }); } await prisma.liveInRoomMealOverride.deleteMany({ where: { roomId: { in: roomIds } } }); await prisma.liveInRoom.deleteMany({ where: { id: { in: roomIds } } });
  }
});

test("Notification API enforces ownership, pagination, read state and concurrent dedupe", async () => {
  const customer = await login("customer@kucur.test"); const merchant = await login("merchant.a@kucur.test"); const customerId = "00000000-0000-4000-8000-000000000002"; const merchantId = "00000000-0000-4000-8000-000000000003";
  await prisma.notification.updateMany({ where: { userId: customerId }, data: { readAt: null } });
  const own = await request("/api/notifications?page=1&limit=2", { token: customer }); assert.equal(own.status, 200); assert.equal(own.body.data.items.length, 2); assert.ok(own.body.data.pagination.total >= 3); assert.ok(new Date(own.body.data.items[0].createdAt) >= new Date(own.body.data.items[1].createdAt));
  const merchantRow = await prisma.notification.findFirstOrThrow({ where: { userId: merchantId } }); assert.equal((await request(`/api/notifications/${merchantRow.id}/read`, { token: customer, method: "PATCH" })).status, 404);
  const ownId = own.body.data.items[0].id; assert.equal((await request(`/api/notifications/${ownId}/read`, { token: customer, method: "PATCH" })).status, 200); assert.ok((await prisma.notification.findUniqueOrThrow({ where: { id: ownId } })).readAt);
  assert.equal((await request("/api/notifications/read-all", { token: customer, method: "PATCH" })).status, 200); assert.equal((await request("/api/notifications/unread-count", { token: customer })).body.data.unreadCount, 0); assert.ok(await prisma.notification.count({ where: { userId: merchantId, readAt: null } }));
  const key=`integration-dedupe:${Date.now()}:${customerId}`; const service=createNotificationService(createPrismaRepository(prisma)); const payload={userId:customerId,type:"REVIEW_REPLIED",title:"Concurrent",body:"Concurrent dedupe",entityType:"REVIEW",entityId:"73000000-0000-4000-8000-000000000001",dedupeKey:key}; const calls=await Promise.all([service.createNotification(payload),service.createNotification(payload)]); assert.equal(calls.filter(row=>row.created).length,1); assert.equal(await prisma.notification.count({where:{dedupeKey:key}}),1); await prisma.notification.deleteMany({where:{dedupeKey:key}});
});

test("Review persists ownership, duplicate concurrency, reply, public aggregation and moderation", async () => {
  const customer = await login("customer@kucur.test"); const merchant = await login("merchant.a@kucur.test"); const admin = await login("admin@kucur.test");
  const itemId = "72000000-0000-4000-8000-000000000001"; const seededReviewId = "73000000-0000-4000-8000-000000000001";
  await prisma.review.delete({ where: { id: seededReviewId } });
  const attempts = await Promise.all([request(`/api/reviews/product/${itemId}`, { token: customer, method: "POST", body: { rating: 5, comment: "Integration review" } }), request(`/api/reviews/product/${itemId}`, { token: customer, method: "POST", body: { rating: 4, comment: "Duplicate" } })]);
  assert.deepEqual(attempts.map((row) => row.status).sort(), [201,409]); const created = attempts.find((row) => row.status === 201).body.data;
  assert.equal((await request(`/api/reviews/product/${itemId}`, { token: merchant, method: "POST", body: { rating: 5 } })).status, 403);
  const publicBefore = await request("/api/products/20000000-0000-4000-8000-000000000001/reviews"); assert.equal(publicBefore.body.data.summary.count, 1); assert.equal(publicBefore.body.data.summary.average, created.rating);
  assert.equal((await request(`/api/merchant/reviews/${created.id}/reply`, { token: merchant, method: "POST", body: { text: "Terima kasih" } })).status, 200);
  assert.equal(await prisma.notification.count({ where: { userId: "00000000-0000-4000-8000-000000000003", type: "REVIEW_CREATED", entityId: created.id } }), 1); assert.equal(await prisma.notification.count({ where: { userId: "00000000-0000-4000-8000-000000000002", type: "REVIEW_REPLIED", entityId: created.id } }), 1); assert.equal(await prisma.notification.count({ where: { userId: "00000000-0000-4000-8000-000000000004", type: "REVIEW_CREATED", entityId: created.id } }), 0);
  assert.equal((await request(`/api/admin/reviews/${created.id}/hide`, { token: admin, method: "PATCH", body: { reason: "Integration moderation" } })).status, 200);
  assert.equal((await request("/api/products/20000000-0000-4000-8000-000000000001/reviews")).body.data.summary.count, 0);
  assert.ok(await prisma.auditRecord.findFirst({ where: { entityType: "Review", entityId: created.id, activityType: "REVIEW_HIDDEN" } }));
  assert.equal((await request(`/api/admin/reviews/${created.id}/show`, { token: admin, method: "PATCH", body: {} })).status, 200);
});

test("Chat persists explicit context, participants, messages, reads, closure, notifications and concurrent dedupe", async () => {
  const customer=await login("customer@kucur.test"),merchantA=await login("merchant.a@kucur.test"),merchantB=await login("merchant.b@kucur.test"),courier=await login("courier@kucur.test"),admin=await login("admin@kucur.test");const customerId="00000000-0000-4000-8000-000000000002",merchantAId="00000000-0000-4000-8000-000000000003";const productId="20000000-0000-4000-8000-000000000001";
  const key=`customer-merchant:${customerId}:${merchantAId}:product:${productId}`;const old=await prisma.conversation.findUnique({where:{openKey:key}});if(old){await prisma.messageRead.deleteMany({where:{message:{conversationId:old.id}}});await prisma.message.deleteMany({where:{conversationId:old.id}});await prisma.conversationContext.deleteMany({where:{conversationId:old.id}});await prisma.conversationParticipant.deleteMany({where:{conversationId:old.id}});await prisma.conversation.delete({where:{id:old.id}});}
  const attempts=await Promise.all([request("/api/conversations/customer-merchant",{token:customer,method:"POST",body:{productId,merchantUserId:"forged"}}),request("/api/conversations/customer-merchant",{token:customer,method:"POST",body:{productId}})]);assert.ok(attempts.every(row=>row.status===201));assert.equal(new Set(attempts.map(row=>row.body.data.id)).size,1);const conversation=attempts[0].body.data;assert.equal(await prisma.conversation.count({where:{openKey:key}}),1);assert.equal(conversation.participants.some(row=>row.userId===merchantAId),true);assert.equal(conversation.context,undefined);const persistedContext=await prisma.conversationContext.findUniqueOrThrow({where:{conversationId:conversation.id}});assert.equal(persistedContext.productId,productId);assert.equal(persistedContext.storeId,"10000000-0000-4000-8000-000000000001");
  assert.equal((await request(`/api/conversations/${conversation.id}`,{token:merchantB})).status,403);assert.equal((await request(`/api/conversations/${conversation.id}/close`,{token:customer,method:"PATCH"})).status,409);assert.equal((await request(`/api/conversations/${conversation.id}/messages`,{token:customer,method:"POST",body:{message:"   "}})).status,400);
  const sent=await request(`/api/conversations/${conversation.id}/messages`,{token:customer,method:"POST",body:{message:"Halo Merchant",senderUserId:"forged"}});assert.equal(sent.status,201);assert.equal((await prisma.message.findUniqueOrThrow({where:{id:sent.body.data.id}})).senderUserId,customerId);assert.equal(await prisma.notification.count({where:{userId:merchantAId,type:"CHAT_MESSAGE_RECEIVED",entityId:conversation.id}}),1);assert.equal(await prisma.notification.count({where:{userId:customerId,type:"CHAT_MESSAGE_RECEIVED",entityId:conversation.id}}),0);
  const merchantList=await request("/api/conversations?unreadOnly=true",{token:merchantA});assert.ok(merchantList.body.data.items.some(row=>row.id===conversation.id));assert.equal((await request(`/api/conversations/${conversation.id}/read`,{token:merchantA,method:"POST"})).status,200);assert.equal((await request(`/api/conversations/${conversation.id}/read`,{token:merchantA,method:"POST"})).status,200);assert.equal(await prisma.messageRead.count({where:{messageId:sent.body.data.id,userId:merchantAId}}),1);
  const tourismBookingId="54000000-0000-4000-8000-000000000001";const tourismChat=await request("/api/conversations/customer-merchant",{token:customer,method:"POST",body:{tourismBookingId,merchantUserId:"forged"}});assert.equal(tourismChat.status,201);assert.equal(tourismChat.body.data.participants.some(row=>row.userId===merchantAId),true);assert.equal((await prisma.conversationContext.findUniqueOrThrow({where:{conversationId:tourismChat.body.data.id}})).tourismBookingId,tourismBookingId);assert.equal((await request("/api/conversations/customer-merchant",{token:merchantB,method:"POST",body:{tourismBookingId}})).status,403);assert.equal((await request(`/api/conversations/${tourismChat.body.data.id}`,{token:merchantB})).status,403);
  const liveInBookingId="66000000-0000-4000-8000-000000000001";const liveInChat=await request("/api/conversations/customer-merchant",{token:customer,method:"POST",body:{liveInBookingId,merchantUserId:"forged"}});assert.equal(liveInChat.status,201);assert.equal(liveInChat.body.data.participants.some(row=>row.userId===merchantAId),true);assert.equal((await prisma.conversationContext.findUniqueOrThrow({where:{conversationId:liveInChat.body.data.id}})).liveInBookingId,liveInBookingId);assert.equal((await request("/api/conversations/customer-merchant",{token:merchantB,method:"POST",body:{liveInBookingId}})).status,403);assert.equal((await request(`/api/conversations/${liveInChat.body.data.id}`,{token:merchantB})).status,403);
  const commerceChat=await request("/api/conversations/customer-merchant",{token:customer,method:"POST",body:{commerceOrderId:"42000000-0000-4000-8000-000000000001"}});assert.equal(commerceChat.status,201);assert.equal((await prisma.conversationContext.findUniqueOrThrow({where:{conversationId:commerceChat.body.data.id}})).commerceOrderId,"42000000-0000-4000-8000-000000000001");
  const supports=await Promise.all([request("/api/conversations/support",{token:customer,method:"POST",body:{role:"customer"}}),request("/api/conversations/support",{token:merchantA,method:"POST",body:{role:"merchant"}}),request("/api/conversations/support",{token:courier,method:"POST",body:{role:"courier"}})]);assert.ok(supports.every(row=>row.status===201));assert.equal((await request(`/api/conversations/${supports[2].body.data.id}`,{token:admin})).status,200);assert.equal((await request(`/api/conversations/${supports[2].body.data.id}`,{token:customer})).status,403);
  assert.equal((await request(`/api/conversations/${conversation.id}/close`,{token:customer,method:"PATCH"})).status,200);assert.equal((await request(`/api/conversations/${conversation.id}/messages`,{token:merchantA,method:"POST",body:{message:"Sesudah tutup"}})).status,409);const closed=await prisma.conversation.findUniqueOrThrow({where:{id:conversation.id}});assert.equal(closed.closedByUserId,customerId);assert.ok(closed.closedAt);assert.equal((await request(`/api/conversations/${supports[0].body.data.id}`,{token:customer})).body.data.status,"open");
});

test("Delivery persists daily batch, ownership, state, proof, activity and concurrency guards", async () => {
  const admin=await login("admin@kucur.test"),customer=await login("customer@kucur.test"),merchantA=await login("merchant.a@kucur.test"),merchantB=await login("merchant.b@kucur.test"),courier=await login("courier@kucur.test");
  const suffix=crypto.randomUUID(),checkoutId=crypto.randomUUID(),orderId=crypto.randomUUID(),courierId="00000000-0000-4000-8000-000000000005",customerId="00000000-0000-4000-8000-000000000002",storeId="10000000-0000-4000-8000-000000000001";let batchId;
  try {
    assert.ok(await prisma.courierProfile.findUnique({where:{userId:courierId}}));assert.ok((await prisma.courierAvailability.findMany({where:{courierUserId:courierId}})).length);
    const overlap=await request("/api/courier/availability",{token:courier,method:"POST",body:{startAt:"2026-08-01T02:00:00.000Z",endAt:"2026-08-01T03:00:00.000Z"}});assert.equal(overlap.status,409);
    await prisma.checkoutTransaction.create({data:{id:checkoutId,customerUserId:customerId,idempotencyKey:`delivery-${suffix}`}});await prisma.commerceOrder.create({data:{id:orderId,orderCode:`DEL-${suffix.slice(0,20)}`,checkoutTransactionId:checkoutId,customerUserId:customerId,storeId,fulfillmentStatus:"processing",paymentStatus:"paid",paymentMethod:"COD",productTotal:100000,deliveryFee:10000,courierTip:5000,totalAmount:115000,distanceKm:2.5,roundedDistanceKm:3,deliveryRateSnapshot:3500,recipientName:"Delivery QA",recipientPhone:"081234567890",deliveryAddress:"Desa Kucur"}});
    const eligible=await request("/api/admin/delivery/eligible-orders",{token:admin});assert.equal(eligible.status,200);assert.ok(eligible.body.data.items.some(row=>row.id===orderId));const deliveryDate=eligible.body.data.deliveryDate;
    assert.equal((await request("/api/admin/delivery/batches",{token:admin,method:"POST",body:{courierUserId:courierId,deliveryDate,commerceOrderIds:["54000000-0000-4000-8000-000000000001"]}})).status,409);
    const attempts=await Promise.all([request("/api/admin/delivery/batches",{token:admin,method:"POST",body:{courierUserId:courierId,deliveryDate,commerceOrderIds:[orderId]}}),request("/api/admin/delivery/batches",{token:admin,method:"POST",body:{courierUserId:courierId,deliveryDate,commerceOrderIds:[orderId]}})]);assert.equal(attempts.filter(row=>row.status===201).length,1);assert.equal(attempts.filter(row=>row.status===409).length,1);batchId=attempts.find(row=>row.status===201).body.data.id;assert.equal(await prisma.deliveryBatchOrder.count({where:{commerceOrderId:orderId,status:{in:["WAITING_PICKUP","PICKED_UP","OUT_FOR_DELIVERY"]}}}),1);
    assert.equal((await request(`/api/merchant/orders/${orderId}/pickup-confirmation`,{token:merchantB,method:"POST",body:{isReady:true}})).status,403);assert.equal((await request(`/api/merchant/orders/${orderId}/pickup-confirmation`,{token:merchantA,method:"POST",body:{isReady:true,note:"Siap"}})).status,201);
    assert.equal((await request(`/api/courier/batches/${batchId}`,{token:customer})).status,403);assert.equal((await request(`/api/courier/batches/${batchId}`,{token:courier})).status,200);assert.equal((await request(`/api/courier/batches/${batchId}/start`,{token:courier,method:"POST",body:{}})).status,200);
    assert.equal((await request(`/api/courier/deliveries/${orderId}/pickup`,{token:courier,method:"PATCH",body:{}})).status,200);assert.equal((await request(`/api/courier/deliveries/${orderId}/out-for-delivery`,{token:courier,method:"PATCH",body:{}})).status,200);
    const proofs=await Promise.all([request(`/api/courier/deliveries/${orderId}/proof`,{token:courier,method:"POST",body:{photoUrl:"https://example.test/proof.jpg"}}),request(`/api/courier/deliveries/${orderId}/proof`,{token:courier,method:"POST",body:{photoUrl:"https://example.test/proof.jpg"}})]);assert.ok(proofs.every(row=>row.status===201));assert.equal(await prisma.deliveryProof.count({where:{commerceOrderId:orderId}}),1);assert.equal((await prisma.commerceOrder.findUniqueOrThrow({where:{id:orderId}})).fulfillmentStatus,"completed");assert.equal(await prisma.platformTransaction.count({where:{sourceEntityId:orderId}}),1);assert.equal(await prisma.adminFeeObligation.count({where:{platformTransaction:{sourceEntityId:orderId}}}),1);assert.equal(await prisma.notification.count({where:{type:"DELIVERY_COMPLETED",entityId:orderId,userId:customerId}}),1);assert.ok(await prisma.deliveryActivity.count({where:{commerceOrderId:orderId}})>=4);assert.equal((await request(`/api/admin/delivery/batches/${batchId}/complete`,{token:admin,method:"PATCH"})).status,200);
  } finally {
    await prisma.notification.deleteMany({where:{OR:[{entityId:orderId},{entityId:batchId||""}]}});await prisma.adminFeeObligation.deleteMany({where:{platformTransaction:{sourceEntityId:orderId}}});await prisma.platformTransaction.deleteMany({where:{sourceEntityId:orderId}});await prisma.deliveryProof.deleteMany({where:{commerceOrderId:orderId}});await prisma.pickupConfirmation.deleteMany({where:{commerceOrderId:orderId}});await prisma.deliveryActivity.deleteMany({where:{commerceOrderId:orderId}});await prisma.deliveryBatchOrder.deleteMany({where:{commerceOrderId:orderId}});if(batchId)await prisma.deliveryBatch.deleteMany({where:{id:batchId}});await prisma.commerceOrder.deleteMany({where:{id:orderId}});await prisma.checkoutTransaction.deleteMany({where:{id:checkoutId}});
  }
});

test("Store Finance persists schedules, penalties, ledger, settlement, suspension, contribution, audit and concurrency guards", async () => {
  const merchant = await login("merchant.a@kucur.test"); const admin = await login("admin@kucur.test"); const suffix = crypto.randomUUID();
  const created = await request("/api/stores", { token: merchant, method: "POST", body: { name: `Finance Integration ${suffix}`, type: "product", description: "Finance integration fixture" } }); assert.equal(created.status, 201); const storeId = created.body.data.id;
  let checkoutId; let orderId;
  try {
    const setup = await request(`/api/stores/${storeId}/finance/initial-fee/setup`, { token: merchant, method: "POST", body: { planType: "THREE_MONTHS" } }); assert.equal(setup.status, 201); assert.equal(setup.body.data.installments.length, 3);
    const first = setup.body.data.installments[0]; const payment = await request(`/api/stores/${storeId}/finance/installments/${first.id}/pay`, { token: merchant, method: "POST", body: { amount: first.principalOutstanding, provider: "MANUAL" } }); assert.equal(payment.status, 201);
    assert.equal((await request(`/api/admin/finance/payments/installment/${payment.body.data.id}/confirm`, { token: admin, method: "POST", body: { approved: true } })).status, 200); assert.equal((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).status, "active");
    const second = setup.body.data.installments[1]; await prisma.storeInstallment.update({ where: { id: second.id }, data: { dueAt: new Date(Date.now() - 15 * 86400000) } });
    const reconciliations = await Promise.all([request("/api/admin/finance/reconcile-installments", { token: admin, method: "POST" }), request("/api/admin/finance/reconcile-installments", { token: admin, method: "POST" })]); assert.ok(reconciliations.every((row) => row.status === 200)); assert.equal(await prisma.storeInstallmentPenalty.count({ where: { installmentId: second.id } }), 2);
    const customerId = "00000000-0000-4000-8000-000000000002"; checkoutId = crypto.randomUUID(); orderId = crypto.randomUUID(); await prisma.checkoutTransaction.create({ data: { id: checkoutId, customerUserId: customerId, idempotencyKey: `finance-${suffix}` } });
    await prisma.commerceOrder.create({ data: { id: orderId, orderCode: `FIN-${suffix.slice(0,16)}`, checkoutTransactionId: checkoutId, customerUserId: customerId, storeId, fulfillmentStatus: "completed", paymentStatus: "paid", paymentMethod: "COD", productTotal: 200000, deliveryFee: 0, courierTip: 0, totalAmount: 200000, distanceKm: 0, roundedDistanceKm: 0, deliveryRateSnapshot: 3500, recipientName: "Finance QA", recipientPhone: "081234567890", deliveryAddress: "Kucur" } }); const order = await createPrismaRepository(prisma).commerce.findOrder(orderId);
    const generated = await Promise.allSettled([prisma.$transaction((client) => generateCommerceFinance(createPrismaRepository(client), order, new Date("2026-08-20T03:00:00Z"))), prisma.$transaction((client) => generateCommerceFinance(createPrismaRepository(client), order, new Date("2026-08-20T03:00:00Z")))]); assert.ok(generated.some((row) => row.status === "fulfilled")); assert.equal(await prisma.platformTransaction.count({ where: { sourceEntityId: orderId } }), 1); assert.equal(await prisma.adminFeeObligation.count({ where: { platformTransaction: { sourceEntityId: orderId } } }), 1);
    const obligation = await prisma.adminFeeObligation.findFirstOrThrow({ where: { platformTransaction: { sourceEntityId: orderId } } }); await prisma.adminFeeObligation.update({ where: { id: obligation.id }, data: { cutoffAt: new Date(Date.now() - 60000) } }); assert.equal((await request("/api/admin/finance/reconcile-admin-fees", { token: admin, method: "POST" })).status, 200); assert.equal((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).status, "suspended_admin_fee");
    const settlements = await Promise.all([request(`/api/stores/${storeId}/finance/admin-fees/settlements`, { token: merchant, method: "POST", body: { obligationIds: [obligation.id], amount: Number(obligation.feeAmount), provider: "MANUAL" } }), request(`/api/stores/${storeId}/finance/admin-fees/settlements`, { token: merchant, method: "POST", body: { obligationIds: [obligation.id], amount: Number(obligation.feeAmount), provider: "MANUAL" } })]); assert.equal(settlements.filter((row) => row.status === 201).length, 1); const settlement = settlements.find((row) => row.status === 201); assert.equal((await request(`/api/admin/finance/payments/settlement/${settlement.body.data.id}/confirm`, { token: admin, method: "POST", body: { approved: true } })).status, 200); assert.equal((await prisma.store.findUniqueOrThrow({ where: { id: storeId } })).status, "active");
    const contribution = await request("/api/users/me/contributions", { token: merchant, method: "POST", body: { amount: 12345, provider: "MANUAL" } }); assert.equal(contribution.status, 201); assert.equal((await request(`/api/admin/finance/payments/contribution/${contribution.body.data.id}/confirm`, { token: admin, method: "POST", body: { approved: true } })).status, 200); assert.equal((await prisma.voluntaryContribution.findUniqueOrThrow({ where: { id: contribution.body.data.id } })).paymentStatus, "PAID");
    assert.ok(await prisma.auditRecord.findFirst({ where: { activityType: "ADMIN_FEE_SETTLED", entityId: settlement.body.data.id } }));
  } finally {
    await prisma.adminFeeSettlementItem.deleteMany({ where: { settlement: { storeId } } }); await prisma.adminFeeSettlement.deleteMany({ where: { storeId } }); await prisma.adminFeeObligation.deleteMany({ where: { storeId } }); await prisma.platformTransaction.deleteMany({ where: { storeId } }); if (orderId) await prisma.commerceOrder.deleteMany({ where: { id: orderId } }); if (checkoutId) await prisma.checkoutTransaction.deleteMany({ where: { id: checkoutId } }); await prisma.storeInstallmentPayment.deleteMany({ where: { installment: { initialFee: { storeId } } } }); await prisma.storeInstallmentPenalty.deleteMany({ where: { installment: { initialFee: { storeId } } } }); await prisma.storeInstallment.deleteMany({ where: { initialFee: { storeId } } }); await prisma.storeInitialFee.deleteMany({ where: { storeId } }); await prisma.storeStatusHistory.deleteMany({ where: { storeId } }); await prisma.auditRecord.deleteMany({ where: { entityId: storeId } }); await prisma.store.deleteMany({ where: { id: storeId } });
  }
});
