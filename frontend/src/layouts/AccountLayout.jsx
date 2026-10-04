import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import AppHeader from "../components/AppHeader";
import CustomerBottomNav from "../components/CustomerBottomNav";
import "./AccountLayout.css";
import "./AccountLayoutMobile.css";
import "../pages/auth/Profile.css";

const Icon = ({ name }) => {
  const paths = {
    profile: <><circle cx="12" cy="8" r="3"/><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/></>,
    messages: <path d="M4 5h16v11H9l-5 4V5Z"/>,
    reports: <><path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 11h6M9 15h6M14 3v4h4"/></>,
    bug: <><path d="M8 9h8v7a4 4 0 0 1-8 0V9Z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M4 12h4m8 0h4M5 18l3-2m8 0 3 2"/></>,
    store: <><path d="M4 10h16l-2-6H6l-2 6Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function AccountLayout() {
  const { activeRole, logout, user } = useAuth();
  const handleLogout = async () => { await logout(); window.location.replace("/"); };
  const { t } = usePreferences();
  const groups = [
    { label: t("accountNav.account"), items: [
      { to: "/profile", label: t("header.profile"), icon: "profile" },
      { to: "/settings", label: t("header.settings"), icon: "settings" },
    ] },
    { label: t("accountNav.communication"), items: [
      { to: "/messages", label: t("header.messagesHelp"), icon: "messages" },
    ] },
  ];
  if (user?.roles?.includes("customer") && !user.roles.includes("merchant")) groups.push({ label: t("accountNav.selling"), items: [{ to: "/merchant/apply", label: t("header.becomeMerchant"), icon: "store" }] });

  return <div className="account-layout">
    <AppHeader accountMode workspaceRole={activeRole === "customer" ? "" : activeRole} />
    <div className="account-layout-shell">
      <aside className="account-layout-sidebar">
        <nav aria-label={t("workspace.navigation")}>{groups.map((group) => <section className="account-nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map((item) => <NavLink to={item.to} state={item.state} key={item.to}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}</section>)}<button className="account-nav-logout" type="button" onClick={handleLogout}><Icon name="logout"/><span>{t("header.logout")}</span></button></nav>
      </aside>
      <main className="account-layout-main"><Outlet /></main>
    </div>
    <CustomerBottomNav />
  </div>;
}

export default AccountLayout;
