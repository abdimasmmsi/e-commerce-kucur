const { createHash } = require("node:crypto");
const { READ_METHODS, differences, normalize } = require("./dualReadRepository");
const { currentReadContext } = require("./repositoryReadContext");
const { defaultCanaryNormalizers } = require("./canaryComparisonAdapters");

// Method yang hanya ada di repository final (dibaca/ditulis langsung saat mode final).
const FINAL_ONLY_READS = new Set(["products.stats", "products.restockWatchers", "products.setRestockWatchers", "products.recordView", "products.viewStats", "notifications.markReadByEntity"]);
const ELIGIBLE_DOMAINS = new Set(["users", "sessions", "stores", "products", "commerce", "settings", "finance", "delivery", "reviews", "chats", "notifications"]);
const DOMAIN_NAMES = { users: "AUTH", sessions: "AUTH", stores: "STORE", products: "PRODUCT", commerce: "COMMERCE", settings: "SETTINGS", finance: "FINANCE", delivery: "DELIVERY", reviews: "REVIEW", chats: "CHAT", notifications: "NOTIFICATION" };
const publicDomainFor = (domain, operation) => operation.startsWith("commerce.getCart") || operation.startsWith("commerce.findCartItem") ? "CART" : DOMAIN_NAMES[domain];
const VALID_MODES = new Set(["legacy", "shadow", "canary", "final"]);
const percentile = (values, ratio) => values.length ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)] : 0;
const elapsed = (started) => Number(process.hrtime.bigint() - started) / 1e6;
const stableBucket = (key) => Number.parseInt(createHash("sha256").update(String(key)).digest("hex").slice(0, 8), 16) % 100;
const parseDomains = (value) => new Set(String(value || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean));

function createCanaryMetrics() {
  const events = [];
  return {
    events,
    record(event) { events.push({ timestamp: new Date().toISOString(), ...event }); if (events.length > 10000) events.shift(); },
    summary() {
      const reads = events.filter((item) => item.kind === "read"); const syncs = events.filter((item) => item.kind === "shadow-sync");
      return {
        totalEligibleReads: reads.length, finalCanaryReads: reads.filter((item) => item.canarySelected && !item.fallbackUsed).length,
        legacyReads: reads.filter((item) => !item.canarySelected || item.fallbackUsed).length,
        comparisonMatches: reads.filter((item) => item.comparisonResult === "MATCH").length,
        expectedDifferences: reads.reduce((sum, item) => sum + (item.expectedDifferenceCount || 0), 0),
        unexpectedMismatches: reads.reduce((sum, item) => sum + (item.unexpectedDifferenceCount || 0), 0),
        fallbackCount: reads.filter((item) => item.fallbackUsed).length,
        legacyReadErrors: reads.filter((item) => item.errorCode === "LEGACY_READ_ERROR").length,
        finalReadErrors: reads.filter((item) => item.errorCode === "FINAL_READ_ERROR").length,
        shadowSyncAttempts: syncs.length, shadowSyncSuccess: syncs.filter((item) => item.shadowSyncResult === "SUCCESS").length,
        shadowSyncNoChange: syncs.filter((item) => item.shadowSyncResult === "NO_CHANGE").length,
        shadowSyncDivergence: syncs.filter((item) => item.shadowSyncResult === "DIVERGENCE").length,
        shadowSyncErrors: syncs.filter((item) => item.shadowSyncResult === "ERROR").length,
      };
    },
    performance() {
      const grouped = {};
      for (const event of events.filter((item) => item.kind === "read")) { const row = grouped[event.domain] ||= { legacy: [], final: [] }; if (event.legacyDurationMs != null) row.legacy.push(event.legacyDurationMs); if (event.finalDurationMs != null) row.final.push(event.finalDurationMs); }
      return Object.fromEntries(Object.entries(grouped).map(([domain, row]) => [domain, { legacyAvgMs: row.legacy.length ? row.legacy.reduce((a,b)=>a+b,0)/row.legacy.length : 0, legacyP95Ms: percentile(row.legacy,.95), finalAvgMs: row.final.length ? row.final.reduce((a,b)=>a+b,0)/row.final.length : 0, finalP95Ms: percentile(row.final,.95) }]));
    },
  };
}

function readRouterConfig(input = {}) {
  const mode = String(input.mode || process.env.FINAL_REPOSITORY_READ_MODE || (process.env.FINAL_REPOSITORY_DUAL_READ === "true" ? "shadow" : "legacy")).toLowerCase();
  if (!VALID_MODES.has(mode)) throw new Error(`Invalid FINAL_REPOSITORY_READ_MODE ${mode}`);
  if (mode === "final" && !input.allowFinal) throw new Error("FINAL_REPOSITORY_READ_MODE=final is reserved for a later phase");
  const percent = Math.max(0, Math.min(100, Number(input.percent ?? process.env.FINAL_REPOSITORY_CANARY_PERCENT ?? 0)));
  return { mode, percent, domains: input.domains || parseDomains(process.env.FINAL_REPOSITORY_CANARY_DOMAINS), allowFinal: Boolean(input.allowFinal) };
}

function createRepositoryReadRouter(legacy, finalRepository, options = {}) {
  const config = readRouterConfig(options);
  const metrics = options.metrics || createCanaryMetrics(); const normalizers = { ...defaultCanaryNormalizers, ...(options.normalizers || {}) };
  const unsafe = new Set(); const domains = new Set([...Object.keys(legacy), ...Object.keys(finalRepository)]); const result = { metrics, config, unsafe };
  const selected = (domain, operation, args) => {
    if (config.mode !== "canary" && config.mode !== "final") return false;
    const publicDomain = publicDomainFor(domain, operation); if (!ELIGIBLE_DOMAINS.has(domain) || !READ_METHODS.has(operation)) return false;
    const context = currentReadContext();
    if (unsafe.has(publicDomain) || (config.domains.size && !config.domains.has(publicDomain))) return false;
    const stableKey = context?.userId || context?.requestId || args.find((value) => typeof value === "string") || operation;
    return config.mode === "final" || stableBucket(stableKey) < config.percent;
  };
  for (const domain of domains) {
    if (["metrics", "config", "unsafe", "unsafeDomains", "unsafeEntities", "isWriteRouter"].includes(domain)) continue;
    if (!legacy[domain] || typeof legacy[domain] !== "object") continue;
    result[domain] = {};
    for (const [method, legacyMethod] of Object.entries(legacy[domain])) {
      if (typeof legacyMethod !== "function") continue;
      const operation = `${domain}.${method}`; const finalMethod = finalRepository[domain]?.[method]; const readable = READ_METHODS.has(operation) && typeof finalMethod === "function" && ELIGIBLE_DOMAINS.has(domain);
      if (!readable) { result[domain][method] = async (...args) => { const value = await legacyMethod(...args); if (options.shadowSynchronizer?.enabled && ELIGIBLE_DOMAINS.has(domain) && typeof finalMethod === "function") await options.shadowSynchronizer.afterWrite({ domain: publicDomainFor(domain, operation) || domain.toUpperCase(), operation, args, result: value, metrics, unsafe }); return value; }; continue; }
      result[domain][method] = async (...args) => {
        if (config.mode === "legacy") return legacyMethod(...args);
        const context = currentReadContext() || {}; const publicDomain = publicDomainFor(domain, operation); const canarySelected = selected(domain, operation, args); let legacyValue, finalValue, legacyDurationMs, finalDurationMs, errorCode = null, fallbackUsed = false;
        if (config.mode === "final" && canarySelected) {
          const finalStart = process.hrtime.bigint();
          try { finalValue = await finalMethod(...args); finalDurationMs = elapsed(finalStart); }
          catch (error) { finalDurationMs = elapsed(finalStart); metrics.record({ kind:"read", requestId:context.requestId, userId:context.userId, domain:publicDomain, operation, readMode:"final", canarySelected:true, legacyDurationMs:null, finalDurationMs, comparisonResult:"FINAL_ONLY", expectedDifferenceCount:0, unexpectedDifferenceCount:0, fallbackUsed:false, errorCode:"FINAL_READ_ERROR" }); throw error; }
          metrics.record({ kind:"read", requestId:context.requestId, userId:context.userId, domain:publicDomain, operation, readMode:"final", canarySelected:true, legacyDurationMs:null, finalDurationMs, comparisonResult:"FINAL_ONLY", expectedDifferenceCount:0, unexpectedDifferenceCount:0, fallbackUsed:false, errorCode:null });
          return finalValue;
        }
        const legacyStart = process.hrtime.bigint(); try { legacyValue = await legacyMethod(...args); } catch (error) { errorCode = "LEGACY_READ_ERROR"; throw error; } finally { legacyDurationMs = elapsed(legacyStart); }
        if (config.mode === "canary" && !canarySelected) { metrics.record({ kind:"read", requestId:context.requestId, userId:context.userId, domain:publicDomain, operation, readMode:config.mode, canarySelected:false, legacyDurationMs, finalDurationMs:null, comparisonResult:"NOT_SELECTED", expectedDifferenceCount:0, unexpectedDifferenceCount:0, fallbackUsed:false, errorCode:null }); return legacyValue; }
        const finalStart = process.hrtime.bigint(); try { finalValue = await finalMethod(...args); } catch (error) { finalDurationMs = elapsed(finalStart); errorCode = "FINAL_READ_ERROR"; fallbackUsed = canarySelected; unsafe.add(publicDomain); metrics.record({ kind:"read", requestId:context.requestId, userId:context.userId, domain:publicDomain, operation, readMode:config.mode, canarySelected, legacyDurationMs, finalDurationMs, comparisonResult:"ERROR", expectedDifferenceCount:0, unexpectedDifferenceCount:1, fallbackUsed, errorCode }); return legacyValue; } finalDurationMs = elapsed(finalStart);
        const normalizer = normalizers[operation] || normalize; const rawMismatch = differences(normalize(legacyValue), normalize(finalValue)); const left = normalizer(legacyValue, "legacy"); const right = normalizer(finalValue, "final"); const mismatch = differences(left, right); const matches = mismatch.length === 0; const expectedDifferenceCount = Math.max(0, rawMismatch.length - mismatch.length);
        if (!matches && canarySelected) { fallbackUsed = true; unsafe.add(publicDomain); }
        metrics.record({ kind:"read", requestId:context.requestId, userId:context.userId, domain:publicDomain, operation, readMode:config.mode, canarySelected, legacyDurationMs, finalDurationMs, comparisonResult:matches?"MATCH":"MISMATCH", expectedDifferenceCount, unexpectedDifferenceCount:mismatch.length, differencePaths:mismatch.slice(0,50).map((item)=>item.path), fallbackUsed, errorCode:matches?null:"FINAL_READ_MISMATCH" });
        return canarySelected && matches ? finalValue : legacyValue;
      };
    }
    // Method baca yang hanya ada di repository final (mis. statistik produk) langsung diteruskan saat mode final.
    if (config.mode === "final") for (const [method, finalMethod] of Object.entries(finalRepository[domain] || {})) {
      if (typeof finalMethod === "function" && !result[domain][method] && FINAL_ONLY_READS.has(`${domain}.${method}`)) result[domain][method] = (...args) => finalMethod(...args);
    }
  }
  result.transaction = async (work) => { const mutations = []; const value = await legacy.transaction((tx) => work(createRepositoryReadRouter(tx, finalRepository, { ...options, mode: "legacy", shadowSynchronizer: { enabled: true, afterWrite: async (mutation) => { mutations.push(mutation); } }, metrics }))); if (options.shadowSynchronizer?.enabled && mutations.length) await options.shadowSynchronizer.afterCommit({ mutations, metrics, unsafe }); return value; };
  result.health = legacy.health.bind(legacy);
  return result;
}

module.exports = { DOMAIN_NAMES, ELIGIBLE_DOMAINS, createCanaryMetrics, createRepositoryReadRouter, readRouterConfig, stableBucket };
