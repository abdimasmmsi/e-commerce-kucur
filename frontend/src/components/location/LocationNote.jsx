import { useEffect, useState } from "react";
import { apiData } from "../../services/apiClient";
import { usePreferences } from "../../context/PreferencesContext";

const cache = new Map();

// Nama tempat dari peta (OpenStreetMap lewat backend). Gagal atau tidak ada nama berarti tidak ditampilkan.
function usePlaceName(latitude, longitude) {
  const key = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) ? `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}` : "";
  const [state, setState] = useState({ key: "", name: null });
  useEffect(() => {
    if (!key || cache.has(key)) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiData(`/api/geo/reverse?latitude=${Number(latitude)}&longitude=${Number(longitude)}`)
        .then((data) => { const name = data?.placeName || null; cache.set(key, name); if (!cancelled) setState({ key, name }); })
        .catch(() => { if (!cancelled) setState({ key, name: null }); });
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [key, latitude, longitude]);
  if (!key) return null;
  return cache.has(key) ? cache.get(key) : state.key === key ? state.name : null;
}

/** Koordinat titik antar (+ akurasi GPS bila ada) dan nama tempat menurut peta bila tersedia. */
export default function LocationNote({ latitude, longitude, accuracy }) {
  const { t } = usePreferences();
  const lat = Number(latitude); const lng = Number(longitude);
  const placeName = usePlaceName(lat, lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return <span className="mt-1 grid min-w-0 gap-0.5 text-sm text-[var(--kucur-text-muted)]">
    <span className="break-words">{t("locationNote.coordinates", { latitude: lat.toFixed(6), longitude: lng.toFixed(6) })}{Number.isFinite(Number(accuracy)) && accuracy > 0 ? ` · ${t("locationNote.accuracy", { meters: Math.round(accuracy) })}` : ""}</span>
    {placeName && <span className="break-words font-semibold text-[var(--kucur-text)]">{t("locationNote.place", { name: placeName })}</span>}
  </span>;
}
