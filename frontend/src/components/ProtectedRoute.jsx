import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { activeRole, initialized, isAuthenticated, switchRole, user } = useAuth();
  const { t } = usePreferences();

  const accountHasAllowedRole = !allowedRoles?.length
    || allowedRoles.some((role) => user?.roles.includes(role));
  const roleToActivate = initialized && isAuthenticated && accountHasAllowedRole
    && allowedRoles?.length && !allowedRoles.includes(activeRole)
    ? allowedRoles.find((role) => user.roles.includes(role))
    : null;

  useEffect(() => {
    if (roleToActivate) switchRole(roleToActivate);
  }, [roleToActivate, switchRole]);

  if (!initialized) return <div className="page-container" role="status">{t("auth.checking")}</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!accountHasAllowedRole) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ from: location.pathname, allowedRoles: allowedRoles ?? [] }}
      />
    );
  }

  if (roleToActivate) {
    return <div className="page-container" role="status">{t("auth.checking")}</div>;
  }

  return children;
}

export default ProtectedRoute;
