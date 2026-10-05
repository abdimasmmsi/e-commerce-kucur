import { Link } from "react-router-dom";
import ProductImage from "../ProductImage";
import ProductStats from "./ProductStats";

// Seluruh kartu bisa diketuk (link nama produk diperluas menutup kartu).
// stockLabel hanya diisi pemanggil saat stok menipis/habis; stockTone: "low" | "out".
export default function ProductCard({ product, storeName, price, stockLabel, stockTone = "low" }) {
  return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparent bg-[var(--kucur-surface)] shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] active:scale-[0.98] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[var(--kucur-green)]">
    <div className="aspect-square max-w-full overflow-hidden bg-[var(--kucur-surface-elevated)]"><ProductImage className="h-full w-full object-cover" product={product} alt=""/></div>
    <div className="flex flex-1 flex-col gap-0.5 p-3">
      <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-[var(--kucur-text)]"><Link className="outline-none after:absolute after:inset-0" to={`/products/${product.id}`}>{product.name}</Link></h3>
      <strong className="mt-1 break-words text-[17px] font-extrabold leading-tight text-[var(--kucur-text)]">{price}</strong>
      <ProductStats ratingAverage={product.ratingAverage} ratingCount={product.ratingCount} soldCount={product.soldCount} />
      <span className="truncate text-[13px] text-[var(--kucur-text-muted)]">{storeName}</span>
      {stockLabel && <span className={`text-[13px] font-bold ${stockTone === "out" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>{stockLabel}</span>}
    </div>
  </article>;
}

