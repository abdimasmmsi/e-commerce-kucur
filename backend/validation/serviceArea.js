const { errors } = require("../errors/AppError");

// Area layanan: Jawa Timur dulu (Steven 2026-10-27). Kotak kasar yang mencakup Jatim termasuk Madura; titik di luar ini
// (mis. luar negeri atau pulau lain) ditolak untuk alamat pembeli, lokasi lapak, dan checkout.
const SERVICE_AREA = Object.freeze({ name: "Jawa Timur", south: -8.85, north: -6.7, west: 110.85, east: 114.7 });

const inServiceArea = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= SERVICE_AREA.south && latitude <= SERVICE_AREA.north && longitude >= SERVICE_AREA.west && longitude <= SERVICE_AREA.east;

const assertInServiceArea = (latitude, longitude, field = "location") => {
  if (!inServiceArea(Number(latitude), Number(longitude))) throw errors.validation({ [field]: `Lokasi di luar area layanan (${SERVICE_AREA.name}). Pilih titik di Jawa Timur.` });
};

// Batas jarak antar-jemput bila Admin belum mengisi `maxDeliveryDistanceKm`: ongkir tidak boleh jadi tak masuk akal.
const DEFAULT_MAX_DELIVERY_KM = 50;

module.exports = { SERVICE_AREA, DEFAULT_MAX_DELIVERY_KM, inServiceArea, assertInServiceArea };
