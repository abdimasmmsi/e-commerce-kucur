// GPS untuk alamat pengiriman: hanya lokasi TEPAT yang diterima.
// "Lokasi perkiraan" (approximate) di Android/iPhone bisa meleset 1–3 km sehingga kurir salah antar.
// Website tidak bisa memaksa pilihan izin HP, jadi akurasi dicek di sini dan lokasi kasar ditolak.
export const MAX_LOCATION_ACCURACY_M = 100;

// Ambil posisi terbaik selama maks. `timeoutMs`; selesai lebih cepat begitu akurasinya cukup.
// Resolve { latitude, longitude, accuracy }; reject Error dengan .reason: "unsupported" | "denied" | "imprecise" | "unavailable".
export function getPreciseLocation({ timeoutMs = 10000, maxAccuracy = MAX_LOCATION_ACCURACY_M } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (reason, accuracy) => reject(Object.assign(new Error(reason), { reason, accuracy }));
    if (!navigator.geolocation) { fail("unsupported"); return; }
    let best = null;
    let done = false;
    const finish = (callback) => { if (done) return; done = true; navigator.geolocation.clearWatch(watchId); clearTimeout(timer); callback(); };
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (!best || coords.accuracy < best.accuracy) best = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
        if (best.accuracy <= maxAccuracy) finish(() => resolve(best));
      },
      (error) => finish(() => fail(error.code === 1 ? "denied" : best ? "imprecise" : "unavailable", best?.accuracy)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
    const timer = setTimeout(() => finish(() => (best ? fail("imprecise", best.accuracy) : fail("unavailable"))), timeoutMs);
  });
}
