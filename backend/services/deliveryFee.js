// Ongkir bertingkat (Steven 2026-10-27): jarak dibulatkan ke atas; sampai 5 km pertama = tarif tetap (deliveryBaseFee),
// tiap km sesudahnya = tarif per km (deliveryRatePerKm). Contoh bawaan: 5 km pertama Rp6.000, lalu Rp1.500/km.
const DELIVERY_BASE_KM = 5;

const money = (value) => { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; };

function computeDeliveryFee(roundedDistanceKm, { deliveryBaseFee, deliveryRatePerKm } = {}) {
  const km = Math.max(0, Math.ceil(Number(roundedDistanceKm) || 0));
  return money(deliveryBaseFee) + Math.max(0, km - DELIVERY_BASE_KM) * money(deliveryRatePerKm);
}

module.exports = { DELIVERY_BASE_KM, computeDeliveryFee };
