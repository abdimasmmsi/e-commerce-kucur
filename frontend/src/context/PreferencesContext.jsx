import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import id from "../i18n/locales/id";
import en from "../i18n/locales/en";

const LANGUAGE_KEY = "kucur_language";
const THEME_KEY = "kucur_theme";
const resources = { id, en };
const PreferencesContext = createContext(null);
const storedLanguage = () => localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "id";
const storedTheme = () => localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";

const resolveKey = (resource, key) => key.split(".").reduce((value, part) => value?.[part], resource);

export function PreferencesProvider({ children }) {
  const [language, setLanguageState] = useState(storedLanguage);
  const [theme, setThemeState] = useState(storedTheme);
  const setLanguage = useCallback((next) => {
    const value = next === "en" ? "en" : "id";
    localStorage.setItem(LANGUAGE_KEY, value); setLanguageState(value);
  }, []);
  const setTheme = useCallback((next) => {
    const value = next === "dark" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, value); setThemeState(value);
  }, []);
  const applyCanonicalPreferences = useCallback((preferences) => {
    if (!preferences) return;
    const nextLanguage = preferences.language === "en" ? "en" : "id";
    const nextTheme = preferences.theme === "dark" ? "dark" : "light";
    localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    localStorage.setItem(THEME_KEY, nextTheme);
    setLanguageState(nextLanguage);
    setThemeState(nextTheme);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [language, theme]);
  useEffect(() => {
    const sync = (event) => {
    if (event.key === LANGUAGE_KEY) setLanguageState(event.newValue === "en" ? "en" : "id");
      if (event.key === THEME_KEY) setThemeState(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const t = useCallback((key, variables = {}) => String(resolveKey(resources[language], key) ?? resolveKey(resources.id, key) ?? key).replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`), [language]);
  const locale = language === "en" ? "en-US" : "id-ID";
  const formatDate = useCallback((value, options = { dateStyle: "medium" }) => new Intl.DateTimeFormat(locale, options).format(new Date(value)), [locale]);
  const formatCurrency = useCallback((value) => new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value), [locale]);
  const formatNumber = useCallback((value, options) => new Intl.NumberFormat(locale, options).format(value), [locale]);
  const statusLabel = useCallback((status) => {
    const raw = String(status ?? "");
    const normalized = raw.toLowerCase().replace(/[_-]+(.)/g, (_, character) => character.toUpperCase());
    const key = `status.${normalized}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const extraKey = `statusExtra.${normalized}`;
    const extra = t(extraKey);
    return extra === extraKey ? raw.replaceAll("_", " ").replaceAll("-", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase()) : extra;
  }, [t]);
  const notificationTypeLabel = useCallback((type) => {
    const raw = String(type ?? "");
    const key = `notificationTypes.${raw}`;
    const translated = t(key);
    return translated === key ? statusLabel(raw) : translated;
  }, [statusLabel, t]);
  const errorMessage = useCallback((code, fallback) => { const translated = resolveKey(resources[language], `error.${code}`) ?? resolveKey(resources.id, `error.${code}`); return translated ?? fallback; }, [language]);
  const value = useMemo(() => ({ language, locale, setLanguage, theme, setTheme, applyCanonicalPreferences, t, formatDate, formatCurrency, formatNumber, statusLabel, notificationTypeLabel, errorMessage }), [applyCanonicalPreferences, errorMessage, formatCurrency, formatDate, formatNumber, language, locale, notificationTypeLabel, setLanguage, setTheme, statusLabel, t, theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return value;
}
