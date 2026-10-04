import { normalizeLocation } from "../utils/location";
import { legacyStoreId } from "../services/legacyStoreReferences";

export const STORES_STORAGE_KEY = "kucur_merchant_stores";

export const STORES_UPDATED_EVENT = "kucur-stores-updated";

// Temporary read-only ownership bridge until Store is migrated to PostgreSQL.
const legacyMerchantIds = {
  "00000000-0000-4000-8000-000000000003": "USR-MERCHANT-001",
  "00000000-0000-4000-8000-000000000004": "USR-MERCHANT-002",
};
const compatibleMerchantId = (merchantUserId) => legacyMerchantIds[merchantUserId] ?? merchantUserId;

export const storeTypeOptions = [
  { value: "product", label: "Produk Lokal" },
];

const legacyStoreTypes = {
  product: "product",
  "local-product": "product",
  "local-product-/-e-commerce": "product",
  "produk-lokal": "product",
  ecommerce: "product",
  "e-commerce": "product",
};

export function normalizeStoreType(value) {
  const original = String(value ?? "").trim();
  const normalized = original.toLowerCase().replaceAll(" ", "-");
  return legacyStoreTypes[normalized] ?? original;
}

export function normalizeStoreStatus(value) {
  if (value === true) return "active";
  if (value === false) return "inactive";
  const normalized = String(value ?? "active").trim().toLowerCase();
  if (["active", "aktif", "enabled", "published"].includes(normalized)) return "active";
  if (["inactive", "nonaktif", "non-active", "disabled", "draft"].includes(normalized)) return "inactive";
  return normalized || "active";
}

export const isStoreType = (store, type) => normalizeStoreType(store?.type) === type;

export const storeTypeLabels = Object.fromEntries(
  storeTypeOptions.map((option) => [option.value, option.label]),
);

export const mockStores = [
  {
    id: "1",
    merchantUserId: "USR-MERCHANT-001",
    name: "Toko Oleh-Oleh Kucur",
    type: "product",
    description: "Produk oleh-oleh, camilan, dan kerajinan lokal dari warga Desa Kucur.",
    address: "Desa Kucur, Kecamatan Dau, Kabupaten Malang, Jawa Timur",
    coordinates: { lat: -7.95716, lng: 112.53482 },
    phone: "0812-3456-7890",
    image: "",
    status: "active",
    createdAt: "2026-08-01T08:00:00+07:00",
  },
  {
    id: "4",
    qaFixture: true,
    merchantUserId: "USR-MERCHANT-002",
    name: "Toko Kucur QA B",
    type: "product",
    description: "Lapak produk kedua untuk pengujian isolasi merchant dan checkout multi-store.",
    address: "Jl. Raya Kucur, Kecamatan Dau, Kabupaten Malang, Jawa Timur",
    coordinates: { lat: -7.96041, lng: 112.53912 },
    phone: "0812-1000-0006",
    image: "",
    status: "active",
    createdAt: "2026-08-20T08:00:00+07:00",
  },
];

const readStoredStores = () => {
  const storedValue = localStorage.getItem(STORES_STORAGE_KEY);
  if (storedValue === null) return null;

  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function getStores() {
  const storedStores = readStoredStores();
  if (storedStores === null) {
    localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(mockStores));
    return mockStores.map((store) => ({ ...store, location: normalizeLocation(store.location, { label: store.name, address: store.address, lat: store.coordinates?.lat, lng: store.coordinates?.lng }) }));
  }
  let migrated = false;
  const normalizedStores = storedStores.map((store) => {
    const normalizedType = normalizeStoreType(store.type);
    const normalizedStatus = normalizeStoreStatus(store.status);
    const location = normalizeLocation(store.location, { label: store.name, address: store.address, lat: store.coordinates?.lat, lng: store.coordinates?.lng });
    const locationChanged = JSON.stringify(location) !== JSON.stringify(store.location);
    if (normalizedType === store.type && normalizedStatus === store.status && !locationChanged) return store;
    migrated = true;
    return { ...store, type: normalizedType, status: normalizedStatus, location };
  });
  const existingIds = new Set(normalizedStores.map((store) => String(store.id)));
  const missingQaFixtures = mockStores.filter((store) => store.qaFixture && !existingIds.has(String(store.id))).map((store) => ({ ...store, location: normalizeLocation(store.location, { label: store.name, address: store.address, lat: store.coordinates?.lat, lng: store.coordinates?.lng }) }));
  const result = [...normalizedStores, ...missingQaFixtures];
  if (migrated || missingQaFixtures.length) localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(result));
  return result;
}

export function getMerchantStores(merchantUserId) {
  const ownerId = compatibleMerchantId(merchantUserId);
  return getStores().filter((store) => (
    String(store.merchantUserId) === String(ownerId)
    && normalizeStoreType(store.type) === "product"
  ));
}

export function merchantOwnsStore(storeId, merchantUserId) {
  const ownerId = compatibleMerchantId(merchantUserId);
  return getStores().some((store) => String(store.id) === String(storeId) && String(store.merchantUserId) === String(ownerId));
}

export function saveStores(stores) {
  localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
  window.dispatchEvent(new CustomEvent(STORES_UPDATED_EVENT));
  return stores;
}

export function addStore(store) {
  return saveStores([store, ...getStores()]);
}

export function getStoreManagementPath(store) {
  const basePath = `/merchant/stores/${legacyStoreId(store.id)}`;
  return `${basePath}/products`;
}
