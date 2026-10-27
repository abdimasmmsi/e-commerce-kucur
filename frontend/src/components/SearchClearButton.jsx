import { usePreferences } from "../context/PreferencesContext";

// Tombol hapus teks pencarian bergaya aplikasi (pengganti tombol "x" bawaan peramban). Tampil hanya bila kolom terisi.
export default function SearchClearButton({ value, onClear, className = "" }) {
  const { language } = usePreferences();
  if (!value) return null;
  const label = language === "id" ? "Hapus pencarian" : "Clear search";
  return <button className={`search-clear-button ${className}`} type="button" aria-label={label} title={label} data-no-busy onMouseDown={(event) => event.preventDefault()} onClick={onClear}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
  </button>;
}
