import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";

const Icon = ({ path }) => <svg className="size-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={path}/></svg>;
const baseItems = [
  ["/", "nav.home", true, "M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9.5 19v-5h5v5"],
  ["/products", "nav.products", false, "M6 8.5h12l-1 11H7l-1-11ZM9 9V7a3 3 0 0 1 6 0v2"],
  ["/cart", "nav.cart", false, "M3.5 4.5h2l1.8 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4l1.5-5.3H6.3M9.5 19.2h.01M17.5 19.2h.01"],
  ["/orders", "nav.orders", false, "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"],
];

export default function CustomerSidebar() {
  const { isAuthenticated } = useAuth();
  const { t } = usePreferences();
  const items = isAuthenticated ? [...baseItems, ["/my-reviews", "nav.reviews", false, "m12 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 3Z"]] : baseItems;
  return <aside className="sticky top-[70px] hidden h-[calc(100dvh-70px)] min-w-0 border-r border-[var(--kucur-border)] bg-[var(--kucur-surface)] lg:flex lg:flex-col">
    <div className="px-5 pb-3 pt-7"><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--kucur-text-muted)]">{t("account.eyebrow")}</span></div>
    <nav className="grid gap-1 px-3" aria-label={t("header.primaryNavigation")}>
      {items.map(([to, key, end, path]) => <NavLink className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl border-l-[3px] px-3 text-sm font-bold transition ${isActive ? "border-kucur-green bg-kucur-sand text-kucur-forest" : "border-transparent text-[var(--kucur-text-muted)] hover:bg-[var(--kucur-surface-elevated)] hover:text-[var(--kucur-text)]"}`} to={to} end={end} key={to}><Icon path={path}/><span>{t(key)}</span></NavLink>)}
    </nav>
    <div className="mt-auto border-t border-[var(--kucur-border)] p-4"><p className="text-xs leading-5 text-[var(--kucur-text-muted)]">{t("commerceHome.description")}</p></div>
  </aside>;
}
