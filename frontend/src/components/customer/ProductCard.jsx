import { Link } from "react-router-dom";
import ProductImage from "../ProductImage";
import ProductStats from "./ProductStats";
import { usePreferences } from "../../context/PreferencesContext";
import { discountInfo } from "../../utils/discount";

// Seluruh kartu bisa diketuk (link nama produk diperluas menutup kartu).
// stockLabel hanya diisi pemanggil saat stok menipis/habis; stockTone: "low" | "out".
export default function ProductCard({ product, storeName, price, stockLabel, stockTone = "low" }) {
  const { formatCurrency, language } = usePreferences();
  const discount = discountInfo(product);
  return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] transition duration-200 hover:border-[var(--kucur-border-strong)] hover:shadow-[var(--shadow-soft)] active:scale-[0.98] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[var(--kucur-green)]">
    <div className="relative aspect-square max-w-full overflow-hidden bg-[var(--kucur-surface-elevated)]"><ProductImage className="h-full w-full object-cover" product={product} alt=""/>{discount && <span className="absolute left-1.5 top-1.5 rounded-md bg-rose-700 px-1.5 py-0.5 text-[11px] font-extrabold text-white">{language === "en" ? `${discount.percent}% off` : `-${discount.percent}%`}</span>}</div>
    <div className="flex flex-1 flex-col gap-0.5 px-2.5 pb-3 pt-2.5 sm:p-3">
      <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug sm:text-[15px] text-[var(--kucur-text)]"><Link className="outline-none after:absolute after:inset-0" to={`/products/${product.id}`}>{product.name}</Link></h3>
      <strong className="mt-1 break-words text-base font-extrabold sm:text-[17px] leading-tight text-[var(--kucur-text)]">{price}</strong>{discount && <s className="text-[12px] text-[var(--kucur-text-muted)]">{formatCurrency(discount.compareAt)}</s>}
      <ProductStats ratingAverage={product.ratingAverage} ratingCount={product.ratingCount} soldCount={product.soldCount} />
      <span className="truncate text-[13px] text-[var(--kucur-text-muted)]">{storeName}</span>
      {stockLabel && <span className={`text-[13px] font-bold ${stockTone === "out" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>{stockLabel}</span>}
    </div>
  </article>;
}

