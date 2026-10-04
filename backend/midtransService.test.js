const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMidtransStatus } = require("./midtransService");

test("normalizes Midtrans transaction statuses", () => {
  assert.equal(normalizeMidtransStatus({ transaction_status: "pending" }), "pending");
  assert.equal(normalizeMidtransStatus({ transaction_status: "settlement" }), "paid");
  assert.equal(normalizeMidtransStatus({ transaction_status: "capture", fraud_status: "accept" }), "paid");
  assert.equal(normalizeMidtransStatus({ transaction_status: "capture", fraud_status: "challenge" }), "failed");
  assert.equal(normalizeMidtransStatus({ transaction_status: "deny" }), "failed");
  assert.equal(normalizeMidtransStatus({ transaction_status: "expire" }), "expired");
  assert.equal(normalizeMidtransStatus({ transaction_status: "cancel" }), "cancelled");
  assert.equal(normalizeMidtransStatus({ transaction_status: "refund" }), "refunded");
});
