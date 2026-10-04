const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./app");
const { createMemoryRepository } = require("./repositories/memoryRepository");
const { hashPassword } = require("./services/authService");

async function fixture() {
  const passwordHash = await hashPassword("password123");
  const now = new Date().toISOString();
  const repository = createMemoryRepository({ users: [
    { id: "USR-C", fullName: "Customer", email: "customer@example.test", phone: "081234567890", passwordHash, status: "active", roles: ["customer"], createdAt: now, updatedAt: now },
    { id: "USR-M1", fullName: "Merchant One", email: "merchant1@example.test", phone: "081234567891", passwordHash, status: "active", roles: ["customer", "merchant"], createdAt: now, updatedAt: now },
    { id: "USR-M2", fullName: "Merchant Two", email: "merchant2@example.test", phone: "081234567892", passwordHash, status: "active", roles: ["merchant"], createdAt: now, updatedAt: now },
    { id: "USR-A", fullName: "Admin", email: "admin@example.test", phone: "081234567893", passwordHash, status: "active", roles: ["admin"], createdAt: now, updatedAt: now },
  ], stores: [{ id: "STORE-2", merchantUserId: "USR-M2", name: "Store Two", type: "product", description: "Milik merchant kedua", status: "active", location: { label: null, address: null, latitude: null, longitude: null }, createdAt: now, updatedAt: now }] });
  const server = createApp({ repository }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { token, body, method = "GET" } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const login = async (email) => (await request("/api/auth/login", { method: "POST", body: { email, password: "password123" } })).body.data.token;
  return { repository, request, login, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("authentication rejects missing token and accepts valid login", async (t) => {
  const app = await fixture(); t.after(app.close);
  assert.equal((await app.request("/api/auth/me")).status, 401);
  const token = await app.login("customer@example.test");
  const response = await app.request("/api/auth/me", { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.id, "USR-C");
  assert.equal("passwordHash" in response.body.data, false);
});

test("registration persists a hashed Customer and logout revokes only its session", async (t) => {
  const app = await fixture(); t.after(app.close);
  const registered = await app.request("/api/auth/register", { method: "POST", body: { fullName: "New Customer", email: "new@example.test", phone: "081299999999", password: "password123" } });
  assert.equal(registered.status, 201);
  assert.deepEqual(registered.body.data.roles, ["customer"]);
  const stored = app.repository.users.findByEmail("new@example.test");
  assert.match(stored.passwordHash, /^scrypt:/);
  assert.notEqual(stored.passwordHash, "password123");
  const token = await app.login("new@example.test");
  assert.equal((await app.request("/api/auth/me", { token })).status, 200);
  assert.equal((await app.request("/api/auth/logout", { token, method: "POST" })).status, 204);
  assert.equal((await app.request("/api/auth/me", { token })).status, 401);
  assert.ok(app.repository.users.findByEmail("new@example.test"));
});

test("persistent session resolves all database roles", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("merchant1@example.test");
  const response = await app.request("/api/auth/me", { token });
  assert.deepEqual(response.body.data.roles, ["customer", "merchant"]);
});

test("account profile, preferences, and password updates remain authenticated", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("customer@example.test");
  const profile = await app.request("/api/users/me", { token, method: "PATCH", body: { fullName: "Customer Updated", email: "customer.updated@example.test", phone: "081234567899" } });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.fullName, "Customer Updated");
  assert.equal("passwordHash" in profile.body.data, false);
  assert.equal((await app.request("/api/users/me", { token, method: "PATCH", body: { fullName: "Unsafe", email: "safe@example.test", phone: "081234567899", roles: ["admin"] } })).status, 400);
  const preferences = await app.request("/api/users/me/preferences", { token, method: "PATCH", body: { language: "en", theme: "dark" } });
  assert.deepEqual(preferences.body.data.preferences, { language: "en", theme: "dark" });
  assert.equal((await app.request("/api/users/me/password/verify", { token, method: "POST", body: { currentPassword: "wrong-password" } })).status, 400);
  assert.equal((await app.request("/api/users/me/password/verify", { token, method: "POST", body: { currentPassword: "password123" } })).status, 200);
  assert.equal((await app.request("/api/users/me/password", { token, method: "PATCH", body: { currentPassword: "wrong-password", newPassword: "new-password-123" } })).status, 400);
  assert.equal((await app.request("/api/users/me/password", { token, method: "PATCH", body: { currentPassword: "password123", newPassword: "new-password-123" } })).status, 200);
  assert.equal((await app.request("/api/auth/me", { token })).status, 200);
  assert.equal((await app.request("/api/auth/login", { method: "POST", body: { email: "customer.updated@example.test", password: "new-password-123" } })).status, 200);
});

test("login creates a twelve-hour session and reports password age", async (t) => {
  const app = await fixture(); t.after(app.close);
  const oldPasswordDate = new Date(); oldPasswordDate.setUTCMonth(oldPasswordDate.getUTCMonth() - 4);
  await app.repository.users.update("USR-C", { passwordChangedAt: oldPasswordDate.toISOString() });
  const response = await app.request("/api/auth/login", { method: "POST", body: { email: "customer@example.test", password: "password123" } });
  assert.equal(response.status, 200);
  const lifetime = new Date(response.body.data.expiresAt).getTime() - Date.now();
  assert.ok(lifetime <= 12 * 60 * 60 * 1000 && lifetime > 11.9 * 60 * 60 * 1000);
  assert.equal(response.body.data.user.passwordSecurity.rotationRecommended, true);
  assert.equal("passwordHash" in response.body.data.user, false);
});

test("Admin reset requires re-authentication, revokes sessions, and forces a password change", async (t) => {
  const app = await fixture(); t.after(app.close);
  const admin = await app.login("admin@example.test");
  const customer = await app.login("customer@example.test");
  const list = await app.request("/api/users", { token: admin });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.some((user) => "passwordHash" in user), false);
  assert.equal((await app.request("/api/users/USR-C/password-reset", { token: admin, method: "POST", body: { adminPassword: "wrong-password", temporaryPassword: "temporary-123" } })).status, 400);
  const reset = await app.request("/api/users/USR-C/password-reset", { token: admin, method: "POST", body: { adminPassword: "password123", temporaryPassword: "temporary-123" } });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.user.passwordSecurity.resetRequired, true);
  assert.equal((await app.request("/api/auth/me", { token: customer })).status, 401);
  assert.equal((await app.request("/api/auth/login", { method: "POST", body: { email: "customer@example.test", password: "password123" } })).status, 401);
  const temporaryLogin = await app.request("/api/auth/login", { method: "POST", body: { email: "customer@example.test", password: "temporary-123" } });
  assert.equal(temporaryLogin.status, 200);
  assert.equal(temporaryLogin.body.data.user.passwordSecurity.resetRequired, true);
  assert.equal(app.repository.audits.list().at(-1).activityType, "ADMIN_USER_PASSWORD_RESET");
});

test("invalid role cannot create Store", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("admin@example.test");
  const response = await app.request("/api/stores", { token, method: "POST", body: { name: "No", type: "product", description: "Forbidden" } });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
});

test("Merchant cannot update another Merchant Store", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("merchant1@example.test");
  const response = await app.request("/api/stores/STORE-2", { token, method: "PATCH", body: { name: "Taken" } });
  assert.equal(response.status, 403);
  assert.equal(app.repository.stores.findById("STORE-2").name, "Store Two");
});

test("Store create persists product scope, owner, location, and append-only audit", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("merchant1@example.test");
  const response = await app.request("/api/stores", { token, method: "POST", body: { name: "Persistent Store", type: "product", description: "Normalized Store", merchantUserId: "USR-M2", location: { label: "Kucur", address: "Malang", latitude: -7.957, longitude: 112.553 } } });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.merchantUserId, "USR-M1");
  assert.equal(response.body.data.type, "product");
  assert.equal(app.repository.stores.findById(response.body.data.id).location.latitude, -7.957);
  assert.equal(app.repository.audits.list().at(-1).activityType, "STORE_CREATED");
});

test("Store create and update reject types outside product scope", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("merchant1@example.test");
  for (const type of ["tourism", "live-in", "educational-tourism"]) {
    const response = await app.request("/api/stores", { token, method: "POST", body: { name: "Legacy Store", type, description: "Out of scope" } });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  }
  const created = await app.request("/api/stores", { token, method: "POST", body: { name: "Product Store", type: "product", description: "Final scope" } });
  assert.equal(created.status, 201);
  const updated = await app.request(`/api/stores/${created.body.data.id}`, { token, method: "PATCH", body: { type: "tourism" } });
  assert.equal(updated.status, 400);
  assert.equal(updated.body.code, "VALIDATION_ERROR");
});

test("Customer merchant application uses Store persistence and approval grants Merchant role", async (t) => {
  const app = await fixture(); t.after(app.close);
  const customer = await app.login("customer@example.test");
  const submitted = await app.request("/api/stores", { token: customer, method: "POST", body: { name: "Customer Product Store", type: "product", description: "Canonical merchant application", phone: "081234567890", location: { address: "Kucur, Malang" } } });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.merchantUserId, "USR-C");
  assert.equal(submitted.body.data.approvalStatus, "PENDING");
  assert.deepEqual((await app.request("/api/stores", { token: customer })).body.data.map((store) => store.id), [submitted.body.data.id]);
  assert.equal(app.repository.audits.list().at(-1).actorRole, "customer");

  const admin = await app.login("admin@example.test");
  const reviewed = await app.request(`/api/stores/applications/${submitted.body.data.id}/review`, { token: admin, method: "PATCH", body: { status: "APPROVED" } });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.approvalStatus, "APPROVED");
  assert.equal((await app.request("/api/auth/me", { token: customer })).body.data.roles.includes("merchant"), true);
});

test("Tourism and Live In APIs are not mounted in the final runtime", async (t) => {
  const app = await fixture(); t.after(app.close);
  assert.equal((await app.request("/api/tourism")).status, 404);
  assert.equal((await app.request("/api/live-in")).status, 404);
});

test("Store rejects incomplete and out-of-range coordinates", async (t) => {
  const app = await fixture(); t.after(app.close);
  const token = await app.login("merchant1@example.test");
  const base = { name: "Location Store", type: "product", description: "Location validation" };
  assert.equal((await app.request("/api/stores", { token, method: "POST", body: { ...base, location: { latitude: -7.9 } } })).status, 400);
  assert.equal((await app.request("/api/stores", { token, method: "POST", body: { ...base, location: { latitude: -91, longitude: 112 } } })).status, 400);
});

test("settings are readable when authenticated and writable only by Admin", async (t) => {
  const app = await fixture(); t.after(app.close);
  const customer = await app.login("customer@example.test");
  const admin = await app.login("admin@example.test");
  assert.equal((await app.request("/api/settings", { token: customer })).status, 200);
  assert.equal((await app.request("/api/settings", { token: customer, method: "PATCH", body: { maxDailyDeliveries: 40 } })).status, 403);
  const updated = await app.request("/api/settings", { token: admin, method: "PATCH", body: { maxDailyDeliveries: 40 } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.maxDailyDeliveries, 40);
  assert.equal(app.repository.audits.list().at(-1).activityType, "SETTINGS_UPDATED");
});

test("financial settings validate modes, ranges, Pride total, and rollback atomically", async (t) => {
  const app = await fixture(); t.after(app.close);
  const admin = await app.login("admin@example.test");
  const valid = await app.request("/api/settings", { token: admin, method: "PATCH", body: { adminFeeType: "fixed", adminFeeValue: 5000, taxPercent: 11, installmentLateInterestPercent: 2 } });
  assert.equal(valid.status, 200); assert.equal(valid.body.data.adminFeeValue, 5000);
  for (const body of [{ adminFeeType: "other" }, { adminFeeValue: -1 }, { adminFeeCutoffDay: 29 }, { adminFeeGraceTime: "25:00" }, { taxPercent: 101 }, { installmentLateInterestPercent: -1 }, { prideLeaderboardSize: 21 }]) {
    assert.equal((await app.request("/api/settings", { token: admin, method: "PATCH", body })).status, 400);
  }
  const before = app.repository.settings.get();
  const rejected = await app.request("/api/settings", { token: admin, method: "PATCH", body: { prideTransactionValueWeight: 50, prideTransactionCountWeight: 30 } });
  assert.equal(rejected.status, 400); assert.deepEqual(app.repository.settings.get(), before);
  const accepted = await app.request("/api/settings", { token: admin, method: "PATCH", body: { prideTransactionValueWeight: 40, prideTransactionCountWeight: 20, prideRatingWeight: 20, prideCompletionRateWeight: 20 } });
  assert.equal(accepted.status, 200); assert.equal(app.repository.audits.list().at(-1).activityType, "SETTINGS_UPDATED");
});
