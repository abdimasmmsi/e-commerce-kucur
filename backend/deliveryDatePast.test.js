const test = require("node:test");
const assert = require("node:assert/strict");
const { createDeliveryService } = require("./services/deliveryService");

// Jadwal pengiriman tidak boleh dibuat atau dipindah ke tanggal yang sudah lewat.
const service = createDeliveryService({
  settings: { get: async () => ({ deliveryDispatchTime: "17:00", deliveryOrderCutoffTime: "15:00" }) },
  delivery: { listCouriers: async () => [] },
  commerce: {},
  transaction: async (work) => work({}),
});

test("drafts, approval, create and rebatch reject delivery dates before today", async () => {
  const actor = { id: "admin", roles: ["admin"] };
  await assert.rejects(() => service.drafts({ deliveryDate: "2020-01-01" }), (error) => error.status === 400 || error.code === "VALIDATION_ERROR");
  await assert.rejects(() => service.approveDrafts({ deliveryDate: "2020-01-01", assignments: [{ courierUserId: "c1", commerceOrderIds: ["o1"] }] }, actor), (error) => error.status === 400 || error.code === "VALIDATION_ERROR");
  await assert.rejects(() => service.createBatch({ deliveryDate: "2020-01-01", courierUserId: "c1", commerceOrderIds: ["o1"] }, actor), (error) => error.status === 400 || error.code === "VALIDATION_ERROR");
  await assert.rejects(() => service.rebatch("o1", { deliveryDate: "2020-01-01", courierUserId: "c1" }, actor), (error) => error.status === 400 || error.code === "VALIDATION_ERROR");
});
