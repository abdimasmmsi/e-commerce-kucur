import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import "./WorkspaceLogout.css";

// Tombol Keluar di dasar sidebar/menu laci semua panel (Penjual, Kurir, Admin). Sesi dicabut lewat AuthContext lalu kembali ke beranda/Masuk.
export default function WorkspaceLogout() {
  const { logout } = useAuth();
  const { t } = usePreferences();
  const handleLogout = async () => { await logout(); window.location.replace("/"); };
  return <div className="workspace-logout-wrap">
    <button className="workspace-logout" type="button" onClick={handleLogout} data-no-busy title={t("header.logout")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>
      <span>{t("header.logout")}</span>
    </button>
  </div>;
}
