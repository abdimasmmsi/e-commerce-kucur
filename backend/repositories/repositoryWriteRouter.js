const { stableBucket, DOMAIN_NAMES, ELIGIBLE_DOMAINS } = require("./repositoryReadRouter");
const { READ_METHODS } = require("./dualReadRepository");
const { currentReadContext } = require("./repositoryReadContext");

const VALID_MODES = new Set(["legacy", "shadow", "canary", "final"]);
const parseDomains = (value) => new Set(String(value || "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean));
const routeDomain = (path = "") => {
  if (/^\/api\/(tourism|live-in)(\/|\?|$)/.test(path)) return null;
  if (/^\/api\/auth/.test(path)) return "AUTH";
  if (/^\/api\/users/.test(path)) return "AUTH";
  if (/^\/api\/settings/.test(path)) return "SETTINGS";
  if (/^\/api\/cart/.test(path)) return "CART";
  if (/^\/api\/(checkout|orders)/.test(path)) return "COMMERCE";
  if (/^\/api\/payments/.test(path)) return "PAYMENT";
  if (/^\/api\/(courier|merchant\/delivery|merchant\/orders\/[^/]+\/pickup-confirmation|admin\/delivery)/.test(path)) return "DELIVERY";
  if (/^\/api\/(reviews|my-reviews|merchant\/reviews|admin\/reviews)/.test(path)) return "REVIEW";
  if (/^\/api\/conversations/.test(path)) return "CHAT";
  if (/^\/api\/notifications/.test(path)) return "NOTIFICATION";
  if (/^\/api\/products/.test(path)) return "PRODUCT";
  if (/^\/api\/stores/.test(path)) return "STORE";
  if (/^\/api\/(admin\/finance|users\/[^/]+\/contributions)/.test(path)) return "FINANCE";
  return null;
};
const operationDomain = (domain, operation) => operation.startsWith("commerce.getCart") || operation.startsWith("commerce.ensureCart") || /CartItem/.test(operation) ? "CART" : DOMAIN_NAMES[domain];
const isWrite = (operation) => !READ_METHODS.has(operation) && !operation.endsWith(".health");
const prepareWriteArgs = (operation, values) => {
  const args = [...values];
  if (operation === "chats.markRead" && args[2] == null) args[2] = new Date();
  if (operation === "commerce.updateOrder" && args[1] && args[1].updatedAt == null) args[1] = { ...args[1], updatedAt: new Date() };
  if (operation === "finance.createAdminFeeObligation" && args[0] && args[0].createdAt == null) args[0] = { ...args[0], createdAt: new Date() };
  return args;
};

const isAmbiguousCommit = (error) => Boolean(error?.ambiguousCommit) || ["P1001", "P1002"].includes(error?.code);

function writeRouterConfig(input = {}) {
  const mode = String(input.mode || process.env.FINAL_REPOSITORY_WRITE_MODE || "legacy").toLowerCase();
  if (!VALID_MODES.has(mode)) throw new Error(`Invalid FINAL_REPOSITORY_WRITE_MODE ${mode}`);
  if (mode === "final" && !input.allowFinal) throw new Error("FINAL_REPOSITORY_WRITE_MODE=final is reserved for a later phase");
  const percent = Math.max(0, Math.min(100, Number(input.percent ?? process.env.FINAL_REPOSITORY_WRITE_CANARY_PERCENT ?? 0)));
  return { mode, percent, domains: input.domains || parseDomains(process.env.FINAL_REPOSITORY_WRITE_CANARY_DOMAINS), allowFinal: Boolean(input.allowFinal) };
}

function createWriteMetrics() {
  const events = [];
  return { events, record(event) { events.push({ timestamp: new Date().toISOString(), ...event }); if (events.length > 10000) events.shift(); }, summary() { const writes=events.filter((e)=>e.kind==="write"), mirrors=events.filter((e)=>e.kind==="legacy-mirror"); return { eligibleWrites:writes.length, finalCanonicalCanaryWrites:writes.filter((e)=>e.canarySelected).length, legacyCanonicalWrites:writes.filter((e)=>!e.canarySelected).length, finalWriteSuccess:writes.filter((e)=>e.finalTransactionResult==="SUCCESS").length, finalWriteFailure:writes.filter((e)=>e.finalTransactionResult==="FAILURE").length, legacyMirrorAttempts:mirrors.length, legacyMirrorSuccess:mirrors.filter((e)=>e.legacyMirrorResult==="SUCCESS").length, legacyMirrorNoChange:mirrors.filter((e)=>e.legacyMirrorResult==="NO_CHANGE").length, legacyMirrorDivergence:mirrors.filter((e)=>e.legacyMirrorResult==="DIVERGENCE").length, legacyMirrorFailure:mirrors.filter((e)=>e.legacyMirrorResult==="FAILURE").length, postWriteComparisonMatches:mirrors.filter((e)=>e.comparisonResult==="MATCH").length, postWriteUnexpectedMismatches:mirrors.filter((e)=>e.comparisonResult==="MISMATCH").length }; } };
}

function createRepositoryWriteRouter(legacy, finalRepository, options = {}) {
  const config = writeRouterConfig(options); const metrics = options.metrics || createWriteMetrics();
  const unsafeDomains = new Set(); const unsafeEntities = new Set(); const mirror = options.mirrorSynchronizer;
  const choose = (domain, key) => {
    if (config.mode !== "canary" && config.mode !== "final") return false;
    if (!domain || unsafeDomains.has(domain)) return false;
    if (config.mode === "final") return true;
    if (!config.domains.has(domain)) return false;
    return stableBucket(key || domain) < config.percent;
  };
  const instrumentFinal = (repo, mutations, forcedDomain) => {
    const wrapped = {};
    for (const [domain, methods] of Object.entries(repo)) if (methods && typeof methods === "object") {
      wrapped[domain] = {};
      for (const [method, fn] of Object.entries(methods)) if (typeof fn === "function") {
        const operation = `${domain}.${method}`;
        wrapped[domain][method] = async (...values) => { const args=prepareWriteArgs(operation,values); const result = await fn(...args); if (isWrite(operation)) mutations.push({ domain: forcedDomain || operationDomain(domain, operation), operation, args, result, entityId: result?.id || args[0]?.id || (typeof args[0] === "string" ? args[0] : null) }); return result; };
      }
    }
    wrapped.health = repo.health?.bind(repo); return wrapped;
  };
  const router = { isWriteRouter: true, config, metrics, unsafeDomains, unsafeEntities };
  for (const [domain, methods] of Object.entries(legacy)) if (methods && typeof methods === "object") {
    router[domain] = {};
    for (const [method, legacyMethod] of Object.entries(methods)) if (typeof legacyMethod === "function") {
      const operation = `${domain}.${method}`, finalMethod = finalRepository[domain]?.[method], publicDomain = operationDomain(domain, operation);
      if (!isWrite(operation) || !ELIGIBLE_DOMAINS.has(domain) || typeof finalMethod !== "function") { router[domain][method] = (...args) => legacyMethod(...args); continue; }
      router[domain][method] = async (...values) => {
        const args=prepareWriteArgs(operation,values);
        const context=currentReadContext()||{}, key=context.userId||context.requestId||args.find((v)=>typeof v==="string")||args[0]?.id||operation; const bucket=stableBucket(key); const selected=choose(publicDomain,key);
        if (!selected) { const result=await legacyMethod(...args); metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain:publicDomain,operation,writeMode:config.mode,canarySelected:false,stableBucket:bucket,finalTransactionResult:null,finalDurationMs:null,legacyMirrorResult:null,legacyMirrorDurationMs:null,comparisonResult:"NOT_SELECTED",fallbackSafety:"LEGACY_CANONICAL",errorCode:null}); return result; }
        const started=process.hrtime.bigint(); let result;
        try { result=await finalMethod(...args); metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain:publicDomain,operation,writeMode:config.mode,canarySelected:true,stableBucket:bucket,finalTransactionResult:"SUCCESS",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:"NO_WRITE_FALLBACK",errorCode:null}); }
        catch(error){
          if (isAmbiguousCommit(error) && options.resolveAmbiguousCommit) {
            const resolved = await options.resolveAmbiguousCommit({ error, domain: publicDomain, operation, args, context });
            if (resolved?.committed) {
              result = resolved.result;
              metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain:publicDomain,operation,writeMode:config.mode,canarySelected:true,stableBucket:bucket,finalTransactionResult:"RESOLVED_COMMITTED",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:"NO_WRITE_FALLBACK",errorCode:"AMBIGUOUS_COMMIT_RESOLVED"});
            }
          }
          if (result === undefined) { metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain:publicDomain,operation,writeMode:config.mode,canarySelected:true,stableBucket:bucket,finalTransactionResult:"FAILURE",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:isAmbiguousCommit(error)?"AMBIGUOUS_REQUIRES_LOOKUP":"NO_WRITE_FALLBACK",errorCode:isAmbiguousCommit(error)?"AMBIGUOUS_COMMIT_UNRESOLVED":"FINAL_WRITE_FAILURE"}); throw error; }
        }
        if(mirror?.enabled) await mirror.afterCommit({mutations:[{domain:publicDomain,operation,args,result,entityId:result?.id}],metrics,unsafeDomains,unsafeEntities}); return result;
      };
    }
  }
  router.transaction = async (work) => {
    const context=currentReadContext()||{}, domain=options.transactionDomain || routeDomain(context.path), key=context.userId||context.requestId||context.path||"transaction", selected=choose(domain,key);
    if(!selected) { const value=await legacy.transaction(work); if(domain) metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain,operation:"transaction",writeMode:config.mode,canarySelected:false,stableBucket:stableBucket(key),finalTransactionResult:null,finalDurationMs:null,legacyMirrorResult:null,legacyMirrorDurationMs:null,comparisonResult:"NOT_SELECTED",fallbackSafety:"LEGACY_CANONICAL",errorCode:null}); return value; }
    const mutations=[]; const started=process.hrtime.bigint(); let value;
    try { value=await finalRepository.transaction((tx)=>work(instrumentFinal(tx,mutations,domain))); metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain,operation:"transaction",writeMode:config.mode,canarySelected:true,stableBucket:stableBucket(key),finalTransactionResult:"SUCCESS",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:"NO_WRITE_FALLBACK",errorCode:null}); }
    catch(error){
      if (isAmbiguousCommit(error) && options.resolveAmbiguousCommit) {
        const resolved = await options.resolveAmbiguousCommit({ error, domain, operation: "transaction", mutations, context });
        if (resolved?.committed) { value=resolved.result; mutations.splice(0, mutations.length, ...(resolved.mutations || mutations)); metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain,operation:"transaction",writeMode:config.mode,canarySelected:true,stableBucket:stableBucket(key),finalTransactionResult:"RESOLVED_COMMITTED",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:"NO_WRITE_FALLBACK",errorCode:"AMBIGUOUS_COMMIT_RESOLVED"}); }
      }
      if (value === undefined) { metrics.record({kind:"write",requestId:context.requestId,userId:context.userId,domain,operation:"transaction",writeMode:config.mode,canarySelected:true,stableBucket:stableBucket(key),finalTransactionResult:"FAILURE",finalDurationMs:Number(process.hrtime.bigint()-started)/1e6,fallbackSafety:isAmbiguousCommit(error)?"AMBIGUOUS_REQUIRES_LOOKUP":"NO_WRITE_FALLBACK",errorCode:isAmbiguousCommit(error)?"AMBIGUOUS_COMMIT_UNRESOLVED":"FINAL_WRITE_FAILURE"}); throw error; }
    }
    if(mirror?.enabled&&mutations.length) await mirror.afterCommit({mutations,metrics,unsafeDomains,unsafeEntities}); return value;
  };
  router.health=legacy.health.bind(legacy); return router;
}

module.exports = { createRepositoryWriteRouter, createWriteMetrics, isAmbiguousCommit, isWrite, operationDomain, routeDomain, writeRouterConfig };
