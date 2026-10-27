const toRadians = (degrees) => degrees * Math.PI / 180;

export function calculateCoordinateDistanceKm(sellerCoordinates, customerCoordinates) {
  if (!sellerCoordinates || !customerCoordinates) return 0;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(customerCoordinates.lat - sellerCoordinates.lat);
  const longitudeDelta = toRadians(customerCoordinates.lng - sellerCoordinates.lng);
  const sellerLatitude = toRadians(sellerCoordinates.lat);
  const customerLatitude = toRadians(customerCoordinates.lat);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(sellerLatitude) * Math.cos(customerLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateDeliveryFee({ sellerCoordinates, customerCoordinates, ratePerKm, baseFee = 0, baseKm = 5, mockDistanceKm }) {
  const distanceKm = Number.isFinite(mockDistanceKm)
    ? mockDistanceKm
    : calculateCoordinateDistanceKm(sellerCoordinates, customerCoordinates);
  const roundedDistanceKm = Math.ceil(Math.max(distanceKm, 0));
  const safeRate = Math.max(Number(ratePerKm) || 0, 0);
  return { distanceKm, roundedDistanceKm, ratePerKm: safeRate, deliveryFee: Math.max(Number(baseFee) || 0, 0) + Math.max(roundedDistanceKm - baseKm, 0) * safeRate };
}
