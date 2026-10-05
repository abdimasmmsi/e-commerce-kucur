import { apiData } from "./apiClient";

// FAQ chatbot yang dikelola Admin (disimpan di PlatformSettings.faqEntries).
export const faqEntriesService = {
  list: () => apiData("/api/settings/faq"),
  save: (entries) => apiData("/api/settings", { method: "PATCH", body: { faqEntries: entries } }),
};
