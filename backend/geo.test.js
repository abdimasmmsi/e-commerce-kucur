const test = require("node:test");
const assert = require("node:assert/strict");
const { createGeoService, placeName } = require("./services/geoService");

const respond = (body, ok = true) => async () => ({ ok, json: async () => body });

test("place name prefers the named place, then street, with the village", () => {
  assert.equal(placeName({ name: "Warung Bu Tinah", address: { road: "Jl. Raya", village: "Kucur" } }), "Warung Bu Tinah, Kucur");
  assert.equal(placeName({ name: "", address: { road: "Jl. Raya Kucur", village: "Kucur" } }), "Jl. Raya Kucur, Kucur");
  assert.equal(placeName({ address: { village: "Kucur" } }), "Kucur");
  assert.equal(placeName({}), null);
});

test("reverse geocoding returns null on failure and rejects points outside the service area", async () => {
  const failing = createGeoService({ fetchImpl: async () => { throw new Error("network"); } });
  assert.deepEqual(await failing.reverse(-7.9625, 112.5519), { placeName: null });
  const bad = createGeoService({ fetchImpl: respond({}, false) });
  assert.deepEqual(await bad.reverse(-7.9001, 112.5001), { placeName: null });
  const service = createGeoService({ fetchImpl: respond({ name: "", address: { road: "Jl. Uji", village: "Kucur" } }) });
  await assert.rejects(() => service.reverse(21.42, 39.82), (error) => error.code === "VALIDATION_ERROR");
  await assert.rejects(() => service.reverse("abc", 112.5), (error) => error.code === "VALIDATION_ERROR");
});

test("reverse geocoding caches by rounded coordinates", async () => {
  let calls = 0;
  const service = createGeoService({ fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({ address: { road: "Jl. Cache", village: "Kucur" } }) }; } });
  assert.deepEqual(await service.reverse(-7.95001, 112.60001), { placeName: "Jl. Cache, Kucur" });
  assert.deepEqual(await service.reverse(-7.95002, 112.60002), { placeName: "Jl. Cache, Kucur" });
  assert.equal(calls, 1);
});
