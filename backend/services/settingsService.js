const { errors } = require("../errors/AppError");

// Terima "HH:MM" dari input jam dan "HH:MM:SS" yang dikirim balik oleh GET /api/settings.
const time = (value) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(value));
const numberBetween = (min, max) => (value) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
const integerBetween = (min, max) => (value) => Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
const validators = {
  deliveryRatePerKm: numberBetween(0, 10000000), deliveryOrderCutoffTime: time, deliveryDispatchTime: time,
  maxDailyDeliveries: integerBetween(1, 10000), tourismApprovalTimeoutHours: integerBetween(1, 720),
  initialStoreFeeAmount: numberBetween(0, 1000000000000), installmentFullEnabled: (value) => typeof value === "boolean",
  installment3MonthsEnabled: (value) => typeof value === "boolean", installment6MonthsEnabled: (value) => typeof value === "boolean",
  installmentLateInterestPercent: numberBetween(0, 100), adminFeeType: (value) => ["percentage", "fixed"].includes(value),
  adminFeeValue: numberBetween(0, 1000000000000), adminFeeCutoffDay: integerBetween(1, 28), adminFeeGraceTime: time,
  suspendStoreForOutstandingAdminFee: (value) => typeof value === "boolean", taxPercent: numberBetween(0, 100),
  voluntaryContributionEnabled: (value) => typeof value === "boolean",
  maxDeliveryDistanceKm: (value) => value === null || (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 500),
  adminContactName: (value) => value === null || (typeof value === "string" && value.trim().length <= 120),
  adminContactPhone: (value) => value === null || (typeof value === "string" && /^[0-9+ ()-]{0,30}$/.test(value.trim())), prideTransactionValueWeight: numberBetween(0, 100),
  prideTransactionCountWeight: numberBetween(0, 100), prideRatingWeight: numberBetween(0, 100),
  prideCompletionRateWeight: numberBetween(0, 100), prideLeaderboardSize: integerBetween(1, 20),
};
const textKeys = new Set(["adminContactName", "adminContactPhone"]);
const numericKeys = new Set(Object.keys(validators).filter((key) => !key.endsWith("Enabled") && key !== "suspendStoreForOutstandingAdminFee" && key !== "adminFeeType" && !key.endsWith("Time") && !textKeys.has(key)));
const prideKeys = ["prideTransactionValueWeight", "prideTransactionCountWeight", "prideRatingWeight", "prideCompletionRateWeight"];

// FAQ chatbot yang dikelola Admin: entri baru atau penimpa FAQ bawaan (builtin: true, boleh hanya disembunyikan).
const FAQ_ROLES = ["visitor", "customer", "merchant", "courier", "admin"];
const faqText = (value, max, field) => { const text = typeof value === "string" ? value.trim() : ""; if (!text) throw errors.validation({ faqEntries: `${field} wajib diisi.` }); if (text.length > max) throw errors.validation({ faqEntries: `${field} terlalu panjang (maks ${max} karakter).` }); return text; };
const faqLines = (value, field) => { const lines = (Array.isArray(value) ? value : []).map((line) => String(line ?? "").trim()).filter(Boolean); if (!lines.length || lines.length > 8) throw errors.validation({ faqEntries: `${field} wajib berisi 1–8 langkah.` }); return lines.map((line) => faqText(line, 600, field)); };
function sanitizeFaqEntries(value) {
  if (!Array.isArray(value) || value.length > 200) throw errors.validation({ faqEntries: "Daftar FAQ tidak valid (maks 200 entri)." });
  const seen = new Set();
  return value.map((entry) => {
    const id = String(entry?.id ?? "");
    if (!/^[a-z0-9-]{2,60}$/.test(id) || seen.has(id)) throw errors.validation({ faqEntries: "ID FAQ tidak valid atau ganda." });
    seen.add(id);
    const builtin = entry.builtin === true; const hidden = entry.hidden === true;
    const base = { id, builtin, hidden, updatedAt: new Date().toISOString() };
    if (builtin && hidden && !entry.q) return base;
    const roles = [...new Set((Array.isArray(entry.roles) ? entry.roles : []).filter((role) => FAQ_ROLES.includes(role)))];
    if (!roles.length) throw errors.validation({ faqEntries: "Pilih minimal satu peran untuk FAQ." });
    const link = entry.link && entry.link.to ? { to: String(entry.link.to).trim(), label: { id: faqText(entry.link.label?.id, 40, "Label tautan (ID)"), en: faqText(entry.link.label?.en, 40, "Label tautan (EN)") } } : null;
    if (link && (!/^\/[A-Za-z0-9/_-]*$/.test(link.to) || link.to.length > 120)) throw errors.validation({ faqEntries: "Tautan FAQ harus halaman di aplikasi (diawali /)." });
    const keywords = [...new Set((Array.isArray(entry.keywords) ? entry.keywords : []).map((word) => String(word ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 15).map((word) => faqText(word, 40, "Kata kunci"));
    return { ...base, pinned: entry.pinned === true, roles, keywords, link, q: { id: faqText(entry.q?.id, 200, "Pertanyaan (ID)"), en: faqText(entry.q?.en, 200, "Pertanyaan (EN)") }, a: { id: faqLines(entry.a?.id, "Jawaban (ID)"), en: faqLines(entry.a?.en, "Jawaban (EN)") } };
  });
}

function createSettingsService(repository) {
  return {
    get: () => repository.settings.get(),
    // Dipakai chatbot untuk semua pengguna, termasuk pengunjung yang belum login.
    async faq() { const settings = await repository.settings.get(); return Array.isArray(settings?.faqEntries) ? settings.faqEntries : []; },
    async update(input, actor) {
      const changes = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (key === "faqEntries") { changes.faqEntries = sanitizeFaqEntries(value); continue; }
        if (!validators[key]) continue;
        if (!validators[key](value)) throw errors.validation({ [key]: "Nilai pengaturan tidak valid." });
        changes[key] = value === null ? null : numericKeys.has(key) ? Number(value) : textKeys.has(key) ? value.trim() || null : value;
      }
      if (!Object.keys(changes).length) throw errors.validation({ settings: "Tidak ada pengaturan yang dapat diperbarui." });
      const current = await repository.settings.get();
      const next = { ...current, ...changes };
      if (next.adminFeeType === "percentage" && Number(next.adminFeeValue) > 100) throw errors.validation({ adminFeeValue: "Persentase biaya admin harus antara 0 dan 100." });
      if (Math.abs(prideKeys.reduce((sum, key) => sum + Number(next[key]), 0) - 100) > 0.001) throw errors.validation({ prideWeights: "Total bobot Pride harus tepat 100%." });
      return repository.transaction(async (tx) => {
        const settings = await tx.settings.update(changes);
        await tx.audits.append({ entityType: "platform-settings", entityId: "active", actorId: actor.id, actorRole: "admin", activityType: "SETTINGS_UPDATED", previousStatus: null, nextStatus: null, description: `Pengaturan diperbarui: ${Object.keys(changes).join(", ")}.`, reason: null, isSystem: false });
        return settings;
      });
    },
  };
}

module.exports = { createSettingsService };
