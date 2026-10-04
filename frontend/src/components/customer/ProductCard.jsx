import { Link } from "react-router-dom";
import ProductImage from "../ProductImage";

export default function ProductCard({ product, storeName, price, stockLabel, detailLabel, actionLabel, onAction, disabled = false }) {
  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] shadow-[0_6px_24px_rgba(30,48,34,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--kucur-green)_45%,var(--kucur-border))] hover:shadow-[0_14px_34px_rgba(30,48,34,0.1)]">
    <Link className="relative block aspect-square overflow-hidden bg-[var(--kucur-surface-elevated)]" to={`/products/${product.id}`} aria-label={product.name}><ProductImage className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" product={product} alt={product.name}/></Link>
    <div className="flex flex-1 flex-col p-3 sm:p-4">
      <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--kucur-text-muted)]">{storeName}</span>
      <Link className="mt-1 line-clamp-2 min-h-10 text-sm font-extrabold leading-5 text-[var(--kucur-text)] sm:text-base" to={`/products/${product.id}`}>{product.name}</Link>
      <strong className="mt-2 break-words text-sm font-black !text-kucur-forest dark:!text-emerald-300 sm:text-base">{price}</strong>
      {stockLabel && <span className="mt-1 text-xs text-[var(--kucur-text-muted)]">{stockLabel}</span>}
      <div className={`mt-auto grid gap-2 pt-4 ${onAction ? "grid-cols-2" : "grid-cols-1"}`}>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] px-2 text-xs font-bold text-[var(--kucur-text)] transition hover:border-kucur-forest hover:text-kucur-forest" to={`/products/${product.id}`}>{detailLabel}</Link>
        {onAction && <button className="min-h-10 rounded-xl bg-kucur-forest px-2 text-xs font-bold text-white transition hover:bg-kucur-forest-dark disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={disabled} onClick={() => onAction(product)}>{actionLabel}</button>}
      </div>
    </div>
  </article>;
}
