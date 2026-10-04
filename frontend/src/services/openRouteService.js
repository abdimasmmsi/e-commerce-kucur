const OPENROUTESERVICE_API_KEY = import.meta.env.VITE_OPENROUTESERVICE_API_KEY?.trim();

export const isOpenRouteServiceConfigured = Boolean(
  OPENROUTESERVICE_API_KEY && !OPENROUTESERVICE_API_KEY.startsWith("masukkan_"),
);

export async function getDrivingDistanceKm(origin, destination, signal) {
  if (!isOpenRouteServiceConfigured) return null;
  const coordinates = [origin?.lng, origin?.lat, destination?.lng, destination?.lat];
  if (!coordinates.every(Number.isFinite)) return null;

  const params = new URLSearchParams({
    api_key: OPENROUTESERVICE_API_KEY,
    start: `${origin.lng},${origin.lat}`,
    end: `${destination.lng},${destination.lat}`,
  });
  try {
    const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?${params}`, { signal });
    if (!response.ok) return null;
    const payload = await response.json();
    const distanceMeters = Number(payload.features?.[0]?.properties?.segments?.[0]?.distance);
    return Number.isFinite(distanceMeters) && distanceMeters >= 0 ? distanceMeters / 1000 : null;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return null;
  }
}
