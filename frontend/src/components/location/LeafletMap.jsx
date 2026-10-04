import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { KUCUR_MAP_DEFAULT_CENTER, KUCUR_MAP_DEFAULT_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL } from "../../config/mapConfig";

const markerIcon = L.divIcon({ className: "", html: '<span style="display:grid;width:28px;height:28px;place-items:center;border:3px solid white;border-radius:50% 50% 50% 0;background:#166534;box-shadow:0 2px 8px #0005;transform:rotate(-45deg)"><i style="width:7px;height:7px;border-radius:50%;background:white"></i></span>', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -25] });

function MapEvents({ editable, onSelect }) {
  useMapEvents({ click: (event) => { if (editable) onSelect?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  return null;
}

function MapLifecycle({ position }) {
  const map = useMap();
  useEffect(() => { const frame = requestAnimationFrame(() => map.invalidateSize()); return () => cancelAnimationFrame(frame); }, [map]);
  useEffect(() => { if (position) map.setView(position, Math.max(map.getZoom(), 16)); }, [map, position]);
  return null;
}

export default function LeafletMap({ latitude, longitude, label, editable = false, onSelect }) {
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude);
  const position = valid ? [latitude, longitude] : null;
  return <MapContainer className="h-64 w-full max-w-full sm:h-72" center={position ?? KUCUR_MAP_DEFAULT_CENTER} zoom={position ? 16 : KUCUR_MAP_DEFAULT_ZOOM} scrollWheelZoom>
    <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
    <MapEvents editable={editable} onSelect={onSelect} />
    <MapLifecycle position={position} />
    {position && <Marker position={position} icon={markerIcon} draggable={editable} eventHandlers={editable ? { dragend: (event) => { const point = event.target.getLatLng(); onSelect?.({ latitude: point.lat, longitude: point.lng }); } } : undefined}>{label && <Popup><span className="break-words">{label}</span></Popup>}</Marker>}
  </MapContainer>;
}
