const test = require("node:test");
const assert = require("node:assert/strict");
const { computeDeliveryFee, DELIVERY_BASE_KM } = require("./services/deliveryFee");

const tariff = { deliveryBaseFee: 6000, deliveryRatePerKm: 1500 };

test("delivery fee: flat for the first 5 km, per km afterwards", () => {
  assert.equal(DELIVERY_BASE_KM, 5);
  assert.equal(computeDeliveryFee(0, tariff), 6000);
  assert.equal(computeDeliveryFee(1, tariff), 6000);
  assert.equal(computeDeliveryFee(5, tariff), 6000);
  assert.equal(computeDeliveryFee(6, tariff), 7500);
  assert.equal(computeDeliveryFee(9, tariff), 12000);
  assert.equal(computeDeliveryFee(25, tariff), 36000);
});

test("delivery fee rounds distance up and tolerates missing or invalid tariffs", () => {
  assert.equal(computeDeliveryFee(5.2, tariff), 7500, "5,2 km dibulatkan ke 6 km");
  assert.equal(computeDeliveryFee(8, { deliveryRatePerKm: 1500 }), 4500, "tanpa tarif dasar: hanya km sesudah 5");
  assert.equal(computeDeliveryFee(8, { deliveryBaseFee: "abc", deliveryRatePerKm: -5 }), 0);
  assert.equal(computeDeliveryFee(8, { deliveryBaseFee: "6000", deliveryRatePerKm: "1500" }), 10500);
});
