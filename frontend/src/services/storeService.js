import { apiData } from "./apiClient";

const normalizeStore = (store) => ({
  ...store,
  id: String(store.id),
  merchantUserId: String(store.merchantUserId),
  location: {
    source: store.location?.source === "lentera" ? "lentera" : "local",
    locationRef: store.location?.locationRef ?? null,
    label: store.location?.label ?? null,
    address: store.location?.address ?? null,
    latitude: store.location?.latitude ?? null,
    longitude: store.location?.longitude ?? null,
  },
});

export const storeService = {
  list: async () => (await apiData("/api/stores")).map(normalizeStore),
  get: async (storeId) => normalizeStore(await apiData(`/api/stores/${encodeURIComponent(storeId)}`)),
  create: async (input) => normalizeStore(await apiData("/api/stores", { method: "POST", body: { ...input, type: "product" } })),
  update: async (storeId, input) => normalizeStore(await apiData(`/api/stores/${encodeURIComponent(storeId)}`, { method: "PATCH", body: input.type === undefined ? input : { ...input, type: "product" } })),
  setAvailability: async (storeId, acceptingOrders) => normalizeStore(await apiData(`/api/stores/${encodeURIComponent(storeId)}/availability`, { method: "PATCH", body: { acceptingOrders } })),
  applications: async () => (await apiData("/api/stores/applications")).map(normalizeStore),
  application: async (storeId) => normalizeStore(await apiData(`/api/stores/applications/${encodeURIComponent(storeId)}`)),
  reviewApplication: async (storeId, status, reason) => normalizeStore(await apiData(`/api/stores/applications/${encodeURIComponent(storeId)}/review`, { method: "PATCH", body: { status, reason } })),
};
