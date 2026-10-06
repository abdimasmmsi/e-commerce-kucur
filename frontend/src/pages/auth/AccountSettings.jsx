import { useState } from "react";
import PreferenceControls from "../../components/PreferenceControls";
import PushToggle from "../../components/PushToggle";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import "./Profile.css";

export default function AccountSettings() {
  const { changePassword, updatePreferences, verifyCurrentPassword, user } = useAuth();
  const { language, setLanguage, setTheme, t, theme } = usePreferences();
  const { activeStore, activeStoreId, setActiveStore, setStoreAvailability, stores } = useStore();
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordState, setPasswordState] = useState({ busy: false, message: "", error: "" });
  const [preferenceStatus, setPreferenceStatus] = useState("");
  const [storeState, setStoreState] = useState({ busy: false, message: "", error: "" });
  const savePreference = async (nextLanguage, nextTheme) => { setPreferenceStatus("saving"); const result = await updatePreferences({ language: nextLanguage, theme: nextTheme }); setPreferenceStatus(result.success ? "saved" : result.message || "error"); };
  const chooseLanguage = (value) => { setLanguage(value); void savePreference(value, theme); };
  const chooseTheme = (value) => { setTheme(value); void savePreference(language, value); };
  const changeField = ({ target }) => setPassword((currentValue) => ({ ...currentValue, [target.name]: target.value }));
  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordState({ busy: true, message: "", error: "" });
    const verification = await verifyCurrentPassword(password.currentPassword);
    if (!verification.success) return setPasswordState({ busy: false, message: "", error: verification.message });
    if (password.newPassword.length < 8) return setPasswordState({ busy: false, message: "", error: t("account.passwordMinimum") });
    if (password.newPassword !== password.confirmPassword) return setPasswordState({ busy: false, message: "", error: t("account.passwordMismatch") });
    const result = await changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword });
    setPasswordState({ busy: false, message: result.success ? t("account.passwordSaved") : "", error: result.success ? "" : result.message });
    if (result.success) setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };
  const toggleStoreAvailability = async () => {
    if (!activeStore || storeState.busy) return;
    const acceptingOrders = String(activeStore.status).toLowerCase() === "inactive";
    setStoreState({ busy: true, message: "", error: "" });
    try {
      await setStoreAvailability(activeStore.id, acceptingOrders);
      setStoreState({ busy: false, message: t(acceptingOrders ? "merchantSettings.storeOpened" : "merchantSettings.storeClosed"), error: "" });
    } catch (error) {
      setStoreState({ busy: false, message: "", error: error.message });
    }
  };

  return <div className="page-container account-profile-page account-profile-only">
    <header className="account-profile-heading"><div><span>{t("account.eyebrow")}</span><h1>{t("header.settings")}</h1><p>{t("account.description")}</p></div></header>
    <div className="account-settings-stack">
      <section className="account-settings-panel"><header className="account-panel-heading"><div><h2>{t("account.preferences")}</h2><p>{t("account.preferencesHint")}</p></div></header>
        <div className="account-preference-list"><div className="account-preference-row"><div><strong>{t("common.language")}</strong><small>{t("accountSettings.languageDescription")}</small></div><PreferenceControls detailed showTheme={false} onLanguageChange={chooseLanguage}/></div><div className="account-preference-row"><div><strong>{t("account.theme")}</strong><small>{t("accountSettings.themeDescription")}</small></div><PreferenceControls detailed showLanguage={false} onThemeChange={chooseTheme}/></div><PushToggle/>{preferenceStatus && <p className="account-feedback" role="status">{preferenceStatus === "saving" ? t("account.saving") : preferenceStatus === "saved" ? t("account.preferencesSaved") : preferenceStatus}</p>}</div>
      </section>
      <section className="account-settings-panel"><header className="account-panel-heading"><div><h2>{t("account.security")}</h2><p>{t("account.securityHint")}</p></div></header>
        <form className="account-form" onSubmit={submitPassword}><label>{t("account.currentPassword")}<input name="currentPassword" type="password" value={password.currentPassword} onChange={changeField} autoComplete="current-password" required/></label><label>{t("account.newPassword")}<input name="newPassword" type="password" value={password.newPassword} onChange={changeField} minLength="8" autoComplete="new-password" required/><small>{t("account.passwordMinimum")}</small></label><label>{t("auth.confirmPassword")}<input name="confirmPassword" type="password" value={password.confirmPassword} onChange={changeField} minLength="8" autoComplete="new-password" required/></label>{(passwordState.error || passwordState.message) && <p className={passwordState.error ? "account-feedback error" : "account-feedback success"} role="status">{passwordState.error || passwordState.message}</p>}<div className="account-form-actions"><button className="primary-button" disabled={passwordState.busy}>{passwordState.busy ? t("account.saving") : t("account.changePassword")}</button></div></form>
      </section>
      {user.roles.includes("merchant") && <section className="account-settings-panel"><header className="account-panel-heading"><div><h2>{t("merchantSettings.storeOperations")}</h2><p>{t("merchantSettings.storeOperationsHint")}</p></div></header>
        <div className="account-store-settings"><label><strong>{t("merchantSettings.activeStore")}</strong><small>{t("merchantSettings.selectStoreHint")}</small><select value={activeStoreId === "all" ? "" : activeStoreId ?? ""} onChange={(event) => { setActiveStore(event.target.value); setStoreState({ busy: false, message: "", error: "" }); }}><option value="" disabled>{t("merchantSettings.selectStoreHint")}</option>{stores.map((store) => <option value={store.id} key={store.id}>{store.name}</option>)}</select></label>{activeStore && <div className="account-store-availability"><div><span>{t("merchantSettings.orderAcceptance")}</span><strong>{activeStore.name}</strong><small>{t(String(activeStore.status).toLowerCase() === "active" ? "merchantSettings.acceptingOrdersHint" : "merchantSettings.closedHint")}</small></div><StatusBadge status={activeStore.status}/><button className={String(activeStore.status).toLowerCase() === "active" ? "secondary-button account-store-close" : "primary-button"} type="button" disabled={storeState.busy || !["active", "inactive"].includes(String(activeStore.status).toLowerCase())} onClick={toggleStoreAvailability}>{storeState.busy ? t("account.saving") : t(String(activeStore.status).toLowerCase() === "active" ? "merchantSettings.closeStore" : "merchantSettings.openStore")}</button></div>}{(storeState.error || storeState.message) && <p className={storeState.error ? "account-feedback error" : "account-feedback success"} role="status">{storeState.error || storeState.message}</p>}</div>
      </section>}
    </div>
  </div>;
}
