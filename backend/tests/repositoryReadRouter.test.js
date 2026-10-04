const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositoryReadRouter, stableBucket } = require("../repositories/repositoryReadRouter");
const { createShadowWriteSynchronizer } = require("../repositories/shadowWriteSynchronizer");
const { readContextMiddleware } = require("../repositories/repositoryReadContext");

const repository = (label, overrides = {}) => ({
  users: { findById: async (id) => ({ id, label }), update: async (id, data) => ({ id, ...data, label }) },
  products: { list: async () => [{ id: "p1", label }], create: async (data) => ({ id: "p2", ...data, label }) },
  tourism: { findBooking: async () => ({ id: "tourism", label }) },
  transaction: async (work) => work(repository(label, overrides)), health: async () => true,
  ...overrides,
});

test("stable canary selection is deterministic", () => {
  assert.equal(stableBucket("same-user"), stableBucket("same-user"));
  assert.ok(stableBucket("same-user") >= 0 && stableBucket("same-user") < 100);
});

test("legacy and shadow modes remain legacy canonical", async () => {
  for (const mode of ["legacy", "shadow"]) {
    const router = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode, percent: 100, domains: new Set(["AUTH"]) });
    assert.equal((await router.users.findById("u1")).label, "legacy");
  }
});

test("approved final mode reads final directly without legacy comparison", async () => {
  const calls = [];
  const legacy = repository("legacy"); const final = repository("final");
  legacy.users.findById = async () => { calls.push("legacy:users.findById"); return { source: "legacy" }; };
  final.users.findById = async () => { calls.push("final:users.findById"); return { source: "final" }; };
  const router = createRepositoryReadRouter(legacy, final, { mode: "final", allowFinal: true });
  const value = await router.users.findById("u1");
  assert.equal(value.source, "final");
  assert.deepEqual(calls, ["final:users.findById"]);
  assert.equal(router.metrics.summary().legacyReads, 0);
});

test("canary returns final only on match and records actual final read", async () => {
  const legacy = repository("same"); const final = repository("same");
  const router = createRepositoryReadRouter(legacy, final, { mode: "canary", percent: 100, domains: new Set(["AUTH"]) });
  assert.equal((await router.users.findById("u1")).label, "same");
  assert.equal(router.metrics.summary().finalCanaryReads, 1);
  assert.equal(router.metrics.summary().unexpectedMismatches, 0);
});

test("canary mismatch and final error automatically fall back to legacy", async () => {
  const mismatch = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "canary", percent: 100, domains: new Set(["AUTH"]) });
  assert.equal((await mismatch.users.findById("u1")).label, "legacy");
  assert.equal(mismatch.metrics.summary().fallbackCount, 1);
  const failedFinal = repository("final"); failedFinal.users.findById = async () => { throw new Error("injected final failure"); };
  const failure = createRepositoryReadRouter(repository("legacy"), failedFinal, { mode: "canary", percent: 100, domains: new Set(["AUTH"]) });
  assert.equal((await failure.users.findById("u1")).label, "legacy");
  assert.equal(failure.metrics.summary().finalReadErrors, 1);
});

test("domain policy and rollback mode keep Tourism and all rollback reads legacy", async () => {
  const canary = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "canary", percent: 100, domains: new Set(["PRODUCT"]) });
  assert.equal((await canary.users.findById("u1")).label, "legacy");
  assert.equal((await canary.tourism.findBooking()).label, "legacy");
  const rollback = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "legacy", percent: 100, domains: new Set(["AUTH"]) });
  assert.equal((await rollback.users.findById("u1")).label, "legacy");
  assert.throws(() => createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "final" }), /reserved/i);
});

test("Tourism and Live In paths keep final AUTH while their own repositories remain legacy", async () => {
  for (const path of ["/api/tourism/packages", "/api/live-in/bookings"]) {
    await new Promise((resolve, reject) => readContextMiddleware({ headers: {}, originalUrl: path }, { setHeader() {} }, async () => {
      try {
        const router = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "final", allowFinal: true });
        assert.equal((await router.users.findById("u1")).label, "final");
        assert.equal((await router.tourism.findBooking()).label, "legacy");
        assert.equal(router.metrics.summary().finalCanaryReads, 1);
        resolve();
      } catch (error) { reject(error); }
    }));
  }
});

test("post-commit shadow synchronization is invoked once and legacy result stays authoritative", async () => {
  const calls = []; const sync = createShadowWriteSynchronizer({ enabled: true, nodeEnv: "test", handler: async (mutations) => { calls.push(mutations); return { inserted: { targetProduct: 1 }, updated: {} }; } });
  const router = createRepositoryReadRouter(repository("legacy"), repository("final"), { mode: "canary", percent: 100, domains: new Set(["PRODUCT"]), shadowSynchronizer: sync });
  const value = await router.transaction((tx) => tx.products.create({ name: "QA" }));
  assert.equal(value.label, "legacy"); assert.equal(calls.length, 1); assert.equal(calls[0][0].operation, "products.create");
  assert.equal(router.metrics.summary().shadowSyncSuccess, 1);
});

test("shadow sync failure preserves committed legacy result and disables affected canary domain", async () => {
  const sync = createShadowWriteSynchronizer({ enabled: true, nodeEnv: "test", handler: async () => { throw new Error("injected sync failure"); } });
  const router = createRepositoryReadRouter(repository("same"), repository("same"), { mode: "canary", percent: 100, domains: new Set(["PRODUCT"]), shadowSynchronizer: sync });
  const value = await router.products.create({ name: "QA" }); assert.equal(value.label, "same");
  assert.equal(router.unsafe.has("PRODUCT"), true); assert.equal(router.metrics.summary().shadowSyncErrors, 1);
  assert.throws(() => createShadowWriteSynchronizer({ enabled: true, nodeEnv: "production" }), /forbidden/i);
});
