import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import {
  getStoreManagementPath,
  storeTypeLabels,
} from "../../utils/storeScope";
import "./Stores.css";

function StoreFallback() {
  return (
    <span className="store-card-fallback" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 10v9h16v-9M3 10l2-5h14l2 5" />
        <path d="M3 10a3 3 0 0 0 5 0 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5 0M9 19v-5h6v5" />
      </svg>
    </span>
  );
}

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
              <div className={`store-card-image store-type-${store.type}`}>
                {store.image ? <img src={store.image} alt={store.name} /> : <StoreFallback />}
              </div>

              <div className="store-card-body">
                <div className="store-card-header">
                  <div>
                    <span className="store-type-label">{store.type === "product" ? t("createStore.ecommerce") : (storeTypeLabels[store.type] ?? store.type)}</span>
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
