import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { jakartaToday } from "../../utils/deliveryDraft";

// Pengingat keras untuk Admin: draf batch hari ini belum disetujui setelah cutoff.
// Sebelum jam pengingat (Admin Settings) tampil pita kuning; setelahnya pita merah + jendela yang harus dibuka/ditunda.
const SNOOZE_KEY = "kucur:batch-reminder-snooze";
const copyByLanguage = {
  id: { ready: "{count} pesanan hari ini menunggu persetujuan batch.", late: "Segera setujui batch: {count} pesanan belum dijadwalkan, kurir berangkat pukul {time}.", open: "Buka draf batch", title: "Batch pengiriman belum disetujui", text: "{count} pesanan untuk hari ini belum masuk batch. Tanpa persetujuan, pesanan tidak akan diantar kurir pukul {time}.", snooze: "Ingatkan 10 menit lagi" },
  en: { ready: "{count} orders today are waiting for batch approval.", late: "Approve batches now: {count} orders are unscheduled and couriers leave at {time}.", open: "Open batch draft", title: "Delivery batches not approved", text: "{count} orders for today are not in a batch yet. Without approval they will not be delivered at {time}.", snooze: "Remind me in 10 minutes" },
};

export default function DeliveryApprovalReminder() {
  const { formatDate, language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const { pathname } = useLocation();
  const [draft, setDraft] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [snoozedUntil, setSnoozedUntil] = useState(() => { try { return Number(sessionStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; } });

  useEffect(() => {
    let active = true;
    const check = () => { setNow(Date.now()); deliveryApi.drafts(jakartaToday()).then((data) => { if (active) setDraft(data); }).catch(() => {}); };
    check();
    const timer = window.setInterval(check, 120000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pathname]);

  if (!draft || !draft.total || !draft.cutoffPassed || now >= new Date(draft.dispatchAt).getTime()) return null;
  const late = now >= new Date(draft.reminderAt).getTime();
  const time = formatDate(draft.dispatchAt, { hour: "2-digit", minute: "2-digit" });
  const fill = (text) => text.replace("{count}", draft.total).replace("{time}", time);
  const onBatchPage = pathname.startsWith("/admin/delivery-batches");
  const snooze = () => { const until = Date.now() + 600000; setSnoozedUntil(until); try { sessionStorage.setItem(SNOOZE_KEY, String(until)); } catch { /* sessionStorage tidak tersedia */ } };

  return <>
    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold ${late ? "bg-rose-700 text-white" : "bg-[var(--kucur-amber-soft)] text-[var(--kucur-amber-ink)]"}`} role={late ? "alert" : "status"}>
      <span>{fill(late ? copy.late : copy.ready)}</span>
      {!onBatchPage && <Link className={`inline-flex min-h-9 items-center rounded-lg px-3 ${late ? "bg-white text-rose-800" : "bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`} to="/admin/delivery-batches">{copy.open}</Link>}
    </div>
    {late && !onBatchPage && now >= snoozedUntil && <div className="kucur-overlay-in fixed inset-0 z-[950] grid place-items-center bg-slate-950/60 p-4" role="presentation">
      <section className="kucur-dialog-in w-full max-w-md rounded-2xl bg-[var(--kucur-surface)] p-5 text-[var(--kucur-text)] shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="batch-reminder-title">
        <h2 className="text-lg font-extrabold" id="batch-reminder-title">{copy.title}</h2>
        <p className="mt-2 text-[15px] leading-6">{fill(copy.text)}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><button className="min-h-12 rounded-xl border border-[var(--kucur-border-strong)] px-3 font-bold" type="button" onClick={snooze}>{copy.snooze}</button><Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-3 font-bold text-[var(--kucur-on-green)]" to="/admin/delivery-batches">{copy.open}</Link></div>
      </section>
    </div>}
  </>;
}
