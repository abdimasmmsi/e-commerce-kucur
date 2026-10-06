import { useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { currentPushSubscription, disablePush, enablePush, pushSupported } from "../utils/pushClient";

const copyByLanguage = {
  id: { title: "Notifikasi di HP", description: "Dapat pemberitahuan pesanan & chat walau aplikasi sedang tertutup.", on: "Aktif", off: "Nonaktif", turnOn: "Nyalakan", turnOff: "Matikan", denied: "Izin notifikasi ditolak. Buka pengaturan browser untuk mengizinkan.", unavailable: "Notifikasi HP belum disiapkan pengelola.", unsupported: "Browser ini belum mendukung notifikasi HP. Pasang aplikasi Kucur ke layar utama lalu coba lagi.", failed: "Gagal mengubah notifikasi. Coba lagi." },
  en: { title: "Phone notifications", description: "Get order and chat alerts even when the app is closed.", on: "On", off: "Off", turnOn: "Turn on", turnOff: "Turn off", denied: "Notification permission was blocked. Allow it in your browser settings.", unavailable: "Phone notifications have not been set up by the managers yet.", unsupported: "This browser does not support phone notifications. Add Kucur to your home screen and try again.", failed: "Could not change notifications. Please try again." },
};

// Baris pengaturan untuk menyalakan/mematikan notifikasi push di perangkat ini.
export default function PushToggle({ className = "account-preference-row" }) {
  const { language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const supported = pushSupported();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!supported) return undefined;
    let active = true;
    currentPushSubscription().then((subscription) => { if (active) setEnabled(Boolean(subscription) && Notification.permission === "granted"); }).catch(() => {});
    return () => { active = false; };
  }, [supported]);
  const toggle = async () => {
    setBusy(true); setNote("");
    try {
      if (enabled) { await disablePush(); setEnabled(false); }
      else {
        const result = await enablePush();
        setEnabled(result === "on");
        if (result !== "on") setNote(copy[result]);
      }
    } catch { setNote(copy.failed); }
    finally { setBusy(false); }
  };
  return <div className={className}>
    <div><strong>{copy.title}</strong><small>{supported ? copy.description : copy.unsupported}</small>{note && <small className="font-semibold text-rose-700 dark:text-rose-300" role="status">{note}</small>}</div>
    {supported && <button className={`inline-flex min-h-11 min-w-[124px] items-center justify-center gap-2 justify-self-end rounded-xl border px-4 text-sm font-bold ${enabled ? "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]" : "border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-on-green)]"}`} type="button" aria-pressed={enabled} disabled={busy} onClick={toggle}>
      {enabled && <i className="size-2 rounded-full bg-[var(--kucur-green)]" aria-hidden="true"/>}{enabled ? copy.turnOff : copy.turnOn}<span className="sr-only">{` (${enabled ? copy.on : copy.off})`}</span>
    </button>}
  </div>;
}
