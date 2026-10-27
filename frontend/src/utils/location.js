import { inServiceArea } from "./serviceArea";
export const EMPTY_LOCATION = { locationId: null, label: "", address: "", latitude: null, longitude: null };

const finiteCoordinate = (value, min, max) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

export function normalizeLocation(value, fallback = {}) {
  const legacyText = typeof value === "string" ? value : "";
  const source = value && typeof value === "object" ? value : {};
  const coordinates = source.coordinates && typeof source.coordinates === "object" ? source.coordinates : {};
  return {
    locationId: source.locationId ?? fallback.locationId ?? null,
    label: source.label ?? legacyText ?? fallback.label ?? "",
    address: source.address ?? fallback.address ?? "",
    latitude: finiteCoordinate(source.latitude ?? source.lat ?? coordinates.lat ?? fallback.latitude ?? fallback.lat, -90, 90),
    longitude: finiteCoordinate(source.longitude ?? source.lng ?? coordinates.lng ?? fallback.longitude ?? fallback.lng, -180, 180),
  };
}

export const hasCoordinates = (location) => Number.isFinite(normalizeLocation(location).latitude) && Number.isFinite(normalizeLocation(location).longitude);

export function validateLocationCoordinates(location) {
  const latitudeEmpty = location?.latitude === "" || location?.latitude === null || location?.latitude === undefined;
  const longitudeEmpty = location?.longitude === "" || location?.longitude === null || location?.longitude === undefined;
  if (latitudeEmpty && longitudeEmpty) return "";
  if (latitudeEmpty || longitudeEmpty) return "Latitude dan longitude harus diisi bersamaan atau dikosongkan keduanya.";
  const latitude = Number(location.latitude); const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude harus berada antara -90 dan 90.";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude harus berada antara -180 dan 180.";
  if (!inServiceArea(latitude, longitude)) return "Lokasi di luar area layanan. Saat ini hanya melayani Jawa Timur.";
  return "";
}

export function serializeLocation(location) {
  const error = validateLocationCoordinates(location);
  if (error) return { location: null, error };
  const normalized = normalizeLocation(location);
  return { location: { ...normalized, label: String(location?.label ?? "").trim(), address: String(location?.address ?? "").trim() }, error: "" };
}
