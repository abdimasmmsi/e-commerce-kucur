import { apiData } from "./apiClient";

const normalizeImage = (image, index) => ({
  ...image,
  id: String(image.id),
  position: Number(image.position ?? index),
  isPrimary: Boolean(image.isPrimary),
});

const normalizeVariant = (variant) => ({
  ...variant,
  id: String(variant.id),
  price: Number(variant.price),
  stock: Number(variant.stock),
  options: variant.options ?? {},
});

export const normalizeProduct = (product) => ({
  ...product,
  id: String(product.id),
  storeId: String(product.storeId ?? product.store?.id),
  merchantUserId: product.merchantUserId ?? product.store?.merchantUserId,
  price: Number(product.price ?? 0),
  stock: Number(product.stock ?? 0),
  hasVariants: Boolean(product.hasVariants ?? product.type === "variant"),
  images: (product.images ?? []).map(normalizeImage).sort((a, b) => a.position - b.position),
  variantGroups: product.variantGroups ?? product.options ?? [],
  variants: (product.variants ?? product.skus ?? []).map(normalizeVariant),
});

const normalizeList = (payload) => {
  const rows = Array.isArray(payload) ? payload : payload?.items ?? [];
  return rows.map(normalizeProduct);
};

export const productService = {
  list: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, value);
    });
    const query = params.size ? `?${params}` : "";
    return normalizeList(await apiData(`/api/products${query}`));
  },
  get: async (productId, filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, value);
    });
    const query = params.size ? `?${params}` : "";
    return normalizeProduct(await apiData(`/api/products/${encodeURIComponent(productId)}${query}`));
  },
  create: async (input) => normalizeProduct(await apiData("/api/products", { method: "POST", body: input })),
  publicStore: async (storeId) => {
    const store = await apiData(`/api/stores/${encodeURIComponent(storeId)}/public`);
    return { ...store, products: (store.products ?? []).map(normalizeProduct) };
  },
  update: async (productId, input) => normalizeProduct(await apiData(`/api/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: input })),
};

export const productCategories = ["Makanan", "Minuman", "Oleh-Oleh", "Kerajinan", "Hasil Pertanian", "Lainnya"];

export function getActiveProductVariants(product) {
  return product?.hasVariants ? (product.variants ?? []).filter((variant) => variant.status === "active") : [];
}

export function getProductDisplayPrice(product) {
  const variants = getActiveProductVariants(product);
  return variants.length ? Math.min(...variants.map((variant) => variant.price)) : Number(product?.price ?? 0);
}

export function getProductTotalStock(product) {
  const variants = getActiveProductVariants(product);
  return product?.hasVariants ? variants.reduce((sum, variant) => sum + Math.max(variant.stock, 0), 0) : Math.max(Number(product?.stock ?? 0), 0);
}

export function hasLowProductStock(product) {
  const variants = getActiveProductVariants(product);
  return product?.hasVariants ? variants.some((variant) => variant.stock <= 5) : Number(product?.stock ?? 0) <= 5;
}
