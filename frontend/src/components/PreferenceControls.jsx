import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "../context/PreferencesContext";
import "./PreferenceControls.css";

function PreferenceControls({ compact = false, detailed = false, onLanguageChange, onThemeChange, showLanguage = true, showTheme = true }) {
  const { language, setLanguage, setTheme, t, theme } = usePreferences();
  const [switching, setSwitching] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const transitionTo = (value, current, action) => {
    if (switching || value === current) return;
    setSwitching(true);
    timers.current.push(window.setTimeout(() => action(value), 140));
    timers.current.push(window.setTimeout(() => setSwitching(false), 520));
  };
  const chooseLanguage = (value) => transitionTo(value, language, onLanguageChange ?? setLanguage);
  const chooseTheme = (value) => transitionTo(value, theme, onThemeChange ?? setTheme);
  return <>
    <div className={`preference-controls ${compact ? "compact" : ""} ${detailed ? "detailed" : ""}`} aria-busy={switching}>
      {showLanguage && <div className="language-slider" role="group" aria-label={t("common.language")}><i className={language === "en" ? "is-en" : ""} aria-hidden="true"/><button type="button" disabled={switching} className={language === "id" ? "active" : ""} onClick={() => chooseLanguage("id")} aria-pressed={language === "id"}>ID</button><button type="button" disabled={switching} className={language === "en" ? "active" : ""} onClick={() => chooseLanguage("en")} aria-pressed={language === "en"}>EN</button></div>}
      {showTheme && (detailed ? <div className="theme-segments" role="group" aria-label={t("account.theme")}><button type="button" disabled={switching} className={theme === "light" ? "active" : ""} onClick={() => chooseTheme("light")} aria-pressed={theme === "light"}>{t("common.lightMode")}</button><button type="button" disabled={switching} className={theme === "dark" ? "active" : ""} onClick={() => chooseTheme("dark")} aria-pressed={theme === "dark"}>{t("common.darkMode")}</button></div> : <button className="theme-toggle" type="button" disabled={switching} onClick={() => chooseTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? t("common.lightMode") : t("common.darkMode")} aria-label={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}>
        {theme === "dark" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20.5 15.1A8.5 8.5 0 0 1 8.9 3.5 8.5 8.5 0 1 0 20.5 15.1Z"/></svg>}
      </button>)}
    </div>
    {switching && createPortal(<div className="preference-transition-overlay" role="status" aria-live="polite"><span className="preference-transition-spinner" aria-hidden="true"/><strong>{t("common.applyingPreferences")}</strong></div>, document.body)}
  </>;
}
export default PreferenceControls;
