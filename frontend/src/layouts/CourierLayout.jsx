import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import WorkspaceNavIcon from "../components/WorkspaceNavIcon";
import { usePreferences } from "../context/PreferencesContext";
import "./CourierLayout.css";
import "../components/CustomerBottomNav.css";
import "../styles/workspace-shell.css";

function CourierLayout() {
  const { language, t } = usePreferences();
  const tabCopy = language === "id" ? { home: "Beranda", deliver: "Antar", history: "Riwayat", menu: "Menu" } : { home: "Home", deliver: "Deliver", history: "History", menu: "Menu" };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }

    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [sidebarOpen]);

  return (
    <div className="courier-workspace">
      <AppHeader accountMode workspaceRole="courier" />
      <div className="courier-layout">
      {sidebarOpen && (
        <button
          className="courier-overlay"
          type="button"
          onClick={closeSidebar}
          aria-label={t("workspace.closeMenu")}
        />
      )}

      <aside
        aria-label={`${t("workspace.navigation")} ${t("workspace.courier")}`}
        className={`courier-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="courier-sidebar-header">
          <h2>{t("workspace.courier")}</h2>

          <button
            className="courier-close-button"
            onClick={closeSidebar}
            type="button"
            aria-label={t("workspace.closeMenu")}
          >
            <span className="workspace-close-icon" aria-hidden="true" />
          </button>
        </div>

        <nav className="courier-nav workspace-nav" aria-label={t("workspace.navigation")}>
          <section className="workspace-nav-group" aria-labelledby="courier-nav-overview">
            <h3 id="courier-nav-overview">{t("workspaceNav.overview")}</h3>
            <NavLink to="/courier" end onClick={closeSidebar}><WorkspaceNavIcon type="dashboard"/><span>{t("workspace.dashboard")}</span></NavLink>
          </section>
          <section className="workspace-nav-group" aria-labelledby="courier-nav-deliveries">
            <h3 id="courier-nav-deliveries">{t("workspaceNav.deliveries")}</h3>
            <NavLink to="/courier/active-deliveries" onClick={closeSidebar}><WorkspaceNavIcon type="delivery"/><span>{t("workspace.activeDeliveries")}</span></NavLink>
            <NavLink to="/courier/assignments" onClick={closeSidebar}><WorkspaceNavIcon type="assignments"/><span>{t("workspace.assignments")}</span></NavLink>
            <NavLink to="/courier/batches" onClick={closeSidebar}><WorkspaceNavIcon type="batches"/><span>{t("workspace.deliveryBatches")}</span></NavLink>
            <NavLink to="/courier/history" onClick={closeSidebar}><WorkspaceNavIcon type="history"/><span>{t("workspace.deliveryHistory")}</span></NavLink>
          </section>
          <section className="workspace-nav-group" aria-labelledby="courier-nav-availability">
            <h3 id="courier-nav-availability">{t("workspaceNav.availability")}</h3>
            <NavLink to="/courier/availability" onClick={closeSidebar}><WorkspaceNavIcon type="availability"/><span>{t("workspace.availability")}</span></NavLink>
          </section>
        </nav>
      </aside>

      <main className="courier-main">
        <div className="courier-mobile-header">
          <button
            className="courier-menu-button"
            onClick={() => setSidebarOpen(true)}
            type="button"
            aria-label={t("workspace.openMenu")}
          >
            <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
          </button>

          <strong>{t("workspace.courier")}</strong>
        </div>

        <Outlet />
      </main>
      </div>
      <nav className="customer-bottom-nav courier-bottom-nav" aria-label={t("workspace.navigation")}>
        <NavLink to="/courier" end onClick={closeSidebar}><WorkspaceNavIcon type="dashboard"/><span>{tabCopy.home}</span></NavLink>
        <NavLink to="/courier/batches" onClick={closeSidebar}><WorkspaceNavIcon type="delivery"/><span>{tabCopy.deliver}</span></NavLink>
        <NavLink to="/courier/history" onClick={closeSidebar}><WorkspaceNavIcon type="history"/><span>{tabCopy.history}</span></NavLink>
        <button type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>{tabCopy.menu}</span></button>
      </nav>
    </div>
  );
}

export default CourierLayout;
