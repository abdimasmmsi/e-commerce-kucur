import { legacyStoreId } from "../services/legacyStoreReferences";

export const storeTypeOptions = [{ value: "product", label: "Produk Lokal" }];

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

export const storeTypeLabels = Object.fromEntries(
  storeTypeOptions.map((option) => [option.value, option.label]),
);

export function getStoreManagementPath(store) {
  return `/merchant/stores/${legacyStoreId(store.id)}/products`;
}
