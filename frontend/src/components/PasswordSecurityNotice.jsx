import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import "./PasswordSecurityNotice.css";

export default function PasswordSecurityNotice() {
  const { user } = useAuth();
  const { formatDate, t } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissedFor, setDismissedFor] = useState(null);
  const security = user?.passwordSecurity;
  const required = Boolean(security?.resetRequired);
  const recommended = Boolean(security?.rotationRecommended);

  if (!user || (!required && !recommended) || location.pathname === "/settings" || (!required && dismissedFor === user.id)) return null;

  return <div className="password-security-backdrop" role="presentation">
    <section className="password-security-notice" role="alertdialog" aria-modal="true" aria-labelledby="password-security-title">
      <span className="password-security-icon" aria-hidden="true">!</span>
      <div>
        <span className="password-security-eyebrow">{t("passwordSecurity.eyebrow")}</span>
        <h2 id="password-security-title">{t(required ? "passwordSecurity.resetTitle" : "passwordSecurity.rotationTitle")}</h2>
        <p>{t(required ? "passwordSecurity.resetDescription" : "passwordSecurity.rotationDescription")}</p>
        {security.changedAt && <small>{t("passwordSecurity.lastChanged", { date: formatDate(security.changedAt) })}</small>}
      </div>
      <div className="password-security-actions">
        {!required && <button type="button" onClick={() => setDismissedFor(user.id)}>{t("passwordSecurity.later")}</button>}
        <button className="primary-button" type="button" onClick={() => navigate("/settings?section=security")}>{t("passwordSecurity.changeNow")}</button>
      </div>
    </section>
  </div>;
}
