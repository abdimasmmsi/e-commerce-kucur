import { normalizeLocation } from "../utils/location";

// SIG LENTERA boundary. Only local locations are supported until its real API contract exists.
export const normalizeIntegratedLocation = (location, fallback) => ({
  source: location?.source === "lentera" ? "lentera" : "local",
  locationRef: location?.locationRef ?? null,
  ...normalizeLocation(location, fallback),
});

export const toStoreApiLocation = (location, fallback) => {
  const normalized = normalizeIntegratedLocation(location, fallback);
  return { label: normalized.label, address: normalized.address, latitude: normalized.latitude, longitude: normalized.longitude };
};

export const LENTERA_INTEGRATION_STATUS = "PENDING_REAL_API_CONTRACT";
