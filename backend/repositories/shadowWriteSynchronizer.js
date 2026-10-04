function createShadowWriteSynchronizer(options = {}) {
  const enabled = options.enabled ?? process.env.FINAL_REPOSITORY_SHADOW_SYNC_WRITES === "true";
  if (enabled && (options.nodeEnv || process.env.NODE_ENV || "development") === "production") throw new Error("FINAL_REPOSITORY_SHADOW_SYNC_WRITES is forbidden in production");
  let queue = Promise.resolve();
  const handler = options.handler || (async () => {
    process.env.FINAL_BACKFILL_RUNTIME_SYNC = "true";
    return require("../prisma/backfill/finalEcommerce20Backfill").synchronizeFinalFromLegacy();
  });
  const run = async ({ mutations, metrics, unsafe }) => {
    const domains = [...new Set(mutations.map((item) => item.domain))];
    try {
      const outcome = await handler(mutations); const changes = Object.values(outcome.inserted || {}).reduce((a,b)=>a+b,0) + Object.values(outcome.updated || {}).reduce((a,b)=>a+b,0);
      metrics.record({ kind: "shadow-sync", domain: domains.join(","), operation: mutations.map((item)=>item.operation).join(","), shadowSyncResult: changes ? "SUCCESS" : "NO_CHANGE", errorCode: null });
      return outcome;
    } catch (error) {
      const divergence = /DIVERGENCE/.test(String(error.message)); for (const domain of domains) unsafe.add(domain);
      metrics.record({ kind: "shadow-sync", domain: domains.join(","), operation: mutations.map((item)=>item.operation).join(","), shadowSyncResult: divergence ? "DIVERGENCE" : "ERROR", errorCode: divergence ? "SHADOW_SYNC_DIVERGENCE" : "SHADOW_SYNC_FAILURE" });
      return { error, legacyCommitted: true };
    }
  };
  return {
    enabled,
    afterWrite(mutation) { return this.afterCommit({ mutations: [mutation], metrics: mutation.metrics, unsafe: mutation.unsafe }); },
    afterCommit(payload) { const work = queue.then(() => run(payload)); queue = work.catch(() => {}); return work; },
  };
}

module.exports = { createShadowWriteSynchronizer };
