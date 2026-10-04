const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositoryWriteRouter, createWriteMetrics, routeDomain, writeRouterConfig } = require("../repositories/repositoryWriteRouter");
const { createFinalLegacyMirrorSynchronizer, withResultIdentity } = require("../repositories/finalLegacyMirrorSynchronizer");

const repository = (label, calls, behavior = {}) => ({
  sessions: {
    findActiveByTokenHash: async (value) => ({ label, value }),
    create: async (input) => { calls.push(`${label}:sessions.create`); if (behavior.createError) throw behavior.createError; return { ...input, id: input.id || `${label}-session` }; },
    revokeByTokenHash: async () => { calls.push(`${label}:sessions.revoke`); return { count: 1 }; },
  },
  commerce: {
    updateCartItem: async (id, quantity) => { calls.push(`${label}:commerce.updateCartItem`); return { id, quantity }; },
    updateOrder: async (id, data) => { calls.push(`${label}:commerce.updateOrder`); return { id, ...data }; },
  },
  transaction: async (work) => { calls.push(`${label}:transaction.begin`); const value = await work(repository(`${label}-tx`, calls, behavior)); calls.push(`${label}:transaction.commit`); return value; },
  health: async () => true,
});

test("write configuration defaults to legacy and final remains reserved", () => {
  assert.equal(writeRouterConfig({}).mode, "legacy");
  assert.throws(() => writeRouterConfig({ mode: "final" }), /reserved/);
});

test("approved final mode sends eligible writes directly to final without mirror", async () => {
  const calls = []; const metrics = createWriteMetrics();
  const router = createRepositoryWriteRouter(repository("legacy", calls), repository("final", calls), { mode: "final", allowFinal: true, domains: new Set(), metrics, mirrorSynchronizer: { enabled: false } });
  await router.sessions.create({ tokenHash: "x" });
  assert.deepEqual(calls, ["final:sessions.create"]);
  assert.equal(metrics.summary().legacyCanonicalWrites, 0);
});

test("route domain excludes Tourism and Live In", () => {
  assert.equal(routeDomain("/api/tourism/bookings"), null);
  assert.equal(routeDomain("/api/live-in/bookings"), null);
  assert.equal(routeDomain("/api/cart/items"), "CART");
});

test("stage 0 keeps eligible writes canonical on legacy", async () => {
  const calls = []; const metrics = createWriteMetrics();
  const router = createRepositoryWriteRouter(repository("legacy", calls), repository("final", calls), { mode: "canary", percent: 0, domains: new Set(["AUTH"]), metrics });
  await router.sessions.create({ tokenHash: "x" });
  assert.deepEqual(calls, ["legacy:sessions.create"]);
  assert.equal(metrics.summary().legacyCanonicalWrites, 1);
});

test("100 percent canary writes final once then mirrors persistence", async () => {
  const calls = []; const metrics = createWriteMetrics();
  const mirror = createFinalLegacyMirrorSynchronizer(repository("legacy", calls), { enabled: true, nodeEnv: "test", validator: async () => "MATCH" });
  const router = createRepositoryWriteRouter(repository("legacy", calls), repository("final", calls), { mode: "canary", percent: 100, domains: new Set(["AUTH"]), metrics, mirrorSynchronizer: mirror });
  const result = await router.sessions.create({ tokenHash: "x" });
  assert.equal(result.id, "final-session");
  assert.equal(calls.filter((item) => item === "final:sessions.create").length, 1);
  assert.equal(calls.filter((item) => item === "legacy-tx:sessions.create").length, 1);
  assert.equal(metrics.summary().legacyMirrorSuccess, 1);
  assert.equal(metrics.summary().postWriteComparisonMatches, 1);
});

test("final failure has no legacy write fallback or mirror", async () => {
  const calls = []; const metrics = createWriteMetrics();
  const mirrorCalls = [];
  const mirror = { enabled: true, afterCommit: async (value) => mirrorCalls.push(value) };
  const final = repository("final", calls, { createError: new Error("before commit") });
  const router = createRepositoryWriteRouter(repository("legacy", calls), final, { mode: "canary", percent: 100, domains: new Set(["AUTH"]), metrics, mirrorSynchronizer: mirror });
  await assert.rejects(router.sessions.create({ tokenHash: "x" }), /before commit/);
  assert.deepEqual(calls, ["final:sessions.create"]);
  assert.equal(mirrorCalls.length, 0);
  assert.equal(metrics.summary().finalWriteFailure, 1);
});

test("mirror failure after final commit marks domain unsafe without failing result", async () => {
  const calls = []; const metrics = createWriteMetrics();
  const mirror = createFinalLegacyMirrorSynchronizer(repository("legacy", calls), { enabled: true, nodeEnv: "test", handler: async () => { throw new Error("mirror offline"); } });
  const router = createRepositoryWriteRouter(repository("legacy", calls), repository("final", calls), { mode: "canary", percent: 100, domains: new Set(["AUTH"]), metrics, mirrorSynchronizer: mirror });
  const result = await router.sessions.create({ tokenHash: "x" });
  assert.equal(result.id, "final-session");
  assert.equal(router.unsafeDomains.has("AUTH"), true);
  await router.sessions.create({ tokenHash: "y" });
  assert.equal(calls.includes("legacy:sessions.create"), true);
});

test("mirror divergence is explicit and repair is deterministic", async () => {
  let attempts = 0; const metrics = createWriteMetrics(); const unsafeDomains = new Set(); const unsafeEntities = new Set();
  const mirror = createFinalLegacyMirrorSynchronizer({}, { enabled: true, nodeEnv: "test", handler: async () => { attempts += 1; if (attempts === 1) throw new Error("LEGACY_MIRROR_DIVERGENCE"); }, validator: async () => "MATCH" });
  const payload = { mutations: [{ domain: "CART", operation: "commerce.updateCartItem", args: ["i", 2], result: { id: "i" }, entityId: "i" }], metrics, unsafeDomains, unsafeEntities };
  assert.equal((await mirror.afterCommit(payload)).result, "DIVERGENCE");
  assert.equal((await mirror.repair(payload)).comparisonResult, "MATCH");
  assert.equal(mirror.deterministicCompatibilityId("i", "reservation"), mirror.deterministicCompatibilityId("i", "reservation"));
});

test("repeated mirror reports NO_CHANGE when duplicate state already matches", async () => {
  const metrics = createWriteMetrics();
  const mirror = createFinalLegacyMirrorSynchronizer({}, { enabled: true, nodeEnv: "test", handler: async () => { throw new Error("P2002 duplicate"); }, validator: async () => "MATCH" });
  const result = await mirror.afterCommit({ mutations: [{ domain: "AUTH", operation: "sessions.create", args: [{}], result: { id: "s" } }], metrics, unsafeDomains: new Set(), unsafeEntities: new Set() });
  assert.equal(result.result, "NO_CHANGE");
});

test("transaction commits final once before mirror and never invokes legacy service", async () => {
  const calls = []; const metrics = createWriteMetrics(); const mirrored = [];
  const mirror = { enabled: true, afterCommit: async ({ mutations }) => { calls.push("mirror"); mirrored.push(...mutations); } };
  const router = createRepositoryWriteRouter(repository("legacy", calls), repository("final", calls), { mode: "canary", percent: 100, domains: new Set(["COMMERCE"]), transactionDomain: "COMMERCE", metrics, mirrorSynchronizer: mirror });
  await router.transaction((tx) => tx.commerce.updateOrder("o1", { paymentStatus: "paid" }));
  assert.deepEqual(calls, ["final:transaction.begin", "final-tx:commerce.updateOrder", "final:transaction.commit", "mirror"]);
  assert.equal(mirrored[0].operation, "commerce.updateOrder");
});

test("identity injection preserves shared IDs", () => {
  assert.equal(withResultIdentity({ operation: "sessions.create", args: [{ tokenHash: "x" }], result: { id: "s1" } })[0].id, "s1");
  assert.equal(withResultIdentity({ operation: "chats.createMessage", args: ["c", "u", "hi", null], result: { id: "m1" } })[4], "m1");
});

test("ambiguous commit lookup returns committed result without blind legacy retry", async () => {
  const calls = []; const metrics = createWriteMetrics(); const error = new Error("connection lost after commit"); error.ambiguousCommit = true;
  const final = repository("final", calls, { createError: error });
  const mirrored = [];
  const router = createRepositoryWriteRouter(repository("legacy", calls), final, {
    mode: "canary", percent: 100, domains: new Set(["AUTH"]), metrics,
    resolveAmbiguousCommit: async () => ({ committed: true, result: { id: "committed-session", tokenHash: "x" } }),
    mirrorSynchronizer: { enabled: true, afterCommit: async ({ mutations }) => mirrored.push(...mutations) },
  });
  const result = await router.sessions.create({ tokenHash: "x" });
  assert.equal(result.id, "committed-session");
  assert.equal(calls.some((item) => item.startsWith("legacy:")), false);
  assert.equal(mirrored.length, 1);
  assert.equal(metrics.events.some((item) => item.finalTransactionResult === "RESOLVED_COMMITTED"), true);
});
