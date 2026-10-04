import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import RoleSwitcher from "./RoleSwitcher";
import UserAvatar from "./UserAvatar";
import "./LayoutSessionControls.css";

function LayoutSessionControls({ onLogout, showAccountLinks = true, accountSession = false }) {
  const { activeRole, logout, user } = useAuth();
  const { t } = usePreferences();
  const [sessionAction, setSessionAction] = useState("");

  const endSession = async (destination, action) => {
    if (sessionAction) return;
    setSessionAction(action);
    await logout();
    onLogout?.();
    window.location.replace(destination);
  };

  return (
    <section className={`layout-session-controls${accountSession ? " layout-session-controls--account" : ""}`} aria-label={t("sessionPanel.title")}>
      {accountSession ? <>
        <div className="layout-session-heading">
          <i aria-hidden="true" />
          <span className="layout-session-copy">
            <small>{t("sessionPanel.active")}</small>
            <strong title={user?.fullName}>{user?.fullName}</strong>
          </span>
        </div>
        <p title={user?.email}>{user?.email}</p>
        <span className="layout-session-role">{t(`role.${activeRole}`)}</span>
        <div className="layout-session-role-switcher"><RoleSwitcher /></div>
      </> : <div className="layout-session-user">
        <UserAvatar className="layout-session-avatar" size={34} user={user}/>
        <span className="layout-session-copy">
          <strong title={user?.fullName}>{user?.fullName}</strong>
          <small title={user?.email}>{user?.email}</small>
        </span>
      </div>}
      <div className="layout-session-actions">
        {showAccountLinks && <Link to="/profile" onClick={onLogout}>{t("workspace.accountProfile")}</Link>}
        {showAccountLinks && <Link to="/settings" onClick={onLogout}>{t("workspace.settings")}</Link>}
        {accountSession && <button className="layout-switch-account" type="button" disabled={Boolean(sessionAction)} onClick={() => endSession("/login", "switch")}>{sessionAction === "switch" ? t("sessionPanel.switching") : t("sessionPanel.switchAccount")}</button>}
        <button className="layout-logout" type="button" disabled={Boolean(sessionAction)} onClick={() => endSession("/", "logout")}>{sessionAction === "logout" ? t("sessionPanel.signingOut") : t("workspace.logout")}</button>
      </div>
    </section>
  );
}

export default LayoutSessionControls;
