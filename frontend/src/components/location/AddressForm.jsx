import LocationPicker from "./LocationPicker";
import { usePreferences } from "../../context/PreferencesContext";

// Form alamat pengiriman: penerima + pemilih lokasi yang sama dengan form daftar lapak.
export default function AddressForm({ value, onChange }) {
  const { language } = usePreferences();
  const copy = language === "id"
    ? { recipient: "Nama penerima", phone: "Nomor HP penerima", label: "Label alamat (mis. Rumah, Kantor)", address: "Alamat lengkap dan patokan" }
    : { recipient: "Recipient name", phone: "Recipient phone", label: "Address label (e.g. Home, Office)", address: "Full address and landmark" };
  const update = (changes) => onChange({ ...value, ...changes });
  const fieldClass = "min-h-12 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]";
  return <div className="grid min-w-0 gap-3">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1.5 text-[15px] font-semibold">{copy.recipient}<input className={fieldClass} autoComplete="name" value={value.recipientName ?? ""} onChange={(event) => update({ recipientName: event.target.value })} /></label>
      <label className="grid min-w-0 gap-1.5 text-[15px] font-semibold">{copy.phone}<input className={fieldClass} type="tel" inputMode="tel" autoComplete="tel" value={value.phone ?? ""} onChange={(event) => update({ phone: event.target.value })} placeholder="08xxxxxxxxxx" /></label>
    </div>
    <LocationPicker value={value} onChange={(location) => update({ label: location.label ?? "", address: location.address ?? "", latitude: location.latitude, longitude: location.longitude })} labelTitle={copy.label} addressTitle={copy.address} />
  </div>;
}
