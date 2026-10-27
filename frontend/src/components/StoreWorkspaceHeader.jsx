import { storeTypeLabels } from "../utils/storeScope";
import { usePreferences } from "../context/PreferencesContext";
import "./StoreWorkspaceHeader.css";

function StoreWorkspaceHeader({ store, storeCount = 0, loading = false }) {
  const { statusLabel, t } = usePreferences();
  // Tanpa lapak terpilih (mode Semua Lapak / belum punya lapak) bar tetap tampil supaya judul halaman selalu di posisi yang sama.
  if (!store) {
    return (
      <section className="store-workspace-header" aria-label={t("workspace.activeStore")}>
        <div className="store-workspace-header__identity">
          <span className="store-workspace-header__eyebrow">{t("workspace.storeWorkspace")}</span>
          <strong>{loading ? " " : t(storeCount > 0 ? "workspace.allStores" : "workspace.noStore")}</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="store-workspace-header" aria-label={t("workspace.activeStore")}>
      <div className="store-workspace-header__identity">
        <span className="store-workspace-header__eyebrow">{t("workspace.storeWorkspace")}</span>
        <strong title={store.name}>{store.name}</strong>
      </div>
      <div className="store-workspace-header__meta">
        <span>{storeTypeLabels[store.type] ?? store.type}</span>
        <span aria-hidden="true">{"\u00B7"}</span>
        <span className={`store-workspace-header__status is-${store.status}`}>
          {statusLabel(store.status)}
        </span>
      </div>
    </section>
  );
}

export default StoreWorkspaceHeader;
