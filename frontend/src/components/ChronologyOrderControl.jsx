import { usePreferences } from "../context/PreferencesContext";
import "./ChronologyOrderControl.css";

function ChronologyOrderControl({ value, onChange, label }) {
  const { language } = usePreferences();
  const copy = language === "id" ? { label: "Urutan", asc: "Terlama → Terbaru", desc: "Terbaru → Terlama" } : { label: "Order", asc: "Oldest → Newest", desc: "Newest → Oldest" };
  const text = label ?? copy.label;
  return <label className="chronology-order-control"><span>{text}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={text}><option value="asc">{copy.asc}</option><option value="desc">{copy.desc}</option></select></label>;
}

export default ChronologyOrderControl;
