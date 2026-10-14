const test = require("node:test");
const assert = require("node:assert/strict");
const { purgeExpiredSessions, remindWaitingOrders } = require("./services/maintenanceJob");

test("purgeExpiredSessions hanya menghapus sesi kedaluwarsa atau dicabut lebih dari 7 hari", async () => {
  const calls = []; const prisma = { targetSession: { deleteMany: async (args) => { calls.push(args); return { count: 3 }; } } };
  assert.equal(await purgeExpiredSessions(prisma, new Date("2026-10-14T00:00:00Z")), 3);
  const [byExpiry, byRevoke] = calls[0].where.OR;
  assert.equal(byExpiry.expiresAt.lt.toISOString(), "2026-10-07T00:00:00.000Z"); assert.equal(byRevoke.revokedAt.lt.toISOString(), "2026-10-07T00:00:00.000Z");
});

test("remindWaitingOrders mengingatkan penjual sekali per pesanan Menunggu yang lewat 6 jam, melewati lapak ditangguhkan", async () => {
  const now = new Date("2026-10-14T12:00:00Z"); const hoursAgo = (hours) => new Date(now.getTime() - hours * 3600000).toISOString();
  const orders = [
    { id: "O-OLD", orderCode: "KCR-1", storeId: "S1", fulfillmentStatus: "pending", createdAt: hoursAgo(7) },
    { id: "O-NEW", orderCode: "KCR-2", storeId: "S1", fulfillmentStatus: "pending", createdAt: hoursAgo(2) },
    { id: "O-DONE", orderCode: "KCR-3", storeId: "S1", fulfillmentStatus: "confirmed", createdAt: hoursAgo(30) },
    { id: "O-SUSP", orderCode: "KCR-4", storeId: "S2", fulfillmentStatus: "pending", createdAt: hoursAgo(9) },
  ];
  const sent = []; const keys = new Set();
  const repository = {
    commerce: { listOrders: async () => orders },
    stores: { list: async () => [{ id: "S1", merchantUserId: "M1", status: "active" }, { id: "S2", merchantUserId: "M2", status: "suspended_admin_fee" }] },
    notifications: { create: async (data) => { if (keys.has(data.dedupeKey)) { const error = new Error("duplicate"); error.code = "P2002"; throw error; } keys.add(data.dedupeKey); sent.push(data); return data; }, findByDedupeKey: async (key) => (keys.has(key) ? { dedupeKey: key } : null) },
  };
  assert.equal(await remindWaitingOrders(repository, now), 1);
  assert.equal(sent.length, 1); assert.equal(sent[0].userId, "M1"); assert.equal(sent[0].type, "ORDER_WAITING_REMINDER"); assert.equal(sent[0].dedupeKey, "order-waiting:O-OLD"); assert.match(sent[0].body, /KCR-1/);
  await remindWaitingOrders(repository, now); assert.equal(sent.length, 1);
});
