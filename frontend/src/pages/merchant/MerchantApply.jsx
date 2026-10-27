import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import LocationPicker from "../../components/location/LocationPicker";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { toStoreApiLocation } from "../../services/locationIntegration";
import { storeService } from "../../services/storeService";
import { EMPTY_LOCATION, serializeLocation } from "../../utils/location";
import "./MerchantApply.css";
import "./MerchantApplyLifecycle.css";

const emptyForm = (user) => ({
  businessName: "",
  phone: user.phone ?? "",
  address: "",
  location: EMPTY_LOCATION,
  description: "",
});

function MerchantApply() {
  const { hasRole, user } = useAuth();
  const { errorMessage, formatDate, language, statusLabel, t } = usePreferences();
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(() => emptyForm(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const copy = language === "id"
    ? { loadFailed: "Riwayat pengajuan belum dapat dimuat.", saveFailed: "Pengajuan belum dapat dikirim.", locationName: "Nama lokasi lapak", locationAddress: "Alamat atau petunjuk lokasi" }
    : { loadFailed: "Application history could not be loaded.", saveFailed: "The application could not be submitted.", locationName: "Store location name", locationAddress: "Location address or directions" };

  useEffect(() => {
    let active = true;
    storeService.list()
      .then((rows) => { if (active) setApplications(rows); })
      .catch((cause) => { if (active) setError(errorMessage(cause.code, copy.loadFailed)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.loadFailed, errorMessage]);

  const userApplications = useMemo(() => [...applications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [applications]);
  const pendingApplication = userApplications.find((application) => application.approvalStatus === "PENDING");
  const approvedApplication = userApplications.find((application) => application.approvalStatus === "APPROVED");
  const latestRejectedApplication = userApplications.find((application) => application.approvalStatus === "REJECTED");
  const displayDate = (value) => formatDate(value, { dateStyle: "medium", timeStyle: "short" });
  const applicationStatus = (application) => String(application.approvalStatus || "PENDING").toUpperCase();

  if (hasRole("merchant")) return <Navigate to="/merchant" replace />;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (["businessName", "phone", "address", "description"].some((field) => !form[field].trim())) {
      setError(t("merchantApply.required"));
      return;
    }
    const { location, error: locationError } = serializeLocation({
      ...form.location,
      label: form.location.label || form.businessName,
      address: form.location.address || form.address,
    });
    if (locationError) { setError(locationError); return; }

    setSaving(true);
    setError("");
    try {
      const created = await storeService.create({
        name: form.businessName.trim(),
        type: "product",
        description: form.description.trim(),
        phone: form.phone.trim(),
        location: toStoreApiLocation(location, { label: form.businessName, address: form.address }),
      });
      setApplications((current) => [created, ...current]);
    } catch (cause) {
      setError(errorMessage(cause.code, copy.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  return <div className="page-container customer-page merchant-apply-page">
    <header className="account-profile-heading page-head"><div><span className="page-head__eyebrow">{t("account.eyebrow")}</span><h1 className="page-head__title">{t("merchantApply.title")}</h1><p className="page-head__desc">{t("merchantApply.subtitle")}</p></div></header>
    <ol className="merchant-apply-progress" aria-label={t("merchantApply.process")}><li className="active"><span>1</span>{t("merchantApply.stepData")}</li><li><span>2</span>{t("merchantApply.stepReview")}</li><li><span>3</span>{t("merchantApply.stepDecision")}</li></ol>

    {pendingApplication && <section className="card merchant-application-status pending"><div><span>{t("merchantApply.applicationStatus")}</span><strong>{statusLabel("PENDING")}</strong></div><p>{t("merchantApply.pendingHint", { name: pendingApplication.name, count: 1 })}</p><small>{t("merchantApply.sentOn")} {displayDate(pendingApplication.createdAt)} · {pendingApplication.id}</small></section>}
    {!pendingApplication && approvedApplication && <section className="card merchant-application-status approved"><div><span>{t("merchantApply.applicationStatus")}</span><strong>{statusLabel("APPROVED")}</strong></div><p>{t("merchantApply.approvedHint")}</p></section>}
    {!pendingApplication && !approvedApplication && latestRejectedApplication && <section className="card merchant-application-status rejected"><div><span>{t("merchantApply.previous")}</span><strong>{statusLabel("REJECTED")}</strong></div><p><strong>{t("merchantApply.reason")}:</strong> {latestRejectedApplication.rejectionReason}</p><small>{t("merchantApply.retryHint")}</small></section>}

    {!loading && !pendingApplication && !approvedApplication && <form className="card merchant-apply-form" onSubmit={handleSubmit} noValidate>
      <header className="merchant-form-heading"><h2>{t("merchantApply.formTitle")}</h2><p>{t("merchantApply.formHint")}</p></header>
      <fieldset className="merchant-form-section"><legend>{t("merchantApply.businessSection")}</legend><div className="merchant-apply-grid"><label><span>{t("merchantApply.businessName")}</span><input required value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} placeholder={t("merchantApply.businessPlaceholder")} /></label><label><span>{t("merchantApply.phone")}</span><input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} /></label><label className="merchant-field-full"><span>{t("merchantApply.businessType")}</span><input value={t("merchantApply.ecommerce")} readOnly /></label><label className="merchant-field-full"><span>{t("merchantApply.address")}</span><textarea required rows="3" value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder={t("merchantApply.addressPlaceholder")} /></label><LocationPicker value={form.location} onChange={(location) => updateField("location", location)} labelTitle={copy.locationName} addressTitle={copy.locationAddress} /><label className="merchant-field-full"><span>{t("merchantApply.description")}</span><textarea required rows="5" maxLength="2000" value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder={t("merchantApply.descriptionPlaceholder")} /></label></div></fieldset>
      {error && <p className="merchant-apply-error" role="alert">{error}</p>}<div className="merchant-apply-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? t("createStore.saving") : t("merchantApply.submit")}</button></div>
    </form>}

    <section className="card merchant-application-history"><div className="merchant-form-heading"><h2>{t("merchantApply.historyTitle")}</h2><p>{t("merchantApply.historyHint")}</p></div>{loading ? <p className="merchant-application-history-empty" role="status">{t("common.loading")}</p> : <div className="merchant-application-history-list">{userApplications.map((application) => { const status = applicationStatus(application); return <article key={application.id}><div><strong>{application.name}</strong><span className={`merchant-history-status ${status.toLowerCase()}`}>{statusLabel(status)}</span></div><p>{t("merchantApply.ecommerce")}</p><small>{t("merchantApply.sentOn")} {displayDate(application.createdAt)} · {application.id}</small>{application.reviewedAt && <small>{t("merchantApply.reviewedOn")} {displayDate(application.reviewedAt)}</small>}{application.rejectionReason && <p className="merchant-history-reason">{t("merchantApply.reason")}: {application.rejectionReason}</p>}</article>; })}</div>}{!loading && !userApplications.length && <p className="merchant-application-history-empty">{t("merchantApply.emptyHistory")}</p>}</section>
  </div>;
}

export default MerchantApply;
