import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { KUCUR_MAP_DEFAULT_CENTER, KUCUR_MAP_DEFAULT_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from "../../config/mapConfig";
import { normalizeLocation } from "../../utils/location";

function FitStops({ points }) {
  const map = useMap();
  useEffect(() => { window.requestAnimationFrame(() => { map.invalidateSize(); if (points.length === 1) map.setView(points[0].position, KUCUR_MAP_DEFAULT_ZOOM); if (points.length > 1) map.fitBounds(points.map((point) => point.position), { padding: [28, 28], maxZoom: 16 }); }); }, [map, points]);
  return null;
}

const markerIcon = (sequence) => L.divIcon({ className: "", html: `<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid white;border-radius:9999px;background:#166534;color:white;font:700 13px system-ui;box-shadow:0 2px 8px #0004">${sequence}</span>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });

export default function RouteStopsMap({ stops = [], title = "Peta Titik Rute" }) {
  const points = useMemo(() => stops.map((stop, index) => { const location = normalizeLocation(stop.location, { label: stop.storeName ?? stop.recipientName ?? stop.orderNumber, address: stop.address }); return Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? { stop, location, sequence: stop.sequence ?? index + 1, position: [location.latitude, location.longitude] } : null; }).filter(Boolean), [stops]);
  const unavailable = stops.length - points.length;
  return <section className="mb-4 min-w-0 rounded-kucur-card border border-[var(--kucur-border)] bg-kucur-paper p-4 sm:p-5"><div className="mb-3"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--kucur-text-muted)]">Marker menunjukkan urutan data yang tersedia, bukan garis navigasi atau jaminan rute jalan optimal.</p></div>{points.length ? <div className="h-64 min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--kucur-border)] sm:h-80"><MapContainer center={points[0]?.position ?? KUCUR_MAP_DEFAULT_CENTER} zoom={KUCUR_MAP_DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom><TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />{points.map((point) => <Marker key={`${point.sequence}-${point.stop.storeId ?? point.stop.orderId}`} position={point.position} icon={markerIcon(point.sequence)}><Popup><strong>{point.location.label || `Titik ${point.sequence}`}</strong>{point.location.address && <><br />{point.location.address}</>}</Popup></Marker>)}<FitStops points={points} /></MapContainer></div> : <p className="rounded-xl bg-[var(--kucur-surface-elevated)] p-3 text-sm text-[var(--kucur-text-muted)]">Belum ada stop dengan pasangan koordinat yang valid. Daftar alamat tetap dapat digunakan.</p>}{unavailable > 0 && <p className="mt-2 text-sm text-amber-800">{unavailable} stop belum memiliki koordinat dan tidak ditampilkan pada peta.</p>}</section>;
}
