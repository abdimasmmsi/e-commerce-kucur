export const PRODUCTS_STORAGE_KEY = "kucur_merchant_products";

export const PRODUCTS_UPDATED_EVENT = "kucur-products-updated";
export const LOW_STOCK_THRESHOLD = 5;

export function getActiveProductVariants(product) {
  return product?.hasVariants && Array.isArray(product.variants)
    ? product.variants.filter((variant) => variant.status === "active")
    : [];
}

export function getProductDisplayPrice(product) {
  const variants = getActiveProductVariants(product);
  if (!variants.length) return Number(product?.price) || 0;
  return Math.min(...variants.map((variant) => Number(variant.price) || 0));
}

export function getProductTotalStock(product) {
  const variants = getActiveProductVariants(product);
  if (!product?.hasVariants) return Number(product?.stock) || 0;
  return variants.reduce((total, variant) => total + Math.max(Number(variant.stock) || 0, 0), 0);
}

export function hasLowProductStock(product) {
  const variants = getActiveProductVariants(product);
  return product?.hasVariants
    ? variants.some((variant) => Number(variant.stock) <= LOW_STOCK_THRESHOLD)
    : Number(product?.stock) <= LOW_STOCK_THRESHOLD;
}

export const productCategories = [
  "Makanan",
  "Minuman",
  "Oleh-Oleh",
  "Kerajinan",
  "Hasil Pertanian",
  "Lainnya",
];

export const mockProducts = [
  {
    id: "PRD-001",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    name: "Keripik Tempe Kucur",
    category: "Makanan",
    price: 35000,
    stock: 24,
    description: "Keripik tempe renyah buatan warga Desa Kucur dengan bumbu rempah pilihan.",
    image: "",
    status: "active",
    createdAt: "2026-08-01T09:00:00+07:00",
    updatedAt: "2026-08-01T09:00:00+07:00",
  },
  {
    id: "PRD-002",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    name: "Kopi Robusta Lereng Kawi",
    category: "Minuman",
    price: 68000,
    stock: 5,
    description: "Biji kopi robusta lokal dengan aroma cokelat dan rasa yang kuat.",
    image: "",
    status: "active",
    createdAt: "2026-08-02T09:00:00+07:00",
    updatedAt: "2026-08-10T14:30:00+07:00",
  },
  {
    id: "PRD-003",
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    name: "Anyaman Bambu Mini",
    category: "Kerajinan",
    price: 45000,
    stock: 0,
    description: "Kerajinan anyaman bambu handmade untuk dekorasi dan suvenir.",
    image: "",
    status: "inactive",
    createdAt: "2026-08-03T09:00:00+07:00",
    updatedAt: "2026-08-12T08:15:00+07:00",
  },
  {
    id: "PRD-QA-VARIANT",
    qaFixture: true,
    storeId: "1",
    merchantUserId: "USR-MERCHANT-001",
    name: "Keripik Pisang Varian QA",
    category: "Makanan",
    hasVariants: true,
    price: 25000,
    stock: 0,
    variantGroups: [
      { id: "GROUP-RASA", name: "Rasa", options: ["Original", "Balado"] },
      { id: "GROUP-UKURAN", name: "Ukuran", options: ["250gr", "500gr"] },
    ],
    variants: [
      { id: "SKU-QA-ORI-250", sku: "QA-ORI-250", options: { Rasa: "Original", Ukuran: "250gr" }, price: 25000, stock: 5, status: "active" },
      { id: "SKU-QA-BAL-250", sku: "QA-BAL-250", options: { Rasa: "Balado", Ukuran: "250gr" }, price: 27000, stock: 0, status: "active" },
      { id: "SKU-QA-ORI-500", sku: "QA-ORI-500", options: { Rasa: "Original", Ukuran: "500gr" }, price: 45000, stock: 8, status: "active" },
    ],
    description: "Produk fixture QA untuk memverifikasi kombinasi SKU, harga, dan stok varian.",
    image: "",
    status: "active",
    createdAt: "2026-08-20T09:00:00+07:00",
    updatedAt: "2026-08-20T09:00:00+07:00",
  },
  {
    id: "PRD-QA-STORE-B",
    qaFixture: true,
    storeId: "4",
    merchantUserId: "USR-MERCHANT-002",
    name: "Madu Kucur QA B",
    category: "Hasil Pertanian",
    price: 55000,
    stock: 12,
    description: "Produk fixture QA dari Store B untuk checkout multi-store.",
    image: "",
    status: "active",
    createdAt: "2026-08-20T09:30:00+07:00",
    updatedAt: "2026-08-20T09:30:00+07:00",
  },
];

const readStoredProducts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function getProducts() {
  const storedProducts = readStoredProducts();
  if (storedProducts) {
    const existingIds = new Set(storedProducts.map((product) => String(product.id)));
    const missingQaFixtures = mockProducts.filter((product) => product.qaFixture && !existingIds.has(String(product.id)));
    if (!missingQaFixtures.length) return storedProducts;
    const result = [...storedProducts, ...missingQaFixtures];
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(result));
    return result;
  }
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(mockProducts));
  return [...mockProducts];
}

export function getStoreProducts(storeId, merchantUserId) {
  return getProducts().filter(
    (product) => String(product.storeId) === String(storeId)
      && product.merchantUserId === merchantUserId,
  );
}

export function saveProducts(products) {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent(PRODUCTS_UPDATED_EVENT));
  return products;
}

export function addProduct(product) {
  const products = getProducts();
  return saveProducts([...products, product]);
}

export function updateProduct(productId, storeId, merchantUserId, changes) {
  let updatedProduct = null;
  const nextProducts = getProducts().map((product) => {
    const isOwnedProduct = String(product.id) === String(productId)
      && String(product.storeId) === String(storeId)
      && product.merchantUserId === merchantUserId;
    if (!isOwnedProduct) return product;
    updatedProduct = { ...product, ...changes, updatedAt: new Date().toISOString() };
    return updatedProduct;
  });
  saveProducts(nextProducts);
  return updatedProduct;
}

export function deleteProduct(productId, storeId, merchantUserId) {
  const currentProducts = getProducts();
  const nextProducts = currentProducts.filter((product) => !(
    String(product.id) === String(productId)
      && String(product.storeId) === String(storeId)
      && product.merchantUserId === merchantUserId
  ));
  if (nextProducts.length === currentProducts.length) return false;
  saveProducts(nextProducts);
  return true;
}

export function toggleProductStatus(productId, storeId, merchantUserId) {
  const product = getStoreProducts(storeId, merchantUserId).find(
    (item) => String(item.id) === String(productId),
  );
  if (!product) return null;
  return updateProduct(productId, storeId, merchantUserId, {
    status: product.status === "active" ? "inactive" : "active",
  });
}
