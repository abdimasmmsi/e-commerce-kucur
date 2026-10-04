const { errors } = require("../errors/AppError");

const time = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
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
  voluntaryContributionEnabled: (value) => typeof value === "boolean", prideTransactionValueWeight: numberBetween(0, 100),
  prideTransactionCountWeight: numberBetween(0, 100), prideRatingWeight: numberBetween(0, 100),
  prideCompletionRateWeight: numberBetween(0, 100), prideLeaderboardSize: integerBetween(1, 20),
};
const numericKeys = new Set(Object.keys(validators).filter((key) => !key.endsWith("Enabled") && key !== "suspendStoreForOutstandingAdminFee" && key !== "adminFeeType" && !key.endsWith("Time")));
const prideKeys = ["prideTransactionValueWeight", "prideTransactionCountWeight", "prideRatingWeight", "prideCompletionRateWeight"];

function createSettingsService(repository) {
  return {
    get: () => repository.settings.get(),
    async update(input, actor) {
      const changes = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (!validators[key]) continue;
        if (!validators[key](value)) throw errors.validation({ [key]: "Nilai pengaturan tidak valid." });
        changes[key] = numericKeys.has(key) ? Number(value) : value;
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
