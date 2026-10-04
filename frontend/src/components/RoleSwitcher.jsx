import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { roleHomePaths } from "../utils/authNavigation";
import "./RoleSwitcher.css";

function RoleSwitcher({ label, onSwitched }) {
  const navigate = useNavigate();
  const { activeRole, isAuthenticated, switchRole, user } = useAuth();
  const { t } = usePreferences();

  if (!isAuthenticated || !user || user.roles.length <= 1) return null;

  const handleChange = (event) => {
    const role = event.target.value;
    const result = switchRole(role);
    if (result.success) {
      onSwitched?.(role);
      navigate(roleHomePaths[role] ?? "/");
    }
  };

  return (
    <label className="role-switcher">
      <span>{label ?? t("workspace.switchRole")}</span>
      <select value={activeRole} onChange={handleChange} aria-label={label ?? t("workspace.switchRole")}>
        {user.roles.map((role) => (
          <option key={role} value={role}>
            {t(`role.${role}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default RoleSwitcher;
