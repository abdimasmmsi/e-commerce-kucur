import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import WorkspaceNavIcon from "../components/WorkspaceNavIcon";
import ChatUnreadBadge from "../components/ChatUnreadBadge";
import { usePreferences } from "../context/PreferencesContext";
import "./AdminLayout.css";
import "../components/CustomerBottomNav.css";
import "../styles/workspace-shell.css";

const adminNavigation = [
  { label: "workspaceNav.overview", items: [["dashboard", "/admin", "dashboard"]] },
  { label: "workspaceNav.commerce", items: [["merchantApproval", "/admin/merchant-approval", "stores"], ["transactions", "/admin/transactions", "transactions"], ["productMonitoring", "/admin/products", "products"], ["deliveryMonitoring", "/admin/delivery-batches", "delivery"], ["reviews", "/admin/reviews", "reviews"]] },
  { label: "workspaceNav.people", items: [["users", "/admin/users", "users"], ["couriers", "/admin/couriers", "delivery"]] },
  { label: "workspaceNav.finance", items: [["financeMonitoring", "/admin/finance", "finance"]] },
  { label: "workspaceNav.system", items: [["settings", "/admin/settings", "settings"]] },
  { label: "workspaceNav.communication", items: [["supportChat", "/admin/support-chats", "chat"], ["notifications", "/admin/notifications", "notifications"]] },
];

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language, t } = usePreferences();
  const tabCopy = language === "id" ? { home: "Beranda", orders: "Transaksi", delivery: "Pengiriman", menu: "Menu" } : { home: "Home", orders: "Orders", delivery: "Delivery", menu: "Menu" };
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", sidebarOpen);
    return () => document.body.classList.remove("menu-open");
  }, [sidebarOpen]);

  return (
    <div className="admin-workspace">
      <AppHeader accountMode workspaceRole="admin" />
      <div className="admin-layout">
      {sidebarOpen && <button className="admin-overlay" type="button" onClick={closeSidebar} aria-label={t("workspace.closeMenu")} />}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <h2>{t("workspace.admin")}</h2>
          <button className="admin-close-button" onClick={closeSidebar} type="button" aria-label={t("workspace.closeMenu")}><span className="workspace-close-icon" aria-hidden="true" /></button>
        </div>
        <nav className="admin-nav workspace-nav" aria-label={`${t("workspace.navigation")} ${t("workspace.admin")}`}>
          {adminNavigation.map((group) => <section className="workspace-nav-group" aria-labelledby={`admin-nav-${group.label}`} key={group.label}>
            <h3 id={`admin-nav-${group.label}`}>{t(group.label)}</h3>
            {group.items.map(([key, path, icon]) => <NavLink to={path} end={path === "/admin"} onClick={closeSidebar} key={path}><WorkspaceNavIcon type={icon}/><span>{t(`workspace.${key}`)}</span>{path === "/admin/support-chats" && <ChatUnreadBadge adminMode />}</NavLink>)}
          </section>)}
          <section className="workspace-nav-group" aria-labelledby="admin-nav-account">
            <h3 id="admin-nav-account">{t("accountNav.account")}</h3>
            <NavLink to="/profile" onClick={closeSidebar}><WorkspaceNavIcon type="users"/><span>{t("workspace.myAccount")}</span></NavLink>
          </section>
        </nav>
      </aside>
      <main className="admin-main">
        <div className="admin-mobile-header">
          <button className="admin-menu-button" onClick={() => setSidebarOpen(true)} type="button" aria-label={t("workspace.openMenu")}><span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span></button>
          <strong>{t("workspace.admin")}</strong>
        </div>
        <Outlet />
      </main>
      </div>
      <nav className="customer-bottom-nav admin-bottom-nav" aria-label={t("workspace.navigation")}>
        <NavLink to="/admin" end onClick={closeSidebar}><WorkspaceNavIcon type="dashboard"/><span>{tabCopy.home}</span></NavLink>
        <NavLink to="/admin/transactions" onClick={closeSidebar}><WorkspaceNavIcon type="transactions"/><span>{tabCopy.orders}</span></NavLink>
        <NavLink to="/admin/delivery-batches" onClick={closeSidebar}><WorkspaceNavIcon type="delivery"/><span>{tabCopy.delivery}</span></NavLink>
        <button type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>{tabCopy.menu}</span></button>
      </nav>
    </div>
  );
}

export default AdminLayout;
