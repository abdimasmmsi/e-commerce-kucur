import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LocationPicker from "../../components/location/LocationPicker";
import PageHeader from "../../components/ui/PageHeader";
import LoadingPanel from "../../components/ui/LoadingPanel";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { toStoreApiLocation } from "../../services/locationIntegration";
import { normalizeLocation, validateLocationCoordinates } from "../../utils/location";
import { useLiveRefresh } from "../../utils/liveRefresh";
import "./StoreDetail.css";

function StoreDetail() {
  const { storeId } = useParams();
  const { errorMessage, formatDate, t } = usePreferences();
  const { getStore, updateStore } = useStore();
  const [store, setStore] = useState(null);
  const [loadedStoreId, setLoadedStoreId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [location, setLocation] = useState(() => normalizeLocation(null));
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const value = await getStore(storeId);
      setStore(value);
      setLocation(normalizeLocation(value.location, { label: value.name, address: value.location?.address }));
    } catch (cause) {
      setLoadError(errorMessage(cause.code, t("storeDetail.loadFailed")));
    } finally {
      setLoadedStoreId(storeId);
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getStore(storeId)
      .then((value) => {
        if (!active) return;
        setStore(value);
        setLocation(normalizeLocation(value.location, { label: value.name, address: value.location?.address }));
        setLoadError("");
      })
      .catch((cause) => { if (active) setLoadError(errorMessage(cause.code, t("storeDetail.loadFailed"))); })
      .finally(() => { if (active) { setLoadedStoreId(storeId); setLoading(false); } });
    return () => { active = false; };
  }, [errorMessage, getStore, storeId, t]);

  const isLoading = loading || loadedStoreId !== storeId;
  // Muat ulang diam-diam: hanya data lapak (status, dsb.); titik lokasi yang sedang diubah di peta tidak ditimpa.
  useLiveRefresh(() => getStore(storeId).then(setStore), { enabled: !isLoading && !saving });
  const saveLocation = async () => {
    const validationError = validateLocationCoordinates(location);
    if (validationError) { setFeedback({ type: "error", text: validationError }); return; }
    const canonical = toStoreApiLocation(location, { label: store.name, address: store.location?.address });
    setSaving(true);
    setFeedback({ type: "", text: "" });
    try {
      const updated = await updateStore(store.id, { location: canonical });
      setStore(updated);
      setLocation(normalizeLocation(updated.location, { label: updated.name, address: updated.location?.address }));
      setFeedback({ type: "success", text: t("storeDetail.locationSaved") });
    } catch (cause) {
      setFeedback({ type: "error", text: errorMessage(cause.code, t("storeDetail.locationSaveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="page-container merchant-standard-page store-detail-page"><PageHeader eyebrow={t("storeDetail.eyebrow")} title={t("storeDetail.loading")} description={t("storeDetail.loadingHint")}/><LoadingPanel label={t("storeDetail.loading")} rows={4} /></div>;

  if (loadError || !store) return <div className="page-container merchant-standard-page store-detail-page"><PageHeader eyebrow={t("storeDetail.eyebrow")} title={t("storeDetail.unavailable")} description={t("storeDetail.unavailableHint")}/><section className="store-detail-error" role="alert"><div><strong>{t("storeDetail.loadFailed")}</strong>{loadError && <p>{loadError}</p>}</div><div><button type="button" onClick={load}>{t("storeDetail.retry")}</button><Link to="/merchant/stores">{t("storeDetail.back")}</Link></div></section></div>;

  const base = `/merchant/stores/${store.id}`;
  const actions = [
    ["products", `${base}/products`, "01"],
    ["orders", `${base}/orders`, "02"],
    ["stock", `${base}/stock`, "03"],
    ["finance", `${base}/finance`, "04"],
    ["operations", "/settings", "05"],
  ];
  const address = store.location?.address || store.address || t("storeDetail.unavailableValue");
  const information = [
    [t("storeDetail.name"), store.name],
    [t("storeDetail.type"), t("storeDetail.ecommerce")],
    [t("storeDetail.status"), <StatusBadge status={store.status} key="status"/>],
    [t("storeDetail.phone"), store.phone || t("storeDetail.unavailableValue")],
    [t("storeDetail.address"), address],
    [t("storeDetail.created"), store.createdAt ? formatDate(store.createdAt, { dateStyle: "long" }) : t("storeDetail.unavailableValue")],
    [t("storeDetail.description"), store.description || t("storeDetail.unavailableValue")],
  ];

  return <div className="page-container merchant-standard-page store-detail-page">
    <PageHeader eyebrow={t("storeDetail.eyebrow")} title={store.name} description={t("storeDetail.subtitle")} actions={<Link className="secondary-button" to="/merchant/stores">{t("storeDetail.back")}</Link>}/>

    <div className="store-detail-overview">
      <div className="store-detail-cover">{store.image ? <img src={store.image} alt={t("storeDetail.imageAlt", { store: store.name })}/> : <span>{store.name.slice(0, 1).toUpperCase()}</span>}</div>
      <div><span>{t("storeDetail.ecommerce")}</span><h2>{store.name}</h2><p>{store.description || t("storeDetail.unavailableValue")}</p></div>
      <StatusBadge status={store.status}/>
    </div>

    <div className="store-detail-grid">
      <div className="store-detail-main">
        <section className="store-detail-card">
          <header><h2>{t("storeDetail.generalInfo")}</h2><p>{t("storeDetail.generalInfoHint")}</p></header>
          <dl>{information.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>

        <section className="store-detail-card store-detail-location">
          <header><h2>{t("storeDetail.location")}</h2><p>{t("storeDetail.locationHint")}</p></header>
          <LocationPicker value={location} onChange={(value) => { setLocation(value); setFeedback({ type: "", text: "" }); }} labelTitle={t("storeDetail.locationName")} addressTitle={t("storeDetail.locationAddress")}/>
          {feedback.text && <p className={`store-detail-feedback is-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}
          <div className="store-detail-location-actions"><button type="button" onClick={saveLocation} disabled={saving}>{t(saving ? "storeDetail.saving" : "storeDetail.saveLocation")}</button></div>
        </section>
      </div>

      <aside className="store-detail-card store-detail-actions">
        <header><h2>{t("storeDetail.quickActions")}</h2><p>{t("storeDetail.quickActionsHint")}</p></header>
        <nav aria-label={t("storeDetail.quickActions")}>{actions.map(([key, path, number]) => <Link to={path} key={key}><span>{number}</span><div><strong>{t(`storeDetail.actions.${key}`)}</strong><small>{t(`storeDetail.actionHints.${key}`)}</small></div><i aria-hidden="true">{"\u2192"}</i></Link>)}</nav>
      </aside>
    </div>
  </div>;
}

export default StoreDetail;
