const test = require("node:test");
const assert = require("node:assert/strict");
const { createStoreService } = require("./services/storeService");

const actor = { id: "merchant-1", roles: ["customer", "merchant"] };
const repositoryFor = (initialStatus) => {
  let store = { id: "store-1", merchantUserId: actor.id, name: "Lapak Kucur", status: initialStatus };
  const repository = {
    transaction: (work) => work(repository),
    stores: { update: async (_id, changes) => { store = { ...store, ...changes }; return store; } },
    audits: { append: async () => undefined },
  };
  return { repository, store: () => store };
};

test("merchant can temporarily close and reopen an active store", async () => {
  const fixture = repositoryFor("active");
  const service = createStoreService(fixture.repository);
  const closed = await service.setAvailability(fixture.store(), { acceptingOrders: false }, actor);
  assert.equal(closed.status, "inactive");
  const reopened = await service.setAvailability(fixture.store(), { acceptingOrders: true }, actor);
  assert.equal(reopened.status, "active");
});

test("merchant cannot override a finance-controlled store status", async () => {
  const fixture = repositoryFor("suspended_admin_fee");
  const service = createStoreService(fixture.repository);
  await assert.rejects(() => service.setAvailability(fixture.store(), { acceptingOrders: true }, actor), (error) => error.statusCode === 409);
});
