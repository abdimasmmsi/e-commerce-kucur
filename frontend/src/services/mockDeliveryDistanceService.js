// Development-only distance source. Replace this function with GIS/API distance later.
export function getMockStoreDistanceKm(store) {
  const configuredDistance = Number(store?.mockDistanceKm);
  if (Number.isFinite(configuredDistance) && configuredDistance >= 0) return configuredDistance;
  const hash = String(store?.id ?? "store").split("").reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return 3 + (hash % 51) / 10;
}
