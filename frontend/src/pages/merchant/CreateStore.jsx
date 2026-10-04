import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LocationPicker from "../../components/location/LocationPicker";
import PageHeader from "../../components/ui/PageHeader";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { toStoreApiLocation } from "../../services/locationIntegration";
import { processStoreImage, uploadStoreImage } from "../../services/storeImageService";
import { EMPTY_LOCATION, serializeLocation } from "../../utils/location";
import "./CreateStore.css";

const initialForm = { name: "", phone: "", address: "", location: EMPTY_LOCATION, description: "" };

function CreateStore() {
  const navigate = useNavigate();
  const { createStore } = useStore();
  const { errorMessage, t } = usePreferences();
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProcessingImage(true);
    setImageError("");
    try {
      const blob = await processStoreImage(file);
      setImage(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (cause) {
      const knownErrors = ["STORE_IMAGE_FORMAT", "STORE_IMAGE_SIZE", "STORE_IMAGE_DIMENSION", "STORE_IMAGE_PROCESSED_SIZE", "STORE_IMAGE_PROCESS_FAILED", "STORE_IMAGE_READ_FAILED"];
      setImageError(t(`createStore.imageErrors.${knownErrors.includes(cause.message) ? cause.message : "STORE_IMAGE_PROCESS_FAILED"}`));
    } finally {
      setProcessingImage(false);
    }
  };

  const removeImage = () => {
    setImage(null);
    setPreviewUrl("");
    setImageError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (["name", "phone", "address", "description"].some((field) => !form[field].trim())) {
      setError(t("createStore.required"));
      return;
    }
    const { location: normalizedLocation, error: locationError } = serializeLocation({ ...form.location, label: form.location.label || form.name, address: form.location.address || form.address });
    if (locationError) { setError(locationError); return; }

    setSaving(true);
    setError("");
    try {
      const imageUrl = image ? await uploadStoreImage(image) : "";
      await createStore({
        name: form.name.trim(),
        type: "product",
        description: form.description.trim(),
        location: toStoreApiLocation(normalizedLocation, { label: form.name, address: form.address }),
        phone: form.phone.trim(),
        image: imageUrl,
      });
      navigate("/merchant/stores");
    } catch (cause) {
      setError(errorMessage(cause.code, t("createStore.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return <div className="page-container merchant-standard-page create-store-page">
    <PageHeader eyebrow={t("createStore.eyebrow")} title={t("createStore.title")} description={t("createStore.subtitle")} actions={<Link className="secondary-button" to="/merchant/stores">{t("createStore.back")}</Link>}/>

    <div className="create-store-layout">
      <form className="create-store-form" onSubmit={handleSubmit} noValidate>
        <section className="create-store-section">
          <div className="create-store-section-heading"><h2>{t("createStore.storeInfo")}</h2><p>{t("createStore.storeInfoHint")}</p></div>
          <div className="create-store-grid">
            <label><span>{t("createStore.name")}</span><input required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder={t("createStore.namePlaceholder")}/></label>
            <label><span>{t("createStore.type")}</span><div className="create-store-fixed-type"><i aria-hidden="true">●</i><strong>{t("createStore.ecommerce")}</strong></div></label>
            <label className="create-store-full"><span>{t("createStore.phone")}</span><input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder={t("createStore.phonePlaceholder")}/></label>
            <label className="create-store-full"><span>{t("createStore.address")}</span><textarea required rows="4" value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder={t("createStore.addressPlaceholder")}/></label>
            <LocationPicker value={form.location} onChange={(location) => updateField("location", location)} labelTitle={t("createStore.locationName")} addressTitle={t("createStore.locationAddress")}/>
            <label className="create-store-full"><span>{t("createStore.description")}</span><textarea required rows="5" maxLength="2000" value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder={t("createStore.descriptionPlaceholder")}/><small>{form.description.length}/2000</small></label>
          </div>
        </section>

        <section className="create-store-section create-store-image-section">
          <div className="create-store-section-heading"><h2>{t("createStore.image")}</h2><p>{t("createStore.imageHint")}</p></div>
          <div className="create-store-image-input">
            <div className="create-store-image-preview">{previewUrl ? <img src={previewUrl} alt={t("createStore.imagePreviewAlt")}/> : <span><strong>{t("createStore.noImage")}</strong><small>{t("createStore.optional")}</small></span>}</div>
            <div><label className="create-store-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={processingImage || saving}/><span>{t(processingImage ? "createStore.processingImage" : previewUrl ? "createStore.changeImage" : "createStore.chooseImage")}</span></label>{previewUrl && <button className="create-store-remove-image" type="button" onClick={removeImage} disabled={saving}>{t("createStore.removeImage")}</button>}<p>{t("createStore.cropHint")}</p></div>
          </div>
          {imageError && <p className="create-store-error" role="alert">{imageError}</p>}
        </section>

        {error && <p className="create-store-error" role="alert">{error}</p>}
        <div className="create-store-actions"><Link className="secondary-button" to="/merchant/stores">{t("createStore.cancel")}</Link><button className="primary-button" type="submit" disabled={saving || processingImage}>{t(saving ? "createStore.saving" : "createStore.submit")}</button></div>
      </form>

      <aside className="create-store-card-preview">
        <span>{t("createStore.preview")}</span>
        <div className="create-store-preview-image">{previewUrl ? <img src={previewUrl} alt=""/> : <strong>{t("createStore.ecommerce")}</strong>}</div>
        <div><small>{t("createStore.ecommerce")}</small><h2>{form.name || t("createStore.previewName")}</h2><p>{form.description || t("createStore.previewDescription")}</p></div>
        <strong className="create-store-preview-status">{t("createStore.pendingStatus")}</strong>
      </aside>
    </div>
  </div>;
}

export default CreateStore;
