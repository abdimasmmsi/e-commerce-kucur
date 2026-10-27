import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "../utils/liveRefresh";
import { useAuth } from "./AuthContext";
import { acceptOperationalSettings, defaultOperationalSettings } from "../utils/operationalSettings";
import { platformSettingsService } from "../services/platformSettingsService";

const SystemSettingsContext = createContext(null);
const compatibilityDefaults = {
  maximumActiveDeliveries: defaultOperationalSettings.maximumActiveDeliveries,
  pickupTimeoutHours: defaultOperationalSettings.pickupTimeoutHours,
  assignmentResponseMinutes: defaultOperationalSettings.assignmentResponseMinutes,
  assignmentCycleCooldownMinutes: defaultOperationalSettings.assignmentCycleCooldownMinutes,
};
const normalize = (settings) => settings ? { ...compatibilityDefaults, ...settings } : null;

export function SystemSettingsProvider({ children }) {
  const { initialized, user } = useAuth();
  const [settings, setSettings] = useState(() => normalize(defaultOperationalSettings));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const refreshSettings = useCallback(async () => {
    if (!initialized || !user) { setSettings(null); setError(null); return null; }
    setLoading(true); setError(null);
    try { const current = normalize(await platformSettingsService.get()); acceptOperationalSettings(current); setSettings(current); return current; }
    catch (nextError) { setError(nextError); throw nextError; }
    finally { setLoading(false); }
  }, [initialized, user]);
  useEffect(() => { queueMicrotask(() => void refreshSettings().catch(() => {})); }, [refreshSettings]);
  // Muat ulang diam-diam; state diganti hanya bila isinya berubah (menghindari render ulang & efek turunan).
  const silentRefresh = useCallback(async () => {
    if (!initialized || !user) return;
    try {
      const current = normalize(await platformSettingsService.get());
      const json = JSON.stringify(current);
      setSettings((previous) => {
        if (JSON.stringify(previous) === json) return previous;
        acceptOperationalSettings(current);
        return current;
      });
    } catch { /* data lama tetap tampil */ }
  }, [initialized, user]);
  useLiveRefresh(silentRefresh, { enabled: Boolean(initialized && user) });
  const updateSettings = useCallback(async (changes) => {
    setSaving(true); setError(null);
    try { const current = normalize(await platformSettingsService.update(changes)); acceptOperationalSettings(current); setSettings(current); return current; }
    catch (nextError) { setError(nextError); throw nextError; }
    finally { setSaving(false); }
  }, []);
  const value = useMemo(() => ({ settings, loading, saving, error, updateSettings, refreshSettings }), [error, loading, refreshSettings, saving, settings, updateSettings]);
  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSystemSettings() { const context = useContext(SystemSettingsContext); if (!context) throw new Error("useSystemSettings must be used inside SystemSettingsProvider"); return context; }
