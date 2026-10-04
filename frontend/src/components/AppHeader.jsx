import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { usePreferences } from "../context/PreferencesContext";
import CartShortcut from "./CartShortcut";
import ChatUnreadBadge from "./ChatUnreadBadge";
import NotificationPopover from "./NotificationPopover";
import PreferenceControls from "./PreferenceControls";
import UserAvatar from "./UserAvatar";
import PageContainer from "./ui/PageContainer";
import { roleHomePaths } from "../utils/authNavigation";
import "./AppHeader.css";

const customerNavItems = [{ to: "/", key: "nav.home", end: true }, { to: "/products", key: "nav.products" }, { to: "/orders", key: "nav.orders" }];
function SearchForm({ className = "", onSearch, query, setQuery, t }) {
  return <form className={`customer-nav-search ${className}`} onSubmit={onSearch} role="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path strokeLinecap="round" d="m16 16 4 4"/></svg>
    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("header.searchProducts")} aria-label={t("header.searchProducts")} />
  </form>;
}

function AppHeader({ accountMode = false, workspaceRole = "" }) {
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const { activeRole, initialized, isAuthenticated, logout, switchRole, updatePreferences, user } = useAuth();
  const { language, setLanguage, setTheme, t, theme } = usePreferences();
  const { notifications, unreadCount, isRead, markAllRead, markRead } = useNotifications();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switchingRole, setSwitchingRole] = useState("");
  const [roleSwitchError, setRoleSwitchError] = useState("");
  const resolvedWorkspaceRole = workspaceRole || (accountMode && activeRole !== "customer" ? activeRole : "");
  const headerNavItems = resolvedWorkspaceRole ? [] : customerNavItems;
  const headerHome = resolvedWorkspaceRole
    ? (roleHomePaths[resolvedWorkspaceRole] ?? "/")
    : accountMode
      ? (roleHomePaths[activeRole] ?? "/")
      : customerNavItems[0].to;
  const brandLabel = t("header.storefrontBrand");
  const closeMenus = () => { setProfileOpen(false); setNotificationOpen(false); };
  const enterCustomerContext = () => {
    closeMenus();
    if (!resolvedWorkspaceRole && activeRole !== "customer" && user?.roles.includes("customer")) switchRole("customer");
  };
  const handleLogout = async () => { await logout(); closeMenus(); window.location.replace("/"); };
  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    if (isAuthenticated) void updatePreferences({ language: nextLanguage, theme });
  };
  const changeTheme = (nextTheme) => {
    setTheme(nextTheme);
    if (isAuthenticated) void updatePreferences({ language, theme: nextTheme });
  };
  const submitSearch = (event) => { event.preventDefault(); const query = search.trim(); navigate(query ? `/products?search=${encodeURIComponent(query)}` : "/products"); };
  const handleNotificationClick = (notification, navigable) => { markRead(notification.id); if (navigable) { setNotificationOpen(false); navigate(notification.link); } };
  const handleRoleSwitch = async (role) => {
    if (role === activeRole || switchingRole) return;
    setSwitchingRole(role);
    setRoleSwitchError("");
    try {
      const result = await Promise.resolve(switchRole(role));
      if (!result?.success) {
        setRoleSwitchError(result?.message ?? t("header.roleSwitchFailed"));
        return;
      }
      closeMenus();
      navigate(roleHomePaths[role] ?? "/");
    } catch (caught) {
      setRoleSwitchError(caught?.message ?? t("header.roleSwitchFailed"));
    } finally {
      setSwitchingRole("");
    }
  };

  useEffect(() => {
    const pointerDown = (event) => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); if (!notificationRef.current?.contains(event.target)) setNotificationOpen(false); };
    const keyDown = (event) => { if (event.key === "Escape") closeMenus(); };
    document.addEventListener("pointerdown", pointerDown); document.addEventListener("keydown", keyDown);
    return () => { document.removeEventListener("pointerdown", pointerDown); document.removeEventListener("keydown", keyDown); };
  }, []);

  const notificationButton = isAuthenticated && <div className="customer-notification-wrap" ref={notificationRef}>
    <button className="notification-button" type="button" title={t("header.notificationsLabel")} onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }} aria-label={`${t("header.notificationsLabel")}${unreadCount ? `, ${t("header.unreadNotifications", { count: unreadCount })}` : ""}`} aria-expanded={notificationOpen} aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 20h4"/></svg>
      {unreadCount > 0 && <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>}
    </button>
    {notificationOpen && <NotificationPopover notifications={notifications} unreadCount={unreadCount} isRead={isRead} markAllRead={markAllRead} onNotificationClick={handleNotificationClick} onClose={() => setNotificationOpen(false)} />}
  </div>;

  return <header className={`app-header${accountMode ? " app-header-account-mode" : ""}${resolvedWorkspaceRole ? ` app-header-workspace app-header-${resolvedWorkspaceRole}` : " app-header-customer"}`}><PageContainer className="!py-0">
    <div className="customer-nav-row">
      <Link className="app-brand" to={headerHome} onClick={closeMenus} aria-label={brandLabel}><span className="app-logo">K</span><span>{brandLabel}</span></Link>
      {resolvedWorkspaceRole
        ? <div className="app-workspace-context"><span>{t(`workspace.${resolvedWorkspaceRole}`)}</span></div>
        : <nav className="app-nav-links" aria-label={t("header.primaryNavigation")}>{headerNavItems.map((item) => <NavLink key={item.key} to={item.to} end={item.end} onClick={enterCustomerContext}>{t(item.key)}</NavLink>)}</nav>}
      {!accountMode && <SearchForm className="customer-desktop-search" onSearch={submitSearch} query={search} setQuery={setSearch} t={t} />}
      <div className="customer-nav-utilities">
        <PreferenceControls compact onLanguageChange={changeLanguage} onThemeChange={changeTheme} />
        {notificationButton}
        {!accountMode && <CartShortcut label={t("header.cart")} />}
        {initialized && !isAuthenticated && <div className="guest-auth-actions"><Link to="/login">{t("header.login")}</Link><Link className="register-link" to="/register">{t("header.register")}</Link></div>}
        {isAuthenticated && <div className="profile-menu-wrap" ref={profileRef}>
          <button className="profile-menu-trigger" type="button" title={t("nav.account")} onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false); }} aria-label={t("nav.account")} aria-expanded={profileOpen} aria-haspopup="menu"><UserAvatar className="profile-avatar" size={36} user={user}/><span className="profile-trigger-copy"><strong>{user.fullName}</strong><small>{t(`role.${activeRole}`)}</small></span><span className="profile-chevron" aria-hidden="true" /></button>
          {profileOpen && <div className="profile-dropdown" role="menu">
            <div className="profile-dropdown-header"><strong>{user.fullName}</strong><span>{user.email}</span></div>
            <section className="profile-workspace-summary" aria-label={t("header.availableRoles")}>
              <span>{t("header.availableRoles")}</span>
              <div>{user.roles.map((role) => user.roles.length > 1
                ? <button className={role === activeRole ? "active" : ""} type="button" key={role} aria-pressed={role === activeRole} disabled={Boolean(switchingRole)} onClick={() => handleRoleSwitch(role)}>
                    {t(`role.${role}`)}{role === activeRole && <i aria-hidden="true">✓</i>}{switchingRole === role && <i className="role-chip-spinner" aria-hidden="true" />}
                  </button>
                : <span className="active" key={role}>{t(`role.${role}`)}<i aria-hidden="true">✓</i></span>)}</div>
              <small>{t("header.currentWorkspace")}: <strong>{t(`role.${activeRole}`)}</strong></small>
              {roleSwitchError && <small className="profile-role-error" role="alert">{roleSwitchError}</small>}
            </section>
            <Link to="/profile" onClick={closeMenus}>{t("header.profile")}</Link><Link to="/settings" onClick={closeMenus}>{t("header.settings")}</Link>
            <Link to="/messages" onClick={closeMenus}>{t("header.messagesHelp")} <ChatUnreadBadge /></Link>
            {user.roles.includes("customer") && !user.roles.includes("merchant") && <Link to="/merchant/apply" onClick={closeMenus}>{t("header.becomeMerchant")}</Link>}
            <button className="profile-logout-button" type="button" onClick={handleLogout}>{t("header.logout")}</button>
          </div>}
        </div>}
      </div>
    </div>
    {!accountMode && <SearchForm className="customer-mobile-search" onSearch={submitSearch} query={search} setQuery={setSearch} t={t} />}
  </PageContainer></header>;
}

export default AppHeader;
