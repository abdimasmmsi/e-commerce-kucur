const coordinatesOf = (stop) => {
  const latitude = Number(stop.location?.latitude ?? stop.latitude);
  const longitude = Number(stop.location?.longitude ?? stop.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
};

const heuristicOrder = (startLocation, stops) => {
  const remaining = [...stops].sort((a, b) => String(a.storeId ?? a.orderId).localeCompare(String(b.storeId ?? b.orderId)));
  const ordered = [];
  let cursor = coordinatesOf(startLocation ?? {});
  while (remaining.length) {
    let index = 0;
    if (cursor) {
      let best = Infinity;
      remaining.forEach((stop, candidateIndex) => {
        const point = coordinatesOf(stop);
        if (!point) return;
        const score = (point.latitude - cursor.latitude) ** 2 + (point.longitude - cursor.longitude) ** 2;
        if (score < best) { best = score; index = candidateIndex; }
      });
    } else remaining.sort((a, b) => String(a.storeId ?? a.orderId).localeCompare(String(b.storeId ?? b.orderId)));
    const [next] = remaining.splice(index, 1);
    ordered.push(next);
    cursor = coordinatesOf(next) ?? cursor;
  }
  return ordered.map((stop, index) => ({ ...stop, sequence: index + 1, locationCoordinatesAvailable: Boolean(coordinatesOf(stop)) }));
};

export const optimizePickupRoute = ({ startLocation = null, pickupStops = [] }) => ({ mode: "coordinate-heuristic", disclaimer: "Urutan perkiraan; bukan jaminan rute jalan optimal.", stops: heuristicOrder(startLocation, pickupStops) });
export const optimizeDeliveryRoute = ({ startLocation = null, deliveryStops = [] }) => ({ mode: "coordinate-heuristic", disclaimer: "Urutan perkiraan; bukan jaminan rute jalan optimal.", stops: heuristicOrder(startLocation, deliveryStops) });
