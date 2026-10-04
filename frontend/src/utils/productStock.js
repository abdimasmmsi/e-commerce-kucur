import { getProductTotalStock } from "../services/productService";

const LOW_STOCK_LIMIT = 5;

// Label stok untuk kartu produk: hanya muncul saat stok menipis atau habis.
export function productStockBadge(product, t) {
  const stock = getProductTotalStock(product);
  if (stock <= 0) return { stockLabel: t("commerce.outOfStock"), stockTone: "out" };
  if (stock <= LOW_STOCK_LIMIT) return { stockLabel: t("commerce.stockLeft", { count: stock }), stockTone: "low" };
  return {};
}
