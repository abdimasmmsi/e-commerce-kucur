// Kepala halaman standar semua panel (Penjual, Kurir, Admin, akun): eyebrow 14/600 hijau, judul 24px (HP) / 30px (laptop) berat 800, deskripsi 14px.
// Ukuran dikunci juga di styles/refine.css (.page-head) supaya CSS lama tiap panel tidak mengubahnya.
// inlineActions: tombol aksi tetap di kanan judul walau di HP (untuk satu tombol pendek). actionsClassName: mis. "hidden sm:flex".
export default function PageHeader({ title, description, actions, eyebrow, inlineActions = false, actionsClassName = "", className = "" }) {
  const layout = inlineActions ? "flex-row items-end justify-between" : "flex-col sm:flex-row sm:items-end sm:justify-between";
  return <header className={`page-head relative mb-5 flex min-w-0 gap-4 pb-1 sm:mb-6 ${layout} ${className}`.trim()}><div className="min-w-0">{eyebrow && <span className="page-head__eyebrow text-sm font-semibold text-[var(--kucur-green-ink)]">{eyebrow}</span>}<h1 className="page-head__title mt-1 break-words text-2xl font-extrabold tracking-[-0.02em] text-[var(--kucur-text)] sm:text-3xl">{title}</h1>{description && <p className="page-head__desc mt-1 max-w-3xl break-words text-sm text-[var(--kucur-muted)]">{description}</p>}</div>{actions && <div className={`flex flex-wrap gap-2 ${inlineActions ? "shrink-0" : ""} ${actionsClassName}`.replace(/\s+/g, " ").trim()}>{actions}</div>}</header>;
}
