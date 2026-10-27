import { useEffect, useRef, useState } from "react";
import UserAvatar from "../../components/UserAvatar";
import { blobToDataUrl, drawProfileCrop, exportProfileCrop, inspectProfileImage } from "../../services/profileImageService";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import "./Profile.css";

const initialCrop = { focusX: 50, focusY: 50, zoom: 1 };
const imageErrorKey = (code) => ({
  PROFILE_IMAGE_FORMAT: "account.photoFormatError",
  PROFILE_IMAGE_SIZE: "account.photoSizeError",
  PROFILE_IMAGE_DIMENSION: "account.photoDimensionError",
  PROFILE_IMAGE_PROCESSED_SIZE: "account.photoProcessedSizeError",
}[code] || "account.photoProcessError");

function Profile() {
  const { activeRole, removeAvatar, updateAvatar, updateProfile, user } = useAuth();
  const { t } = usePreferences();
  const previewCanvas = useRef(null);
  const [profile, setProfile] = useState({ fullName: user.fullName, email: user.email, phone: user.phone });
  const [cropSource, setCropSource] = useState(null);
  const [crop, setCrop] = useState(initialCrop);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [state, setState] = useState({ busy: false, message: "", error: "" });

  useEffect(() => {
    if (cropSource) drawProfileCrop(cropSource, previewCanvas.current, crop, 440);
  }, [crop, cropSource]);
  useEffect(() => {
    if (!cropSource && !confirmRemove) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [confirmRemove, cropSource]);
  useEffect(() => () => cropSource?.close(), [cropSource]);
  useEffect(() => {
    if (!cropSource && !confirmRemove && !photoActionsOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (cropSource && !photoBusy) {
        cropSource.close();
        setCropSource(null);
        setCrop(initialCrop);
      } else if (confirmRemove && !state.busy) setConfirmRemove(false);
      else setPhotoActionsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [confirmRemove, cropSource, photoActionsOpen, photoBusy, state.busy]);

  const change = ({ target }) => setProfile((current) => ({ ...current, [target.name]: target.value }));
  const closeCropper = () => {
    cropSource?.close();
    setCropSource(null);
    setCrop(initialCrop);
  };
  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setState((current) => ({ ...current, message: "", error: "" }));
    try {
      cropSource?.close();
      setPhotoActionsOpen(false);
      setCrop(initialCrop);
      setCropSource(await inspectProfileImage(file));
    } catch (error) {
      setState((current) => ({ ...current, error: t(imageErrorKey(error.message)) }));
    } finally {
      setPhotoBusy(false);
    }
  };
  const saveCrop = async () => {
    if (!cropSource || photoBusy) return;
    setPhotoBusy(true);
    setState({ busy: false, message: "", error: "" });
    try {
      const blob = await exportProfileCrop(cropSource, crop);
      const result = await updateAvatar(await blobToDataUrl(blob));
      if (!result.success) throw new Error(result.message || "PROFILE_IMAGE_UPLOAD_FAILED");
      closeCropper();
      setState({ busy: false, message: t("profilePhoto.updated"), error: "" });
    } catch (error) {
      const translated = String(error.message || "").startsWith("PROFILE_IMAGE_") ? t(imageErrorKey(error.message)) : error.message;
      setState({ busy: false, message: "", error: translated || t("account.photoProcessError") });
    } finally {
      setPhotoBusy(false);
    }
  };
  const deletePhoto = async () => {
    setState({ busy: true, message: "", error: "" });
    const result = await removeAvatar();
    setConfirmRemove(false);
    setPhotoActionsOpen(false);
    setState({ busy: false, message: result.success ? t("account.photoRemoved") : "", error: result.success ? "" : result.message });
  };
  const submit = async (event) => {
    event.preventDefault();
    setState({ busy: true, message: "", error: "" });
    const result = await updateProfile(profile);
    setState({ busy: false, message: result.success ? t("account.profileSaved") : "", error: result.success ? "" : result.message });
  };

  const isBusy = state.busy || photoBusy;
  return <div className="page-container account-profile-page account-profile-only">
    <header className="account-profile-heading page-head"><div><span className="page-head__eyebrow">{t("account.eyebrow")}</span><h1 className="page-head__title">{t("header.profile")}</h1><p className="page-head__desc">{t("account.personalHint")}</p></div></header>
    <section className="account-section account-identity-section">
      <div className="account-avatar-control">
        <UserAvatar className="account-profile-avatar" size={92} user={user} decorative={false}/>
        <div className="account-avatar-hover-actions" aria-label={t("profilePhoto.actions")}>
          <label className="account-avatar-action" title={user.avatarUrl ? t("account.changePhoto") : t("account.addPhoto")}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={isBusy} aria-label={user.avatarUrl ? t("account.changePhoto") : t("account.addPhoto")}/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.2"/></svg></label>
          {user.avatarUrl && <button className="account-avatar-action danger" type="button" onClick={() => setConfirmRemove(true)} disabled={isBusy} title={t("account.removePhoto")} aria-label={t("account.removePhoto")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
        </div>
        <button className="account-avatar-mobile-trigger" type="button" onClick={() => setPhotoActionsOpen((current) => !current)} aria-label={t("profilePhoto.actions")} aria-expanded={photoActionsOpen}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.2"/></svg></button>
        {photoActionsOpen && <div className="account-avatar-mobile-menu">
          <label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={isBusy}/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.2"/></svg><span>{user.avatarUrl ? t("account.changePhoto") : t("account.addPhoto")}</span></label>
          {user.avatarUrl && <button type="button" onClick={() => { setConfirmRemove(true); setPhotoActionsOpen(false); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 7l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t("account.removePhoto")}</span></button>}
        </div>}
      </div>
      <div className="account-identity-copy"><h2>{user.fullName}</h2><p>{user.email}</p><div className="account-role-list">{user.roles.map((role) => <strong className={role === activeRole ? "active" : ""} key={role}>{t(`role.${role}`)}</strong>)}</div></div>
    </section>
    <section className="account-section account-settings-panel account-profile-only"><header className="account-panel-heading"><div><h2>{t("account.personalInfo")}</h2><p>{t("account.personalHint")}</p></div></header><form className="account-form" onSubmit={submit}><label>{t("auth.fullName")}<input name="fullName" value={profile.fullName} onChange={change} maxLength="120" required/></label><label>{t("auth.email")}<input name="email" type="email" value={profile.email} onChange={change} maxLength="254" required/></label><label>{t("auth.phone")}<input name="phone" value={profile.phone} onChange={change} maxLength="20" required/></label>{(state.error || state.message) && <p className={state.error ? "account-feedback error" : "account-feedback success"} role="status">{state.error || state.message}</p>}<div className="account-form-actions"><button className="primary-button" disabled={isBusy}>{state.busy ? t("account.saving") : t("account.saveProfile")}</button></div></form></section>
    {cropSource && <div className="account-photo-modal" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !photoBusy) closeCropper(); }}>
      <section>
        <header><div><span>{t("profilePhoto.eyebrow")}</span><h2 id="profile-photo-title">{t("profilePhoto.title")}</h2><p>{t("profilePhoto.hint")}</p></div><button type="button" onClick={closeCropper} disabled={photoBusy} aria-label={t("common.close")}>{"\u00D7"}</button></header>
        <div className="account-crop-stage"><div className="account-crop-preview"><canvas ref={previewCanvas}/></div><small>{t("profilePhoto.previewHint")}</small></div>
        <div className="account-crop-controls">
          <label><span>{t("profilePhoto.horizontal")}</span><input type="range" min="0" max="100" value={crop.focusX} onChange={(event) => setCrop((current) => ({ ...current, focusX: Number(event.target.value) }))}/></label>
          <label><span>{t("profilePhoto.vertical")}</span><input type="range" min="0" max="100" value={crop.focusY} onChange={(event) => setCrop((current) => ({ ...current, focusY: Number(event.target.value) }))}/></label>
          <label><span>{t("profilePhoto.zoom")}</span><input type="range" min="1" max="2.5" step=".05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}/></label>
        </div>
        <p className="account-photo-constraints">{t("account.photoHint")}</p>
        <footer><button type="button" onClick={closeCropper} disabled={photoBusy}>{t("account.cancelPhoto")}</button><button className="primary-button" type="button" onClick={saveCrop} disabled={photoBusy}>{photoBusy ? t("profilePhoto.saving") : t("profilePhoto.use")}</button></footer>
      </section>
    </div>}
    {confirmRemove && <div className="account-photo-modal account-photo-remove-modal" role="alertdialog" aria-modal="true" aria-labelledby="remove-photo-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !state.busy) setConfirmRemove(false); }}><section><header><div><span>{t("profilePhoto.eyebrow")}</span><h2 id="remove-photo-title">{t("profilePhoto.removeTitle")}</h2><p>{t("profilePhoto.removeHint")}</p></div></header><footer><button type="button" onClick={() => setConfirmRemove(false)} disabled={state.busy}>{t("account.cancelPhoto")}</button><button className="account-confirm-remove" type="button" onClick={deletePhoto} disabled={state.busy}>{state.busy ? t("profilePhoto.saving") : t("profilePhoto.confirmRemove")}</button></footer></section></div>}
  </div>;
}
export default Profile;
