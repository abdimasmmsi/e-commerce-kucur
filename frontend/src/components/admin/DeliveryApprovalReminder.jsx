import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { jakartaToday } from "../../utils/deliveryDraft";
import { useLiveRefresh } from "../../utils/liveRefresh";

// Pengingat keras untuk Admin: draf batch hari ini belum disetujui setelah cutoff.
// Sebelum jam pengingat (Admin Settings) tampil pita kuning; setelahnya pita merah + jendela yang harus dibuka/ditunda.
const SNOOZE_KEY = "kucur:batch-reminder-snooze";
// Pita yang ditutup (×) disembunyikan sampai keadaannya berubah: jumlah pesanan berubah atau berubah jadi merah.
const DISMISS_KEY = "kucur:batch-reminder-dismissed";
const copyByLanguage = {
  id: { ready: "{count} pesanan hari ini menunggu persetujuan jadwal.", late: "Segera setujui jadwal: {count} pesanan belum dijadwalkan, kurir berangkat pukul {time}.", open: "Buka draf jadwal", title: "Jadwal pengiriman belum disetujui", text: "{count} pesanan untuk hari ini belum masuk jadwal. Tanpa persetujuan, pesanan tidak akan diantar kurir pukul {time}.", snooze: "Ingatkan 10 menit lagi", dismiss: "Tutup pengingat" },
  en: { ready: "{count} orders today are waiting for schedule approval.", late: "Approve schedules now: {count} orders are unscheduled and couriers leave at {time}.", open: "Open schedule draft", title: "Delivery schedules not approved", text: "{count} orders for today are not in a schedule yet. Without approval they will not be delivered at {time}.", snooze: "Remind me in 10 minutes", dismiss: "Close reminder" },
};

export default function DeliveryApprovalReminder() {
  const { formatDate, language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const { pathname } = useLocation();
  const [draft, setDraft] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [snoozedUntil, setSnoozedUntil] = useState(() => { try { return Number(sessionStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; } });
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(DISMISS_KEY) || ""; } catch { return ""; } });

  const check = useCallback(() => deliveryApi.drafts(jakartaToday()).then((data) => { setNow(Date.now()); setDraft(data); }).catch(() => {}), []);
  // Muat saat masuk/pindah halaman, lalu segar otomatis lewat event data, tab aktif, dan polling cadangan.
  useEffect(() => { void check(); }, [pathname, check]);
  useLiveRefresh(check);

  if (!draft || !draft.total || !draft.cutoffPassed || now >= new Date(draft.dispatchAt).getTime()) return null;
  const late = now >= new Date(draft.reminderAt).getTime();
  const time = formatDate(draft.dispatchAt, { hour: "2-digit", minute: "2-digit" });
  const fill = (text) => text.replace("{count}", draft.total).replace("{time}", time);
  const onBatchPage = pathname.startsWith("/admin/delivery-batches");
  const signature = `${draft.deliveryDate}:${draft.total}:${late ? "late" : "ready"}`;
  const dismiss = () => { setDismissed(signature); try { sessionStorage.setItem(DISMISS_KEY, signature); } catch { /* sessionStorage tidak tersedia */ } };
  const snooze = () => { const until = Date.now() + 600000; setSnoozedUntil(until); try { sessionStorage.setItem(SNOOZE_KEY, String(until)); } catch { /* sessionStorage tidak tersedia */ } };

  return <>
    {dismissed !== signature && <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold ${late ? "bg-rose-700 text-white" : "bg-[var(--kucur-amber-soft)] text-[var(--kucur-amber-ink)]"}`} aria-live={late ? "assertive" : "polite"}>
      <span className="min-w-0 flex-1">{fill(late ? copy.late : copy.ready)}</span>
      {!onBatchPage && <Link className={`inline-flex min-h-9 items-center rounded-lg px-3 ${late ? "bg-white text-rose-800" : "bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`} to="/admin/delivery-batches">{copy.open}</Link>}
      <button className={`grid size-9 shrink-0 place-items-center rounded-lg ${late ? "hover:bg-white/15" : "hover:bg-black/5"}`} type="button" data-no-busy aria-label={copy.dismiss} title={copy.dismiss} onClick={dismiss}><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>}
    {late && !onBatchPage && now >= snoozedUntil && <div className="kucur-overlay-in fixed inset-0 z-[950] grid place-items-center bg-slate-950/60 p-4" role="presentation">
      <section className="kucur-dialog-in w-full max-w-md rounded-2xl bg-[var(--kucur-surface)] p-5 text-[var(--kucur-text)] shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="batch-reminder-title">
        <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold" id="batch-reminder-title">{copy.title}</h2><button className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-lg text-[var(--kucur-text-muted)] hover:bg-[var(--kucur-surface-elevated)]" type="button" data-no-busy aria-label={copy.snooze} title={copy.snooze} onClick={snooze}><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <p className="mt-2 text-[15px] leading-6">{fill(copy.text)}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><button className="min-h-12 rounded-xl border border-[var(--kucur-border-strong)] px-3 font-bold" type="button" onClick={snooze}>{copy.snooze}</button><Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-3 font-bold text-[var(--kucur-on-green)]" to="/admin/delivery-batches">{copy.open}</Link></div>
      </section>
    </div>}
  </>;
}
