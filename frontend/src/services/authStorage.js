export const AUTH_TOKEN_STORAGE_KEY = "kucur_auth_token";
export const AUTH_EXPIRES_AT_STORAGE_KEY = "kucur_auth_expires_at";
const ACTIVE_ROLE_PREFIX = "kucur_auth_active_role:";

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
export const setAuthToken = (token) => token
  ? localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  : localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
export const getAuthExpiresAt = () => localStorage.getItem(AUTH_EXPIRES_AT_STORAGE_KEY);
export const setAuthExpiresAt = (value) => value
  ? localStorage.setItem(AUTH_EXPIRES_AT_STORAGE_KEY, value)
  : localStorage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY);
export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_EXPIRES_AT_STORAGE_KEY);
};
export const getActiveRole = (userId) => userId ? localStorage.getItem(`${ACTIVE_ROLE_PREFIX}${userId}`) : null;
export const setActiveRole = (userId, role) => {
  if (!userId) return;
  const key = `${ACTIVE_ROLE_PREFIX}${userId}`;
  if (role) localStorage.setItem(key, role);
  else localStorage.removeItem(key);
};
export const clearLegacyAuthStorage = () => {
  ["kucur_auth_user", "kucur_auth_active_role", "kucur_registered_accounts", "kucur_user_role_overrides"]
    .forEach((key) => localStorage.removeItem(key));
};
