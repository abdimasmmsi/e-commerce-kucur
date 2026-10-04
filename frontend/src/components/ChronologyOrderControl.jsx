import "./ChronologyOrderControl.css";

function ChronologyOrderControl({ value, onChange, label = "Urutan" }) {
  return <label className="chronology-order-control"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${label} kronologis`}><option value="asc">Terlama → Terbaru</option><option value="desc">Terbaru → Terlama</option></select></label>;
}

export default ChronologyOrderControl;
