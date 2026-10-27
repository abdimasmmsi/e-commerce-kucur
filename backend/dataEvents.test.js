const test = require("node:test");
const assert = require("node:assert/strict");
const dataEvents = require("./services/dataEventBus");

test("data change signals are merged and delivered once to the right rooms", async () => {
  const received = [];
  const stop = dataEvents.subscribe((payload) => received.push(payload));
  dataEvents.publish({ roles: ["admin"], userIds: ["u1"] });
  dataEvents.publish({ roles: ["admin"], userIds: ["u2", "u1"] });
  dataEvents.publish({});
  assert.equal(received.length, 0, "ditunda sampai transaksi sempat selesai");
  await new Promise((resolve) => setTimeout(resolve, 700));
  stop();
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].roles, ["admin"]);
  assert.deepEqual(received[0].userIds.sort(), ["u1", "u2"]);
});
