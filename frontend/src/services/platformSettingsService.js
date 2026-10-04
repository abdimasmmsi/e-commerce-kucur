import { apiData } from "./apiClient";

export const platformSettingsService = {
  get: () => apiData("/api/settings"),
  update: (changes) => apiData("/api/settings", { method: "PATCH", body: changes }),
};
