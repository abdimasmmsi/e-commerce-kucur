// Diskon dari harga coret: { compareAt, percent } atau null. Produk varian memakai varian aktif termurah.
export function discountInfo(product, variant = null) {
  const pick = variant ?? (product?.hasVariants ? (product.variants ?? []).filter((item) => item.status === "active").sort((a, b) => Number(a.price) - Number(b.price))[0] : product);
  const price = Number(pick?.price); const compareAt = Number(pick?.compareAtPrice);
  if (!Number.isFinite(price) || !Number.isFinite(compareAt) || compareAt <= price || price <= 0) return null;
  return { compareAt, percent: Math.round((1 - price / compareAt) * 100) };
}
