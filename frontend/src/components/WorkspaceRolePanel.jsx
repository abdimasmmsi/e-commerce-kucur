import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import RoleSwitcher from "./RoleSwitcher";
import "./WorkspaceRolePanel.css";

function WorkspaceRolePanel() {
  const { activeRole } = useAuth();
  const { t } = usePreferences();

  return (
    <section className="workspace-role-panel" aria-label={t("workspace.activeRole")}>
      <div className="workspace-role-current">
        <span>{t("workspace.activeRole")}</span>
        <strong>{t(`role.${activeRole}`)}</strong>
      </div>
      <RoleSwitcher />
    </section>
  );
}

export default WorkspaceRolePanel;
