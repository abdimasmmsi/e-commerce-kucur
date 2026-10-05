import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import "./CustomerBottomNav.css";

const items = [
  { to: "/", key: "nav.home", end: true, path: "M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9.5 19v-5h5v5" },
  { to: "/products", key: "nav.products", path: "M6 8.5h12l-1 11H7l-1-11ZM9 9V7a3 3 0 0 1 6 0v2" },
  { to: "/orders", key: "nav.orders", path: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" },
];
const Icon = ({ path }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>;

// Di halaman Akun, pengguna merchant/kurir/admin tetap butuh jalan pulang ke workspace-nya.
const workspaceItems = {
  merchant: [{ to: "/merchant", end: true, id: "Beranda", en: "Home", path: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" }, { to: "/merchant/orders", id: "Pesanan", en: "Orders", path: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" }, { to: "/merchant/stores", id: "Lapak", en: "Stores", path: "M4 10h16l-2-6H6l-2 6ZM5 10v10h14V10M9 20v-6h6v6" }],
  courier: [{ to: "/courier", end: true, id: "Beranda", en: "Home", path: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" }, { to: "/courier/batches", id: "Antar", en: "Deliver", path: "M3 7h11v10H3zM14 10h4l3 3v4h-7z" }, { to: "/courier/history", id: "Riwayat", en: "History", path: "M12 7v5l3 2M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" }],
  admin: [{ to: "/admin", end: true, id: "Beranda", en: "Home", path: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" }, { to: "/admin/transactions", id: "Transaksi", en: "Orders", path: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" }, { to: "/admin/delivery-batches", id: "Pengiriman", en: "Delivery", path: "M3 7h11v10H3zM14 10h4l3 3v4h-7z" }],
};

function CustomerBottomNav() {
  const { activeRole, isAuthenticated } = useAuth();
  const { language, t } = usePreferences();
  const workspace = isAuthenticated && activeRole !== "customer" ? workspaceItems[activeRole] : null;
  if (isAuthenticated && activeRole !== "customer" && !workspace) return null;
  const accountPath = isAuthenticated ? "/profile" : "/login";
  return <nav className={`customer-bottom-nav${workspace ? ` ${activeRole}-bottom-nav` : ""}`} aria-label={workspace ? t("workspace.navigation") : "Customer"}>
    {workspace
      ? workspace.map((item) => <NavLink to={item.to} end={item.end} key={item.to}><Icon path={item.path} /><span>{language === "id" ? item.id : item.en}</span></NavLink>)
      : items.map((item) => <NavLink to={item.to} end={item.end} key={item.key}><Icon path={item.path} /><span>{t(item.key)}</span></NavLink>)}
    <NavLink to={accountPath}><Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" /><span>{t("nav.account")}</span></NavLink>
  </nav>;
}
export default CustomerBottomNav;
