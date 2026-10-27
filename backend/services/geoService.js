const { errors } = require("../errors/AppError");
const { assertInServiceArea } = require("../validation/serviceArea");

// Nama tempat dari koordinat (reverse geocoding OpenStreetMap Nominatim). Lewat backend supaya:
// satu User-Agent yang jelas sesuai kebijakan Nominatim, hasil di-cache (hemat permintaan), dan CSP browser tidak perlu dilonggarkan.
// Kalau layanan gagal atau tidak ada nama yang berarti, hasilnya null dan UI tidak menampilkan nama.
const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "KucurLocalMarket/1.0 (platform e-commerce Desa Wisata Kucur)";
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 3600 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

const tidy = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// Nama yang berguna bagi kurir: nama tempat (POI) bila ada, selain itu jalan/dusun + desa.
const placeName = (result) => {
  const address = result?.address || {};
  const first = tidy(result?.name) || tidy(address.road) || tidy(address.hamlet) || tidy(address.neighbourhood) || tidy(address.suburb);
  const area = tidy(address.village) || tidy(address.suburb) || tidy(address.city_district) || tidy(address.town) || tidy(address.city);
  const parts = [first, area].filter(Boolean).filter((part, index, list) => list.indexOf(part) === index);
  return parts.length ? parts.join(", ") : null;
};

function createGeoService({ fetchImpl = globalThis.fetch } = {}) {
  return {
    async reverse(latitude, longitude) {
      const lat = Number(latitude); const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw errors.validation({ location: "Koordinat tidak valid." });
      assertInServiceArea(lat, lng);
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const hit = cache.get(key);
      if (hit && hit.expires > Date.now()) return { placeName: hit.placeName };
      let name = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetchImpl(`${ENDPOINT}?format=jsonv2&zoom=18&addressdetails=1&accept-language=id&lat=${lat}&lon=${lng}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
          if (response.ok) name = placeName(await response.json());
        } finally { clearTimeout(timer); }
      } catch { return { placeName: null }; }
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, { placeName: name, expires: Date.now() + CACHE_TTL_MS });
      return { placeName: name };
    },
  };
}

module.exports = { createGeoService, placeName };
