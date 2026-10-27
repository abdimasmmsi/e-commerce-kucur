// Area layanan: Jawa Timur dulu. Harus sama dengan backend/validation/serviceArea.js (backend tetap penentu).
export const SERVICE_AREA = Object.freeze({ south: -8.85, north: -6.7, west: 110.85, east: 114.7 });

export const inServiceArea = (latitude, longitude) => Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
  && Number(latitude) >= SERVICE_AREA.south && Number(latitude) <= SERVICE_AREA.north && Number(longitude) >= SERVICE_AREA.west && Number(longitude) <= SERVICE_AREA.east;

// Batas untuk Leaflet: peta tidak bisa digeser keluar Jawa Timur.
export const SERVICE_AREA_BOUNDS = [[SERVICE_AREA.south, SERVICE_AREA.west], [SERVICE_AREA.north, SERVICE_AREA.east]];
