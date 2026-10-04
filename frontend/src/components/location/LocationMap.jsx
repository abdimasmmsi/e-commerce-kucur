import LeafletMap from "./LeafletMap";
import { hasCoordinates, normalizeLocation } from "../../utils/location";

export default function LocationMap({ location, title = "Lokasi" }) {
  const normalized = normalizeLocation(location);
  return <section className="grid min-w-0 gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4"><div><h2 className="font-bold text-[var(--kucur-text)]">{title}</h2>{normalized.label && <strong className="mt-1 block break-words text-sm">{normalized.label}</strong>}{normalized.address && <p className="mt-1 break-words text-sm text-[var(--kucur-text-muted)]">{normalized.address}</p>}</div>{hasCoordinates(normalized) ? <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--kucur-border-strong)]"><LeafletMap latitude={normalized.latitude} longitude={normalized.longitude} label={normalized.label || title} /></div> : <p className="rounded-xl bg-[var(--kucur-surface-elevated)] p-3 text-sm text-[var(--kucur-text-muted)]">Lokasi peta belum ditambahkan.</p>}</section>;
}
