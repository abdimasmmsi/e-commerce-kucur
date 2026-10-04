const READ_METHODS = new Set([
  "users.findById", "users.findByEmail", "users.findFirstByRole", "users.list", "sessions.findActiveByTokenHash",
  "stores.list", "stores.listApplications", "stores.findApplication", "stores.findById",
  "products.list", "products.findById", "commerce.getCart", "commerce.findCartItem",
  "commerce.findCheckout", "commerce.listOrders", "commerce.findOrder", "commerce.listExpiredPaymentOrders",
  "settings.get", "finance.getInitialFee", "finance.findInstallment", "finance.listReconcileInstallments",
  "finance.listAdminFees", "finance.findAdminFees", "finance.listStoresForAdminFeeReconcile",
  "finance.countOverdueAdminFees", "finance.listContributions", "finance.findContribution", "finance.monitoring",
  "finance.findPlatformTransaction", "finance.findPlatformTransactionById", "finance.findAdminFeeByTransaction",
  "finance.findInstallmentPayment", "finance.findSettlement",
  "delivery.profile", "delivery.listCouriers", "delivery.availability", "delivery.overlappingAvailability",
  "delivery.lockOrder",
  "delivery.eligibleOrders", "delivery.activeAssignment", "delivery.activeCourierCount", "delivery.listBatches",
  "delivery.merchantAssignments", "delivery.batch", "delivery.assignment", "delivery.latestAssignment",
  "delivery.batchOrder", "delivery.proof", "delivery.activities", "reviews.findProductSource",
  "reviews.findProductSourceByOrder", "reviews.find", "reviews.list", "chats.findByOpenKey",
  "chats.find", "chats.list", "chats.count", "chats.messages", "chats.messageCount",
  "notifications.findByDedupeKey", "notifications.findById", "notifications.list", "notifications.count",
]);

const OMIT_KEYS = new Set([
  "statusHistory", "locationRef", "locationSource", "locationLabel", "type",
  "activities", "reservations", "deliveryActivities", "pickupConfirmations", "deliveryProof",
]);
const normalize = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(normalize).sort((a, b) => String(a?.id || a?.userId || a).localeCompare(String(b?.id || b?.userId || b)));
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).filter((key) => !OMIT_KEYS.has(key) && value[key] !== undefined).sort().map((key) => [key, normalize(value[key])]));
  return value;
};
const differences = (left, right, path = "$") => {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  if (left == null || right == null || typeof left !== "object" || typeof right !== "object") return [{ path, legacy: left, final: right }];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].flatMap((key) => differences(left[key], right[key], `${path}.${key}`));
};

function createDualReadRepository(legacy, finalRepository, options = {}) {
  const enabled = options.enabled ?? (process.env.FINAL_REPOSITORY_DUAL_READ === "true" && process.env.NODE_ENV !== "production");
  const diagnostics = options.diagnostics || [];
  const normalizers = options.normalizers || {};
  const domains = new Set([...Object.keys(legacy), ...Object.keys(finalRepository)]);
  const result = { diagnostics, enabled };
  for (const domain of domains) {
    if (typeof legacy[domain] !== "object" || legacy[domain] == null) continue;
    result[domain] = {};
    for (const [method, legacyMethod] of Object.entries(legacy[domain])) {
      if (typeof legacyMethod !== "function") continue;
      const operation = `${domain}.${method}`;
      const finalMethod = finalRepository[domain]?.[method];
      if (!enabled || !READ_METHODS.has(operation) || typeof finalMethod !== "function") {
        result[domain][method] = (...args) => legacyMethod(...args);
        continue;
      }
      result[domain][method] = async (...args) => {
        const legacyValue = await legacyMethod(...args);
        try {
          const finalValue = await finalMethod(...args);
          const normalizer = normalizers[operation] || normalize;
          const left = normalizer(legacyValue, "legacy");
          const right = normalizer(finalValue, "final");
          const mismatch = differences(left, right);
          diagnostics.push({ domain, operation, recordsCompared: Array.isArray(left) ? left.length : left == null ? 0 : 1, matches: mismatch.length === 0, expectedNormalizedDifferences: 0, unexpectedMismatches: mismatch.length, differences: mismatch.slice(0, 50) });
        } catch (error) {
          diagnostics.push({ domain, operation, recordsCompared: 0, matches: false, expectedNormalizedDifferences: 0, unexpectedMismatches: 1, differences: [{ path: "$shadow", legacy: null, final: { error: error.message } }] });
        }
        return legacyValue;
      };
    }
  }
  result.transaction = legacy.transaction.bind(legacy);
  result.health = legacy.health.bind(legacy);
  return result;
}

module.exports = { READ_METHODS, createDualReadRepository, differences, normalize };
