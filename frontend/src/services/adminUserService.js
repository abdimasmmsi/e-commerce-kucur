import { apiData } from "./apiClient";

export const adminUserService = {
  list: () => apiData("/api/users"),
  resetPassword: (userId, input) => apiData(`/api/users/${encodeURIComponent(userId)}/password-reset`, {
    method: "POST",
    body: input,
  }),
};
