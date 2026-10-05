import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { leavePhase } from "../../utils/courierLeave";

const copyByLanguage = {
  id: {
    title: "Cuti", description: "Ajukan cuti kalau kamu tidak bisa mengantar. Cuti baru berlaku setelah disetujui Admin.",
    formTitle: "Ajukan cuti", start: "Mulai", end: "Selesai (opsional)", endHint: "Kosongkan kalau belum tahu kapan kembali.", reason: "Alasan", reasonPlaceholder: "Contoh: sakit, acara keluarga", submit: "Kirim pengajuan",
    sent: "Pengajuan terkirim. Tunggu persetujuan Admin, kamu akan dapat notifikasi.", flow: ["Kamu kirim pengajuan", "Admin menyetujui atau menolak", "Selama cuti disetujui, kamu tidak dapat pengiriman"],
    history: "Riwayat cuti", empty: "Belum pernah mengajukan cuti", emptyHint: "Pengajuan cuti kamu akan tampil di sini.",
    status: { pending: "Menunggu Admin", approved: "Disetujui", running: "Sedang cuti", done: "Selesai", rejected: "Ditolak", cancelled: "Dibatalkan" },
    until: "sampai", open: "belum ditentukan", rejectedReason: "Alasan ditolak", cancel: "Batalkan pengajuan", endNow: "Akhiri cuti sekarang", noReason: "Tanpa alasan",
    current: "Kamu sedang cuti. Kamu tidak akan mendapat pengiriman sampai cuti selesai.", waiting: "Ada pengajuan cuti yang menunggu persetujuan Admin.",
  },
  en: {
    title: "Leave", description: "Request leave when you cannot deliver. Leave only applies after an Admin approves it.",
    formTitle: "Request leave", start: "Start", end: "End (optional)", endHint: "Leave empty if you do not know when you will return.", reason: "Reason", reasonPlaceholder: "Example: sick, family event", submit: "Send request",
    sent: "Request sent. Wait for Admin approval; you will get a notification.", flow: ["You send a request", "Admin approves or rejects it", "While leave is approved, you get no deliveries"],
    history: "Leave history", empty: "No leave requests yet", emptyHint: "Your leave requests will appear here.",
    status: { pending: "Waiting for Admin", approved: "Approved", running: "On leave", done: "Finished", rejected: "Rejected", cancelled: "Cancelled" },
    until: "until", open: "not set", rejectedReason: "Rejection reason", cancel: "Cancel request", endNow: "End leave now", noReason: "No reason",
    current: "You are on leave. You will not get deliveries until it ends.", waiting: "A leave request is waiting for Admin approval.",
  },
};
const badgeTone = { pending: "pending", approved: "confirmed", running: "active", done: "completed", rejected: "rejected", cancelled: "inactive" };
const inputClass = "min-h-12 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]";

export default function Availability() {
  const { formatDate, language, t } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ startAt: "", endAt: "", reason: "" });
  const [state, setState] = useState({ loading: true, busy: false, error: "", notice: "" });
  const load = useCallback(async () => {
    try { setRows(await deliveryApi.availability()); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, loading: false })); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const running = useMemo(() => rows.find((row) => leavePhase(row) === "running"), [rows]);
  const pending = useMemo(() => rows.some((row) => row.status === "pending"), [rows]);
  const when = (value) => formatDate(value, { dateStyle: "medium", timeStyle: "short" });
  const submit = async (event) => {
    event.preventDefault();
    setState((value) => ({ ...value, busy: true, error: "", notice: "" }));
    try {
      await deliveryApi.unavailable({ startAt: new Date(form.startAt).toISOString(), endAt: form.endAt ? new Date(form.endAt).toISOString() : null, reason: form.reason });
      setForm({ startAt: "", endAt: "", reason: "" });
      setState((value) => ({ ...value, notice: copy.sent }));
      await load();
    } catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: false })); }
  };
  const endPeriod = async (id) => {
    setState((value) => ({ ...value, busy: true, error: "", notice: "" }));
    try { await deliveryApi.endUnavailable(id); await load(); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: false })); }
  };

  return <div className="page-container min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.courierEyebrow")} title={copy.title} description={copy.description}/>
    {state.error && <p className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</p>}
    {state.notice && <p className="mb-4 rounded-xl bg-[var(--kucur-green-soft)] p-4 text-[15px] font-semibold text-[var(--kucur-text)]" role="status">{state.notice}</p>}
    {running && <p className="mb-4 rounded-xl bg-[var(--kucur-amber-soft)] p-4 text-[15px] font-semibold text-[var(--kucur-amber-ink)]">{copy.current}</p>}
    {!running && pending && !state.notice && <p className="mb-4 rounded-xl bg-[var(--kucur-amber-soft)] p-4 text-[15px] font-semibold text-[var(--kucur-amber-ink)]">{copy.waiting}</p>}
    {state.loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={3}/> : <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)] lg:items-start">
      <form className="grid gap-4 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" onSubmit={submit}>
        <h2 className="text-lg font-extrabold">{copy.formTitle}</h2>
        <ol className="grid gap-1.5 text-sm text-[var(--kucur-text-muted)]">{copy.flow.map((step, index) => <li className="flex items-start gap-2.5" key={step}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--kucur-green-soft)] text-xs font-extrabold text-[var(--kucur-green-ink)]">{index + 1}</span><span className="pt-0.5">{step}</span></li>)}</ol>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[15px] font-semibold">{copy.start}<input className={inputClass} type="datetime-local" required value={form.startAt} onChange={(event) => setForm((value) => ({ ...value, startAt: event.target.value }))}/></label>
          <label className="grid gap-1.5 text-[15px] font-semibold">{copy.end}<input className={inputClass} type="datetime-local" min={form.startAt || undefined} value={form.endAt} onChange={(event) => setForm((value) => ({ ...value, endAt: event.target.value }))}/><span className="text-[13px] font-normal text-[var(--kucur-text-muted)]">{copy.endHint}</span></label>
        </div>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.reason}<textarea className={`${inputClass} min-h-24 resize-y py-3`} required maxLength="255" placeholder={copy.reasonPlaceholder} value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))}/></label>
        <Button className="w-full sm:w-auto sm:justify-self-start" disabled={state.busy || !form.startAt || !form.reason.trim()} type="submit">{copy.submit}</Button>
      </form>
      <section className="min-w-0 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]">
        <h2 className="px-4 pb-2 pt-4 text-lg font-extrabold sm:px-5">{copy.history}</h2>
        {rows.length ? <ul>{rows.map((row) => { const phase = leavePhase(row); return <li className="grid min-w-0 gap-2 border-t border-[var(--kucur-border)] px-4 py-3.5 sm:px-5" key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 break-words text-[15px]">{when(row.startAt)}</strong><StatusBadge status={badgeTone[phase]}>{copy.status[phase]}</StatusBadge></div>
          <span className="text-sm text-[var(--kucur-text-muted)]">{copy.until} {row.endAt ? when(row.endAt) : copy.open}</span>
          <p className="break-words text-[15px]">{row.reason || copy.noReason}</p>
          {row.status === "rejected" && row.rejectionReason && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"><b>{copy.rejectedReason}:</b> {row.rejectionReason}</p>}
          {(phase === "pending" || phase === "approved") && <Button className="justify-self-start" variant="secondary" disabled={state.busy} onClick={() => void endPeriod(row.id)}>{copy.cancel}</Button>}
          {phase === "running" && <Button className="justify-self-start" variant="secondary" disabled={state.busy} onClick={() => void endPeriod(row.id)}>{copy.endNow}</Button>}
        </li>; })}</ul> : <div className="p-4"><EmptyState title={copy.empty} description={copy.emptyHint}/></div>}
      </section>
    </div>}
  </div>;
}
