import { useState } from "react";
import LeafletMap from "./LeafletMap";
import { normalizeLocation, validateLocationCoordinates } from "../../utils/location";
import { getPreciseLocation } from "../../utils/geolocation";
import { inServiceArea } from "../../utils/serviceArea";
import { usePreferences } from "../../context/PreferencesContext";

export default function LocationPicker({ value, onChange, labelTitle = "Nama lokasi", addressTitle = "Alamat / deskripsi lokasi" }) {
  const { t } = usePreferences();
  const location = { ...normalizeLocation(value), ...(value && typeof value === "object" ? value : {}) };
  const [geoMessage, setGeoMessage] = useState("");
  const coordinateError = validateLocationCoordinates(location);
  const update = (changes) => onChange({ ...location, ...changes });
  const selectPoint = ({ latitude, longitude }) => { if (!inServiceArea(latitude, longitude)) { setGeoMessage(t("locationPicker.outOfArea")); return false; } update({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) }); setGeoMessage(""); return true; };
  // Hanya lokasi tepat (±100 m) yang diterima; lokasi perkiraan HP ditolak supaya titik alamat tidak meleset.
  const useMyLocation = () => {
    setGeoMessage(t("locationPicker.locating"));
    getPreciseLocation()
      .then((coords) => { if (selectPoint(coords)) setGeoMessage(t("locationPicker.applied")); })
      .catch((error) => setGeoMessage(error.reason === "unsupported" ? t("locationPicker.unsupported") : error.reason === "imprecise" ? t("locationPicker.imprecise", { meters: Math.round(error.accuracy ?? 0) }) : t("locationPicker.unavailable")));
  };
  const parsedLatitude = Number(location.latitude); const parsedLongitude = Number(location.longitude);
  const mapLatitude = Number.isFinite(parsedLatitude) && parsedLatitude >= -90 && parsedLatitude <= 90 && location.latitude != null && location.latitude !== "" ? parsedLatitude : null;
  const mapLongitude = Number.isFinite(parsedLongitude) && parsedLongitude >= -180 && parsedLongitude <= 180 && location.longitude != null && location.longitude !== "" ? parsedLongitude : null;
  return <section className="col-span-full grid min-w-0 gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface-elevated)] p-4">
    <div><h2 className="font-bold text-[var(--kucur-text)]">{t("locationPicker.title")}</h2><p className="mt-1 text-sm text-[var(--kucur-text-muted)]">{t("locationPicker.hint")}</p></div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-sm font-semibold"><span>{labelTitle}</span><input className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" value={location.label ?? ""} onChange={(event) => update({ label: event.target.value })} /></label><label className="grid min-w-0 gap-1.5 text-sm font-semibold"><span>{addressTitle}</span><textarea className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" rows="2" value={location.address ?? ""} onChange={(event) => update({ address: event.target.value })} /></label></div>
    {coordinateError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{coordinateError}</p>}
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)]"><LeafletMap latitude={mapLatitude} longitude={mapLongitude} label={location.label} editable onSelect={selectPoint} /></div>
    {mapLatitude === null || mapLongitude === null ? <p className="text-sm text-[var(--kucur-text-muted)]">{t("locationPicker.noPoint")}</p> : <p className="break-words text-sm font-medium text-emerald-800 dark:text-emerald-300">{t("locationPicker.coordinates", { latitude: mapLatitude.toFixed(6), longitude: mapLongitude.toFixed(6) })}</p>}
    {geoMessage && <p className="text-sm text-[var(--kucur-text-muted)]" role="status">{geoMessage}</p>}
    <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-xl border border-[var(--kucur-green)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-green-ink)]" type="button" onClick={useMyLocation}>{t("locationPicker.useMine")}</button><button className="min-h-11 rounded-xl border border-rose-200 bg-[var(--kucur-surface)] px-4 text-sm font-bold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300" type="button" onClick={() => update({ latitude: null, longitude: null })} disabled={mapLatitude === null && mapLongitude === null}>{t("locationPicker.clear")}</button></div>
    <details className="rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">{t("locationPicker.manual")}</summary><div className="grid min-w-0 gap-3 pb-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-sm font-semibold"><span>{t("locationPicker.latitude")}</span><input className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" type="number" step="any" value={location.latitude ?? ""} onChange={(event) => update({ latitude: event.target.value })} placeholder={t("locationPicker.optional")} /></label><label className="grid min-w-0 gap-1.5 text-sm font-semibold"><span>{t("locationPicker.longitude")}</span><input className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" type="number" step="any" value={location.longitude ?? ""} onChange={(event) => update({ longitude: event.target.value })} placeholder={t("locationPicker.optional")} /></label></div></details>
  </section>;
}
