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

function CustomerBottomNav() {
  const { activeRole, isAuthenticated } = useAuth();
  const { t } = usePreferences();
  if (isAuthenticated && activeRole !== "customer") return null;
  const accountPath = isAuthenticated ? "/profile" : "/login";
  return <nav className="customer-bottom-nav" aria-label="Customer">
    {items.map((item) => <NavLink to={item.to} end={item.end} key={item.key}><Icon path={item.path} /><span>{t(item.key)}</span></NavLink>)}
    <NavLink to={accountPath}><Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" /><span>{t("nav.account")}</span></NavLink>
  </nav>;
}
export default CustomerBottomNav;
