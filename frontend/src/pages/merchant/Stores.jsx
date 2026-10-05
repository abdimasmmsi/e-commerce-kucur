import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { getStoreManagementPath } from "../../utils/storeScope";
import "./Stores.css";

function Stores() {
  const { stores, loading, error } = useStore();
  const { errorMessage, t } = usePreferences();

  return (
    <div className="page-container stores-page merchant-standard-page">
      <div className="stores-header">
        <div className="stores-header-text">
          <span className="stores-eyebrow">{t("merchantStores.eyebrow")}</span>
          <h1>{t("merchantStores.title")}</h1>
          <p>{t("merchantStores.subtitle")}</p>
        </div>

        <Link className="stores-add-button" to="/merchant/stores/new">
          {t("merchantStores.add")}
        </Link>
      </div>

      {loading ? <LoadingPanel label={t("merchantStores.loading")} rows={3} /> : error ? <section className="card stores-empty-state"><h2>{t("merchantStores.loadFailed")}</h2><p>{errorMessage(error.code, t("merchantStores.loadFailed"))}</p></section> : stores.length > 0 ? (
        <div className="stores-grid">
          {stores.map((store) => (
            <article className="store-card" key={store.id}>
              {store.image && <div className={`store-card-image store-type-${store.type}`}><img src={store.image} alt={store.name} /></div>}

              <div className="store-card-body">
                <div className="store-card-header">
                  <div className="flex min-w-0 items-center gap-3">
                    {!store.image && <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--kucur-green-soft)] text-lg font-extrabold text-[var(--kucur-green-ink)]" aria-hidden="true">{store.name.trim().charAt(0).toUpperCase()}</span>}
                    <h2>{store.name}</h2>
                  </div>
                  <StatusBadge status={store.status} className={`store-status ${store.status}`} />
                </div>

                <p className="store-description">{store.description}</p>
                <Link className="store-manage-button" to={getStoreManagementPath(store)}>
                  {t("merchantStores.manage")} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card stores-empty-state">
          <div aria-hidden="true">+</div>
          <h2>{t("merchantStores.empty")}</h2>
          <p>{t("merchantStores.emptyHint")}</p>
          <Link className="primary-button" to="/merchant/stores/new">{t("merchantStores.addFirst")}</Link>
        </section>
      )}
    </div>
  );
}

export default Stores;
