import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "./ProductImage";
import { usePreferences } from "../context/PreferencesContext";
import { HISTORY_EVENT, clearSearches, clearViewed, getSearches, getViewed, removeSearch } from "../utils/browsingHistory";

const LIMIT = 5;
const copyByLanguage = {
  id: { searches: "Riwayat pencarian", viewed: "Terakhir dilihat", clear: "Hapus semua", more: "Lihat selengkapnya", less: "Tampilkan lebih sedikit", remove: "Hapus dari riwayat" },
  en: { searches: "Search history", viewed: "Recently viewed", clear: "Clear all", more: "See all", less: "Show less", remove: "Remove from history" },
};

// Panel di bawah kolom cari: 5 pencarian terakhir (bisa dilihat semua & dihapus) dan 5 produk terakhir dilihat.
export default function SearchHistoryPanel({ query = "", onPick, onNavigate, className = "" }) {
  const { formatCurrency, language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const [searches, setSearches] = useState(getSearches);
  const [viewed, setViewed] = useState(getViewed);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const refresh = () => { setSearches(getSearches()); setViewed(getViewed()); };
    window.addEventListener(HISTORY_EVENT, refresh);
    return () => window.removeEventListener(HISTORY_EVENT, refresh);
  }, []);
  const term = query.trim().toLowerCase();
  const matching = term ? searches.filter((item) => item.toLowerCase().includes(term)) : searches;
  const shownSearches = expanded ? matching : matching.slice(0, LIMIT);
  const shownViewed = term ? [] : viewed.slice(0, LIMIT);
  if (!shownSearches.length && !shownViewed.length) return null;
  // onMouseDown preventDefault: klik di panel tidak membuat kolom cari kehilangan fokus sebelum aksi jalan.
  const keepFocus = (event) => event.preventDefault();

  return <div className={`search-history-panel z-[70] grid gap-3 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-3 text-left text-[var(--kucur-text)] shadow-[var(--shadow-lift)] ${className}`} onMouseDown={keepFocus}>
    {shownSearches.length > 0 && <section aria-label={copy.searches}>
      <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-[13px] font-bold text-[var(--kucur-text-muted)]">{copy.searches}</h2><button className="min-h-9 px-2 text-[13px] font-bold text-[var(--kucur-green-ink)]" type="button" data-no-busy onClick={clearSearches}>{copy.clear}</button></div>
      <ul>{shownSearches.map((item) => <li className="flex items-center gap-1" key={item}>
        <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-[15px] hover:bg-[var(--kucur-surface-elevated)]" type="button" data-no-busy onClick={() => onPick(item)}>
          <svg className="size-4 shrink-0 text-[var(--kucur-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span className="truncate">{item}</span>
        </button>
        <button className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--kucur-text-muted)] hover:bg-[var(--kucur-surface-elevated)]" type="button" data-no-busy aria-label={`${copy.remove}: ${item}`} onClick={() => removeSearch(item)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </li>)}</ul>
      {matching.length > LIMIT && <button className="min-h-10 px-2 text-[13px] font-bold text-[var(--kucur-green-ink)]" type="button" data-no-busy onClick={() => setExpanded((value) => !value)}>{expanded ? copy.less : `${copy.more} (${matching.length})`}</button>}
    </section>}
    {shownViewed.length > 0 && <section aria-label={copy.viewed}>
      <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-[13px] font-bold text-[var(--kucur-text-muted)]">{copy.viewed}</h2><button className="min-h-9 px-2 text-[13px] font-bold text-[var(--kucur-green-ink)]" type="button" data-no-busy onClick={clearViewed}>{copy.clear}</button></div>
      <ul className="grid gap-1">{shownViewed.map((item) => <li key={item.id}>
        <Link className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--kucur-surface-elevated)]" to={`/products/${item.id}`} onClick={onNavigate}>
          <span className="block size-10 shrink-0 overflow-hidden rounded-lg [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage className="size-10" product={{ name: item.name, category: item.category }} image={item.image ? { url: item.image } : undefined} alt="" /></span>
          <span className="grid min-w-0"><span className="truncate text-[15px] font-semibold">{item.name}</span>{item.price != null && <span className="text-[13px] text-[var(--kucur-text-muted)]">{formatCurrency(Number(item.price))}</span>}</span>
        </Link>
      </li>)}</ul>
    </section>}
  </div>;
}
