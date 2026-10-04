const { createHash } = require("node:crypto");

const deterministicCompatibilityId = (finalId, type) => {
  const hex = createHash("sha256").update(`${type}:${finalId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;
};

const withResultIdentity = (mutation) => {
  const args = structuredClone(mutation.args);
  const result = mutation.result;
  if (!result || typeof result !== "object") return args;
  const identityCreates = new Set(["users.create", "sessions.create", "stores.create", "products.create", "commerce.ensureCart", "commerce.addCartItem", "commerce.createCheckout", "commerce.createOrder", "finance.createPlatformTransaction", "finance.createAdminFeeObligation", "finance.createInitialFee", "finance.createPenalty", "finance.createInstallmentPayment", "finance.createContribution", "notifications.create", "reviews.create", "chats.create", "delivery.createAvailability", "delivery.createBatchOrder"]);
  if (identityCreates.has(mutation.operation) && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && result.id) args[0].id ||= result.id;
  if (identityCreates.has(mutation.operation) && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && result.createdAt) args[0].createdAt ||= result.createdAt;
  if (mutation.operation === "commerce.ensureCart" && result.id) args[1] = result.id;
  if (mutation.operation === "products.create" || mutation.operation === "products.update") {
    const inputIndex = mutation.operation === "products.update" ? 1 : 0;
    const input = args[inputIndex];
    if (input) {
      input.images = (input.images || []).map((item, index) => ({ ...item, id: item.id || deterministicCompatibilityId(result.id, `product-image:${index}`) }));
      input.variantGroups = (input.variantGroups || []).map((item, index) => ({ ...item, id: item.id || deterministicCompatibilityId(result.id, `product-option:${index}`) }));
      input.variants = (input.variants || []).map((item, index) => ({ ...item, id: result.variants?.[index]?.id || item.id }));
    }
  }
  if (mutation.operation === "commerce.createOrder" && result.id) {
    args[0].id = result.id;
    args[0].distanceKm = result.distanceKm;
    args[0].deliveryRateSnapshot = result.deliveryRateSnapshot;
    const rows = result.items || [];
    if (args[0].items?.create) args[0].items.create = args[0].items.create.map((item, index) => ({ ...item, id: rows[index]?.id || item.id }));
    const reservations = result.reservations || [];
    if (args[0].reservations?.create) args[0].reservations.create = args[0].reservations.create.map((item, index) => ({ ...item, id: reservations[index]?.id || rows[index]?.id || item.id }));
    const attempts = result.paymentAttempts || [];
    if (args[0].paymentAttempts?.create && !Array.isArray(args[0].paymentAttempts.create)) args[0].paymentAttempts.create.id ||= attempts[0]?.id;
  }
  if (mutation.operation === "chats.createMessage" && result.id) args[4] = result.id;
  if (mutation.operation === "chats.createMessage" && result.createdAt) args[5] = result.createdAt;
  if (mutation.operation === "reviews.upsertReply" && result.reply?.updatedAt) args[3] = result.reply.updatedAt;
  if (mutation.operation === "delivery.createBatch" && result.orders) args[2] = result.orders.map((item) => item.id);
  if (mutation.operation === "delivery.createBatch" && result.id) args[0].id ||= result.id;
  return args;
};

function createFinalLegacyMirrorSynchronizer(legacyRepository, options = {}) {
  const enabled = options.enabled ?? process.env.FINAL_REPOSITORY_LEGACY_MIRROR_WRITES === "true";
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || "development";
  if (enabled && nodeEnv === "production") throw new Error("FINAL_REPOSITORY_LEGACY_MIRROR_WRITES is forbidden in production");
  const handler = options.handler || (async (mutations) => legacyRepository.transaction(async (tx) => {
    const results = [];
    for (const mutation of mutations) {
      const [domain, method] = mutation.operation.split(".");
      const mirrorMethod = tx[domain]?.[method];
      if (typeof mirrorMethod !== "function") throw new Error(`LEGACY_MIRROR_UNSUPPORTED ${mutation.operation}`);
      results.push(await mirrorMethod(...withResultIdentity(mutation)));
    }
    return results;
  }));
  const validator = options.validator;
  let queue = Promise.resolve();
  const execute = async ({ mutations, metrics, unsafeDomains, unsafeEntities }) => {
    const domains = [...new Set(mutations.map((item) => item.domain))];
    const started = process.hrtime.bigint();
    try {
      await handler(mutations);
      const comparisonResult = validator ? await validator(mutations) : "PENDING_VALIDATION";
      if (comparisonResult === "MISMATCH") throw new Error("LEGACY_MIRROR_DIVERGENCE");
      const duration = Number(process.hrtime.bigint() - started) / 1e6;
      metrics.record({ kind: "legacy-mirror", domain: domains.join(","), operation: mutations.map((item) => item.operation).join(","), legacyMirrorResult: "SUCCESS", legacyMirrorDurationMs: duration, comparisonResult, errorCode: null });
      return { result: "SUCCESS", comparisonResult };
    } catch (error) {
      if (/P2002|duplicate/i.test(String(error.message)) && validator && await validator(mutations) === "MATCH") {
        const duration = Number(process.hrtime.bigint() - started) / 1e6;
        metrics.record({ kind: "legacy-mirror", domain: domains.join(","), operation: mutations.map((item) => item.operation).join(","), legacyMirrorResult: "NO_CHANGE", legacyMirrorDurationMs: duration, comparisonResult: "MATCH", errorCode: null });
        return { result: "NO_CHANGE", comparisonResult: "MATCH" };
      }
      const divergence = /DIVERGENCE|P2002|constraint|duplicate/i.test(String(error.message));
      for (const domain of domains) unsafeDomains.add(domain);
      for (const mutation of mutations) if (mutation.entityId) unsafeEntities.add(`${mutation.domain}:${mutation.entityId}`);
      const duration = Number(process.hrtime.bigint() - started) / 1e6;
      metrics.record({ kind: "legacy-mirror", domain: domains.join(","), operation: mutations.map((item) => item.operation).join(","), legacyMirrorResult: divergence ? "DIVERGENCE" : "FAILURE", legacyMirrorDurationMs: duration, comparisonResult: "FAILED", errorCode: divergence ? "LEGACY_MIRROR_DIVERGENCE" : "LEGACY_MIRROR_FAILURE", errorDetail: String(error.code || error.message || error).slice(0, 240) });
      return { result: divergence ? "DIVERGENCE" : "FAILURE", error, finalCommitted: true };
    }
  };
  return {
    enabled,
    afterCommit(payload) { const work = queue.then(() => execute(payload)); queue = work.catch(() => {}); return work; },
    repair(payload) { return execute(payload); },
    deterministicCompatibilityId,
  };
}

module.exports = { createFinalLegacyMirrorSynchronizer, deterministicCompatibilityId, withResultIdentity };
