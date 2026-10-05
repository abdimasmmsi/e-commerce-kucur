import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { roleHomePaths } from "../utils/authNavigation";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { useSystemSettings } from "../context/SystemSettingsContext";
import AppHeader from "../components/AppHeader";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { openFaqBot } from "../utils/faqMatcher.js";
import "./AccountLayout.css";
import "./AccountLayoutMobile.css";
import "../pages/auth/Profile.css";

const Icon = ({ name }) => {
  const paths = {
    profile: <><circle cx="12" cy="8" r="3"/><path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/></>,
    messages: <path d="M4 5h16v11H9l-5 4V5Z"/>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5M12 16.5h.01"/></>,
    reports: <><path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 11h6M9 15h6M14 3v4h4"/></>,
    bug: <><path d="M8 9h8v7a4 4 0 0 1-8 0V9Z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M4 12h4m8 0h4M5 18l3-2m8 0 3 2"/></>,
    pin: <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/></>,
    store: <><path d="M4 10h16l-2-6H6l-2 6Z"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function AccountLayout() {
  const { activeRole, logout, switchRole, user } = useAuth();
  const { language, t } = usePreferences();
  const navigate = useNavigate();
  // HP: /profile menjadi hub berisi daftar menu; halaman akun lain cukup menampilkan tautan kembali.
  const { pathname } = useLocation();
  const isHub = pathname === "/profile";
  const isChatRoom = /^\/messages\/[^/]+/.test(pathname);
  const { settings } = useSystemSettings();
  const contactPhone = settings?.adminContactPhone?.trim();
  // Nomor lokal 08xx diubah ke format internasional 628xx untuk tautan WhatsApp.
  const whatsappNumber = contactPhone ? contactPhone.replace(/[^0-9]/g, "").replace(/^0/, "62") : "";
  const contactCopy = language === "id" ? { title: "Butuh bantuan?", body: "Hubungi pengelola desa", whatsapp: "WhatsApp", call: "Telepon" } : { title: "Need help?", body: "Contact the village manager", whatsapp: "WhatsApp", call: "Call" };
  const workspaceRoles = (user?.roles ?? []).filter((role) => role !== activeRole);
  const openWorkspace = async (role) => { const result = await Promise.resolve(switchRole(role)); if (result?.success !== false) navigate(roleHomePaths[role] ?? "/"); };
  const workspaceCopy = language === "id" ? { customer: "Belanja sebagai pembeli", merchant: "Buka Lapak Saya", courier: "Buka Halaman Kurir", admin: "Buka Halaman Admin", hint: "Pindah ke halaman kerja" } : { customer: "Shop as a buyer", merchant: "Open My Store", courier: "Open Courier Workspace", admin: "Open Admin Workspace", hint: "Switch to your workspace" };
  const handleLogout = async () => { await logout(); window.location.replace("/"); };

  const groups = [
    { label: t("accountNav.account"), items: [
      { to: "/profile", label: t("header.profile"), icon: "profile" },
      ...(user?.roles?.includes("customer") ? [{ to: "/addresses", label: t("header.addresses"), icon: "pin" }] : []),
      { to: "/settings", label: t("header.settings"), icon: "settings" },
    ] },
    { label: t("accountNav.communication"), items: [
      { to: "/messages", label: t("header.messagesHelp"), icon: "messages" },
      { action: openFaqBot, key: "faq", label: language === "id" ? "Bantuan (FAQ)" : "Help (FAQ)", icon: "help" },
    ] },
  ];
  if (user?.roles?.includes("customer") && !user.roles.includes("merchant")) groups.push({ label: t("accountNav.selling"), items: [{ to: "/merchant/apply", label: t("header.becomeMerchant"), icon: "store" }] });

  return <div className="account-layout">
    <AppHeader accountMode workspaceRole={activeRole === "customer" ? "" : activeRole} />
    <div className={`account-layout-shell ${isHub ? "is-hub" : ""} ${isChatRoom ? "is-chat-room" : ""}`}>
      <aside className={`account-layout-sidebar ${isHub ? "is-hub" : "is-sub"}`}><Link className="account-back-link" to="/profile">← {t("nav.account")}</Link>
        {workspaceRoles.length > 0 && <div className="account-workspace-switch" aria-label={workspaceCopy.hint}>{workspaceRoles.map((role) => <button type="button" key={role} onClick={() => void openWorkspace(role)}><Icon name={role === "merchant" ? "store" : "profile"}/><span>{workspaceCopy[role] ?? role}</span><b aria-hidden="true">→</b></button>)}</div>}<nav aria-label={t("workspace.navigation")}>{groups.map((group) => <section className="account-nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map((item) => item.action ? <button className="account-nav-logout account-nav-action" type="button" key={item.key} onClick={item.action}><Icon name={item.icon}/><span>{item.label}</span></button> : <NavLink to={item.to} state={item.state} key={item.to}><Icon name={item.icon}/><span>{item.label}</span></NavLink>)}</section>)}{contactPhone && <section className="account-help-contact"><strong>{contactCopy.title}</strong><span>{contactCopy.body}{settings?.adminContactName ? `: ${settings.adminContactName}` : ""}</span><span className="account-help-number">{contactPhone}</span><div><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">{contactCopy.whatsapp}</a><a href={`tel:${contactPhone.replace(/\s/g, "")}`}>{contactCopy.call}</a></div></section>}<button className="account-nav-logout" type="button" onClick={handleLogout}><Icon name="logout"/><span>{t("header.logout")}</span></button></nav>
      </aside>
      <main className="account-layout-main"><Outlet /></main>
    </div>
    <CustomerBottomNav />
  </div>;
}

export default AccountLayout;
