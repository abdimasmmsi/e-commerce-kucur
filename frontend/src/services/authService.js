import { apiData, apiRequest } from "./apiClient";

export const normalizeAuthUser = (user) => ({
  id: String(user.id), fullName: String(user.fullName ?? ""), email: String(user.email ?? ""), phone: String(user.phone ?? ""), avatarUrl: String(user.avatarUrl ?? ""), addresses: Array.isArray(user.addresses) ? user.addresses : [],
  roles: [...new Set(Array.isArray(user.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [])],
  preferences: { language: user.preferences?.language === "en" ? "en" : "id", theme: user.preferences?.theme === "dark" ? "dark" : "light" },
  passwordSecurity: {
    changedAt: user.passwordSecurity?.changedAt ?? null,
    recommendedChangeAt: user.passwordSecurity?.recommendedChangeAt ?? null,
    rotationRecommended: Boolean(user.passwordSecurity?.rotationRecommended),
    resetRequired: Boolean(user.passwordSecurity?.resetRequired),
  },
});

export const authService = {
  login: (email, password) => apiData("/api/auth/login", { method: "POST", body: { email, password } }),
  emailStatus: (email) => apiData(`/api/auth/email-status?email=${encodeURIComponent(email)}`),
  register: async (input) => normalizeAuthUser(await apiData("/api/auth/register", { method: "POST", body: input })),
  me: async () => normalizeAuthUser(await apiData("/api/auth/me")),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
  updateProfile: async (input) => normalizeAuthUser(await apiData("/api/users/me", { method: "PATCH", body: input })),
  updateAvatar: async (dataUrl) => normalizeAuthUser(await apiData("/api/users/me/avatar", { method: "PUT", body: { dataUrl }, timeoutMs: 30000 })),
  removeAvatar: async () => normalizeAuthUser(await apiData("/api/users/me/avatar", { method: "DELETE" })),
  verifyCurrentPassword: (currentPassword) => apiData("/api/users/me/password/verify", { method: "POST", body: { currentPassword } }),
  updatePassword: (input) => apiData("/api/users/me/password", { method: "PATCH", body: input }),
  updatePreferences: async (input) => normalizeAuthUser(await apiData("/api/users/me/preferences", { method: "PATCH", body: input })),
  updateAddresses: async (addresses) => normalizeAuthUser(await apiData("/api/users/me/addresses", { method: "PUT", body: { addresses } })),
};
