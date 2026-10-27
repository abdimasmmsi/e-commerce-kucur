const test = require("node:test");
const assert = require("node:assert/strict");
const { inServiceArea, assertInServiceArea } = require("./validation/serviceArea");
const { normalizeAddresses } = require("./validation/addressValidation");
const { validateLocation } = require("./validation/sharedValidation");

const outOfArea = (error) => error.code === "VALIDATION_ERROR" && JSON.stringify(error.details).includes("area layanan");

test("only East Java coordinates are inside the service area", () => {
  assert.equal(inServiceArea(-7.9625, 112.5519), true, "Desa Kucur");
  assert.equal(inServiceArea(-7.2575, 112.7521), true, "Surabaya");
  assert.equal(inServiceArea(-7.0, 113.9), true, "Madura");
  assert.equal(inServiceArea(24.7136, 46.6753), false, "Riyadh");
  assert.equal(inServiceArea(-6.2, 106.8), false, "Jakarta");
  assert.equal(inServiceArea(NaN, 112.5), false);
  assert.throws(() => assertInServiceArea(21.4225, 39.8262), outOfArea);
});

test("addresses and store locations outside East Java are rejected", () => {
  const base = { label: "Rumah", recipientName: "Budi", phone: "081234567890", address: "Jl. Contoh 1" };
  assert.equal(normalizeAddresses([{ ...base, latitude: -7.96, longitude: 112.55, isPrimary: true }]).length, 1);
  assert.throws(() => normalizeAddresses([{ ...base, latitude: 21.42, longitude: 39.82, isPrimary: true }]), outOfArea);
  assert.equal(validateLocation({ latitude: -7.96, longitude: 112.55 }).latitude, -7.96);
  assert.throws(() => validateLocation({ latitude: 21.42, longitude: 39.82 }), outOfArea);
  assert.equal(validateLocation(null).latitude, null);
});
