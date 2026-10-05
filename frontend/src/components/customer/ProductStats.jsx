import { usePreferences } from "../../context/PreferencesContext";

// "★ 4,8 · 41 terjual" — hanya tampil kalau ada ulasan atau penjualan.
export default function ProductStats({ ratingAverage, ratingCount = 0, soldCount = 0, className = "" }) {
  const { language } = usePreferences();
  const locale = language === "id" ? "id-ID" : "en-US";
  const hasRating = ratingCount > 0 && Number.isFinite(Number(ratingAverage));
  if (!hasRating && !(soldCount > 0)) return null;
  const sold = soldCount >= 1000 ? `${Math.floor(soldCount / 1000)}${language === "id" ? "rb+" : "k+"}` : soldCount.toLocaleString(locale);
  return <span className={`flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-[var(--kucur-text-muted)] sm:text-[13px] ${className}`}>
    {hasRating && <><svg className="size-3.5 shrink-0 text-[var(--kucur-amber)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z"/></svg><span className="font-bold text-[var(--kucur-text)]">{Number(ratingAverage).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span></>}
    {hasRating && soldCount > 0 && <span aria-hidden="true">·</span>}
    {soldCount > 0 && <span>{language === "id" ? `${sold} terjual` : `${sold} sold`}</span>}
  </span>;
}
