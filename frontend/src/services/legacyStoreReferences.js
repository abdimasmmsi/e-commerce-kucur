// Explicit compatibility registry for prototype domains that still store legacy Store IDs.
// No runtime name matching and no localStorage rewriting are performed here.
const legacyToCanonical = Object.freeze({
  "1": "10000000-0000-4000-8000-000000000001",
  "4": "10000000-0000-4000-8000-000000000002",
});
const canonicalToLegacy = Object.freeze(Object.fromEntries(Object.entries(legacyToCanonical).map(([legacy, canonical]) => [canonical, legacy])));

export const canonicalStoreId = (reference) => legacyToCanonical[String(reference)] ?? String(reference);
export const legacyStoreId = (reference) => canonicalToLegacy[String(reference)] ?? String(reference);
export const hasLegacyStoreReference = (reference) => Object.hasOwn(legacyToCanonical, String(reference));
