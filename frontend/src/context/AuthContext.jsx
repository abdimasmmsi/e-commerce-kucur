import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_INVALIDATED_EVENT, ApiError } from "../services/apiClient";
import { authService, normalizeAuthUser } from "../services/authService";
import { AUTH_TOKEN_STORAGE_KEY, clearAuthToken, clearLegacyAuthStorage, getActiveRole, getAuthExpiresAt, getAuthToken, setActiveRole, setAuthExpiresAt, setAuthToken } from "../services/authStorage";
import { usePreferences } from "./PreferencesContext";

const AuthContext = createContext(null);
const emptySession = { user: null, activeRole: null };
const fallbackRole = (roles, preferredRole) => roles.includes(preferredRole) ? preferredRole : roles.includes("customer") ? "customer" : roles[0] ?? null;
const publicError = (error, fallback, errorMessage) => {
  if (!(error instanceof ApiError)) return fallback;
  return errorMessage(error.code, ["UNAUTHENTICATED", "VALIDATION_ERROR", "CONFLICT"].includes(error.code) ? error.message || fallback : fallback);
};

export function AuthProvider({ children }) {
  const { applyCanonicalPreferences, errorMessage } = usePreferences();
  const [session, setSession] = useState(emptySession);
  const [initialized, setInitialized] = useState(false);
  const clearSession = useCallback(() => { clearAuthToken(); setSession(emptySession); }, []);
  const acceptUser = useCallback((rawUser, preferredRole = null) => {
    const user = normalizeAuthUser(rawUser);
    if (!user.roles.length) throw new Error("Authenticated user has no authorized roles.");
    const activeRole = fallbackRole(user.roles, preferredRole ?? getActiveRole(user.id));
    applyCanonicalPreferences(user.preferences);
    setActiveRole(user.id, activeRole);
    setSession({ user, activeRole });
    return { user, activeRole };
  }, [applyCanonicalPreferences]);
  const restoreSession = useCallback(async () => {
    if (!getAuthToken()) { setSession(emptySession); return null; }
    const expiresAt = getAuthExpiresAt();
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      sessionStorage.setItem("kucur_session_expired", "1");
      clearSession();
      return null;
    }
    try { return acceptUser(await authService.me()); }
    catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHENTICATED") clearSession();
      else setSession(emptySession);
      return null;
    }
  }, [acceptUser, clearSession]);

  useEffect(() => {
    clearLegacyAuthStorage();
    let active = true;
    queueMicrotask(() => restoreSession().finally(() => { if (active) setInitialized(true); }));
    const invalidate = () => { sessionStorage.setItem("kucur_session_expired", "1"); clearSession(); };
    const syncToken = (event) => {
      if (event.key !== AUTH_TOKEN_STORAGE_KEY) return;
      if (!event.newValue) clearSession(); else restoreSession();
    };
    window.addEventListener(AUTH_INVALIDATED_EVENT, invalidate);
    window.addEventListener("storage", syncToken);
    return () => {
      active = false;
      window.removeEventListener(AUTH_INVALIDATED_EVENT, invalidate);
      window.removeEventListener("storage", syncToken);
    };
  }, [clearSession, restoreSession]);

  const login = useCallback(async (email, password, preferredRole = null) => {
    try {
      const result = await authService.login(email.trim().toLowerCase(), password);
      setAuthToken(result.token);
      setAuthExpiresAt(result.expiresAt);
      try { return { success: true, ...acceptUser(await authService.me(), preferredRole) }; }
      catch (error) { clearSession(); throw error; }
    } catch (error) {
      return { success: false, code: error.code, message: publicError(error, "Login tidak dapat diproses.", errorMessage) };
    }
  }, [acceptUser, clearSession, errorMessage]);
  const register = useCallback(async ({ fullName, email, phone, password, address }) => {
    try {
      const user = await authService.register({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, address });
      return { success: true, user, requiresLogin: true };
    } catch (error) {
      return { success: false, code: error.code, message: publicError(error, "Registrasi tidak dapat diproses.", errorMessage) };
    }
  }, [errorMessage]);
  const logout = useCallback(async () => {
    try { if (getAuthToken()) await authService.logout(); }
    catch { /* Local logout still succeeds if revocation cannot reach the backend. */ }
    finally { clearSession(); }
  }, [clearSession]);
  const hasRole = useCallback((role) => Boolean(session.user?.roles.includes(role)), [session.user]);
  const switchRole = useCallback((role) => {
    if (!session.user?.roles.includes(role)) return { success: false, message: "Role tidak tersedia untuk akun ini." };
    setActiveRole(session.user.id, role);
    setSession((current) => ({ ...current, activeRole: role }));
    return { success: true, activeRole: role };
  }, [session.user]);
  const updateProfile = useCallback(async (input) => {
    try { return { success: true, ...acceptUser(await authService.updateProfile(input), session.activeRole) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Profil tidak dapat diperbarui.", errorMessage), details: error.details }; }
  }, [acceptUser, errorMessage, session.activeRole]);
  const updateAvatar = useCallback(async (dataUrl) => {
    try { return { success: true, ...acceptUser(await authService.updateAvatar(dataUrl), session.activeRole) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Foto profil tidak dapat diperbarui.", errorMessage), details: error.details }; }
  }, [acceptUser, errorMessage, session.activeRole]);
  const removeAvatar = useCallback(async () => {
    try { return { success: true, ...acceptUser(await authService.removeAvatar(), session.activeRole) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Foto profil tidak dapat dihapus.", errorMessage), details: error.details }; }
  }, [acceptUser, errorMessage, session.activeRole]);
  const changePassword = useCallback(async (input) => {
    try { const result = await authService.updatePassword(input); await restoreSession(); return { success: true, ...result }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Kata sandi tidak dapat diperbarui.", errorMessage), details: error.details }; }
  }, [errorMessage, restoreSession]);

  useEffect(() => {
    if (!session.user) return undefined;
    const expiresAt = getAuthExpiresAt();
    const remaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : Number.NaN;
    if (!Number.isFinite(remaining)) return undefined;
    const timeoutId = window.setTimeout(() => { sessionStorage.setItem("kucur_session_expired", "1"); clearSession(); }, Math.max(0, remaining));
    return () => window.clearTimeout(timeoutId);
  }, [clearSession, session.user]);
  const verifyCurrentPassword = useCallback(async (currentPassword) => {
    try { return { success: true, ...(await authService.verifyCurrentPassword(currentPassword)) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Kata sandi saat ini salah.", errorMessage), details: error.details }; }
  }, [errorMessage]);
  const updateAddresses = useCallback(async (addresses) => {
    try { return { success: true, ...acceptUser(await authService.updateAddresses(addresses), session.activeRole) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Alamat tidak dapat disimpan.", errorMessage) }; }
  }, [acceptUser, errorMessage, session.activeRole]);
  const updatePreferences = useCallback(async (input) => {
    try { return { success: true, ...acceptUser(await authService.updatePreferences(input), session.activeRole) }; }
    catch (error) { return { success: false, code: error.code, message: publicError(error, "Preferensi tidak dapat disimpan.", errorMessage) }; }
  }, [acceptUser, errorMessage, session.activeRole]);
  const value = useMemo(() => ({
    user: session.user, activeRole: session.activeRole, isAuthenticated: Boolean(session.user), authLoading: !initialized, initialized,
    login, register, logout, switchRole, hasRole, updateProfile, updateAvatar, removeAvatar, verifyCurrentPassword, changePassword, updatePreferences, updateAddresses, refreshUserRoles: restoreSession,
  }), [changePassword, hasRole, initialized, login, logout, register, removeAvatar, restoreSession, session, switchRole, updateAddresses, updateAvatar, updatePreferences, updateProfile, verifyCurrentPassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
