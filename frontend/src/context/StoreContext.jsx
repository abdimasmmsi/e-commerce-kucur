import { useLiveRefresh } from "../utils/liveRefresh";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { storeService } from "../services/storeService";
import { normalizeStoreType } from "../utils/storeScope";

const ACTIVE_STORE_STORAGE_PREFIX = "kucur_active_store_id:";
const StoreContext = createContext(null);
const resolveActiveStoreId = (stores, requestedId) => {
  if (!stores.length) return null;
  if (requestedId === "all") return "all";
  return stores.some((store) => store.id === String(requestedId)) ? String(requestedId) : stores[0].id;
};

export function StoreProvider({ children }) {
  const { initialized, user } = useAuth();
  const [stores, setStores] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const storageKey = user?.id ? `${ACTIVE_STORE_STORAGE_PREFIX}${user.id}` : null;
  const canLoad = Boolean(initialized && user && (user.roles.includes("merchant") || user.roles.includes("admin")));

  const acceptStores = useCallback((rows) => {
    const sorted = rows
      .filter((store) => normalizeStoreType(store.type) === "product")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setStores(sorted);
    setActiveStoreId((current) => {
      const requested = current ?? (storageKey ? localStorage.getItem(storageKey) : null);
      const next = resolveActiveStoreId(sorted, requested);
      if (storageKey) { if (next) localStorage.setItem(storageKey, next); else localStorage.removeItem(storageKey); }
      return next;
    });
    return sorted;
  }, [storageKey]);

  const lastStoresJson = useRef("");
  const refreshStores = useCallback(async () => {
    if (!canLoad) { setStores([]); setActiveStoreId(null); setError(null); return []; }
    setLoading(true); setError(null);
    try { const rows = await storeService.list(); lastStoresJson.current = JSON.stringify(rows); return acceptStores(rows); }
    catch (nextError) { setError(nextError); throw nextError; }
    finally { setLoading(false); }
  }, [acceptStores, canLoad]);

  useEffect(() => { queueMicrotask(() => void refreshStores().catch(() => {})); }, [refreshStores]);
  // Muat ulang diam-diam (mis. persetujuan lapak dari Admin): tanpa loading/galat, state hanya diganti bila isinya berubah.
  const silentRefreshStores = useCallback(async () => {
    if (!canLoad) return;
    try {
      const rows = await storeService.list();
      const json = JSON.stringify(rows);
      if (json === lastStoresJson.current) return;
      lastStoresJson.current = json;
      acceptStores(rows);
    } catch { /* data lama tetap tampil */ }
  }, [acceptStores, canLoad]);
  useLiveRefresh(silentRefreshStores, { enabled: canLoad });

  const setActiveStore = useCallback((storeId) => {
    const next = resolveActiveStoreId(stores, storeId);
    setActiveStoreId(next);
    if (storageKey) { if (next) localStorage.setItem(storageKey, next); else localStorage.removeItem(storageKey); }
    return next;
  }, [storageKey, stores]);
  const createStore = useCallback(async (input) => { const created = await storeService.create(input); await refreshStores(); setActiveStore(created.id); return created; }, [refreshStores, setActiveStore]);
  const updateStore = useCallback(async (storeId, input) => { const updated = await storeService.update(storeId, input); await refreshStores(); return updated; }, [refreshStores]);
  const setStoreAvailability = useCallback(async (storeId, acceptingOrders) => { const updated = await storeService.setAvailability(storeId, acceptingOrders); await refreshStores(); return updated; }, [refreshStores]);
  const getStore = useCallback(async (storeId) => storeService.get(storeId), []);
  const activeStore = useMemo(() => stores.find((store) => store.id === activeStoreId) ?? null, [activeStoreId, stores]);
  const value = useMemo(() => ({ stores, activeStore, activeStoreId, loading, error, setActiveStore, refreshStores, createStore, updateStore, setStoreAvailability, getStore }), [activeStore, activeStoreId, createStore, error, getStore, loading, refreshStores, setActiveStore, setStoreAvailability, stores, updateStore]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() { const context = useContext(StoreContext); if (!context) throw new Error("useStore must be used inside StoreProvider."); return context; }
