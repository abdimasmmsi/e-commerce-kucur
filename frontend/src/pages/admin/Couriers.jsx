import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { leavePhase, leaveErrorText, toLocalInputValue } from "../../utils/courierLeave";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { paginate } from "../../utils/pagination";
import { whatsappLink } from "../../utils/whatsapp";

const PAGE_SIZE = 12;
const copyByLanguage = {
  id: { title: "Kurir", description: "Pantau kurir, kapasitas, dan pengajuan cuti.", search: "Cari nama, email, atau telepon", loading: "Memuat daftar kurir", error: "Daftar kurir gagal dimuat", empty: "Kurir tidak ditemukan", emptyHint: "Belum ada kurir yang sesuai dengan pencarian ini.", active: "Aktif", inactive: "Tidak aktif", onLeave: "Sedang cuti", capacity: "Kapasitas aktif", detail: "Lihat detail",
    leaveTitle: "Pengajuan cuti", waitingTab: "Menunggu", historyTab: "Riwayat", noPending: "Tidak ada pengajuan cuti yang menunggu.", noHistory: "Belum ada riwayat cuti.", until: "sampai", open: "belum ditentukan", approve: "Setujui", reject: "Tolak", plannedWarning: "{count} jadwal pengiriman kurir ini jatuh di masa cuti. Pindahkan pesanannya di Jadwal Pengiriman setelah menyetujui.",
    approveTitle: "Setujui cuti?", approveText: "Selama cuti, kurir ini tidak akan mendapat jadwal pengiriman baru. Kurir akan menerima notifikasi.", rejectTitle: "Tolak cuti?", rejectText: "Alasan penolakan akan dikirim ke kurir.", rejectReason: "Alasan penolakan", cancel: "Kembali", requestedAt: "Diajukan", reasonLabel: "Alasan", rejectedReason: "Alasan ditolak",
    status: { pending: "Menunggu", approved: "Disetujui", running: "Sedang cuti", done: "Selesai", rejected: "Ditolak", cancelled: "Dibatalkan" },
    add: "+ Tambah kurir", addTitle: "Tambah akun kurir", addText: "Akun dibuat dengan kata sandi awal yang sama untuk semua kurir baru. Kurir wajib menggantinya saat pertama masuk.", fullName: "Nama lengkap", email: "Email", phone: "Nomor WhatsApp", capacity2: "Kapasitas pengiriman aktif", create: "Buat akun", creating: "Membuat...", createdTitle: "Akun kurir dibuat", createdText: "Berikan data masuk ini ke kurir. Setelah masuk, kurir akan diminta mengganti kata sandi.", password: "Kata sandi awal", copy: "Salin data masuk", copied: "Tersalin", sendWa: "Kirim lewat WhatsApp", close: "Selesai", waMessage: "Halo {name}, akun kurir Kucur kamu sudah dibuat.\nEmail: {email}\nKata sandi awal: {password}\nMasuk di {url} lalu ganti kata sandi.",
    recordLeave: "Catat cuti", recordTitle: "Catat cuti untuk {name}", recordText: "Untuk kurir yang tidak bisa mengajukan sendiri. Cuti langsung berlaku tanpa persetujuan lagi, dan kurir akan menerima notifikasi.", start: "Mulai", end: "Selesai (opsional)", endHint: "Kosongkan kalau belum tahu kapan kurir kembali.", reasonPlaceholder: "Contoh: sakit, acara keluarga", save: "Simpan cuti", startPast: "Tanggal mulai tidak boleh sebelum waktu sekarang.", endBeforeStart: "Waktu selesai harus setelah waktu mulai.", recorded: "Cuti untuk {name} sudah dicatat.",
    endLeave: "Akhiri cuti", cancelLeave: "Batalkan cuti", endTitle: "Akhiri cuti sekarang?", endText: "Kurir kembali bertugas mulai sekarang dan bisa mendapat jadwal pengiriman. Kurir akan menerima notifikasi.", cancelTitle: "Batalkan cuti ini?", cancelText: "Cuti yang belum dimulai ini dibatalkan. Kurir akan menerima notifikasi.", ended: "Cuti {name} sudah diakhiri.", cancelled: "Cuti {name} sudah dibatalkan.", byAdmin: "Dicatat Admin" },
  en: { title: "Couriers", description: "Monitor couriers, capacity, and leave requests.", search: "Search name, email, or phone", loading: "Loading couriers", error: "Could not load couriers", empty: "No couriers found", emptyHint: "No courier matches the current search.", active: "Active", inactive: "Inactive", onLeave: "On leave", capacity: "Active capacity", detail: "View details",
    leaveTitle: "Leave requests", waitingTab: "Waiting", historyTab: "History", noPending: "No leave requests are waiting.", noHistory: "No leave history yet.", until: "until", open: "not set", approve: "Approve", reject: "Reject", plannedWarning: "{count} delivery schedules for this courier fall during the leave. Move those orders in Delivery Schedule after approving.",
    approveTitle: "Approve leave?", approveText: "During leave this courier gets no new delivery schedules. The courier will be notified.", rejectTitle: "Reject leave?", rejectText: "The rejection reason will be sent to the courier.", rejectReason: "Rejection reason", cancel: "Back", requestedAt: "Requested", reasonLabel: "Reason", rejectedReason: "Rejection reason",
    status: { pending: "Waiting", approved: "Approved", running: "On leave", done: "Finished", rejected: "Rejected", cancelled: "Cancelled" },
    add: "+ Add courier", addTitle: "Add courier account", addText: "The account uses the same initial password for every new courier. The courier must change it on first login.", fullName: "Full name", email: "Email", phone: "WhatsApp number", capacity2: "Active delivery capacity", create: "Create account", creating: "Creating...", createdTitle: "Courier account created", createdText: "Give these login details to the courier. After logging in, they will be asked to change the password.", password: "Initial password", copy: "Copy login details", copied: "Copied", sendWa: "Send via WhatsApp", close: "Done", waMessage: "Hi {name}, your Kucur courier account is ready.\nEmail: {email}\nInitial password: {password}\nLog in at {url} and change the password.",
    recordLeave: "Record leave", recordTitle: "Record leave for {name}", recordText: "For couriers who cannot request it themselves. The leave applies right away without further approval, and the courier will be notified.", start: "Start", end: "End (optional)", endHint: "Leave empty if you do not know when the courier will return.", reasonPlaceholder: "Example: sick, family event", save: "Save leave", startPast: "The start cannot be earlier than now.", endBeforeStart: "The end must be after the start.", recorded: "Leave for {name} has been recorded.",
    endLeave: "End leave", cancelLeave: "Cancel leave", endTitle: "End this leave now?", endText: "The courier is back on duty from now and can receive delivery schedules. The courier will be notified.", cancelTitle: "Cancel this leave?", cancelText: "This leave has not started yet and will be cancelled. The courier will be notified.", ended: "Leave for {name} has ended.", cancelled: "Leave for {name} has been cancelled.", byAdmin: "Recorded by Admin" },
};
const inputClass = "min-h-11 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]";
const badgeTone = { pending: "pending", approved: "confirmed", running: "active", done: "completed", rejected: "rejected", cancelled: "inactive" };

export default function Couriers() {
  const { formatDate, language, t } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const [rows, setRows] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [leaveTab, setLeaveTab] = useState("pending");
  const [dialog, setDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [recording, setRecording] = useState(null);
  const [ending, setEnding] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const apply = useCallback(([couriers, leaveRows]) => { setRows(couriers); setLeaves(leaveRows); }, []);
  const fetchAll = () => Promise.all([deliveryApi.couriers(), deliveryApi.leaveRequests()]);
  const load = async () => { try { apply(await fetchAll()); } catch (caught) { setError(caught.message || copy.error); } };
  const silentRefresh = useCallback(async () => { try { apply(await Promise.all([deliveryApi.couriers(), deliveryApi.leaveRequests()])); } catch { /* data lama tetap tampil */ } }, [apply]);
  useLiveRefresh(silentRefresh);
  useEffect(() => {
    let active = true;
    fetchAll().then((data) => { if (active) apply(data); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apply]);
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return rows.filter((row) => !value || [row.user?.fullName, row.user?.email, row.user?.phone].some((item) => String(item ?? "").toLowerCase().includes(value))); }, [query, rows]);
  const visibleRows = paginate(filtered, page, PAGE_SIZE);
  const pending = leaves.filter((row) => row.status === "pending");
  const history = leaves.filter((row) => row.status !== "pending").slice(0, 20);
  const onLeave = new Set(leaves.filter((row) => leavePhase(row) === "running").map((row) => row.courierUserId));
  const when = (value) => formatDate(value, { dateStyle: "medium", timeStyle: "short" });
  const createCourier = async () => {
    setBusy(true); setError("");
    try { const result = await deliveryApi.createCourier(creating); setCreated({ ...result, phone: creating.phone }); setCreating(null); setCopied(false); await load(); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  };
  const loginText = created ? copy.waMessage.replace("{name}", created.user.fullName).replace("{email}", created.user.email).replace("{password}", created.initialPassword).replace("{url}", window.location.origin) : "";
  const copyLogin = async () => { try { await navigator.clipboard.writeText(loginText); setCopied(true); } catch { setCopied(false); } };
  const openRecord = (row) => { const now = toLocalInputValue(); setError(""); setNotice(""); setRecording({ courierUserId: row.userId, name: row.user.fullName, min: now, startAt: now, endAt: "", reason: "" }); };
  const recordStartPast = Boolean(recording?.startAt) && recording.startAt < recording.min;
  const recordEndInvalid = Boolean(recording?.endAt) && Boolean(recording?.startAt) && recording.endAt <= recording.startAt;
  const saveRecord = async () => {
    if (!recording) return;
    setBusy(true); setError("");
    try {
      await deliveryApi.recordLeave(recording.courierUserId, { startAt: new Date(recording.startAt).toISOString(), endAt: recording.endAt ? new Date(recording.endAt).toISOString() : null, reason: recording.reason });
      setNotice(copy.recorded.replace("{name}", recording.name)); setRecording(null); setLeaveTab("history"); await load();
    } catch (caught) { setError(leaveErrorText(caught)); }
    finally { setBusy(false); }
  };
  const confirmEnd = async () => {
    if (!ending) return;
    setBusy(true); setError(""); setNotice("");
    try { await deliveryApi.endLeave(ending.row.courierUserId, ending.row.id); setNotice((ending.phase === "running" ? copy.ended : copy.cancelled).replace("{name}", ending.row.courier?.fullName || "")); setEnding(null); await load(); }
    catch (caught) { setError(caught.message); setEnding(null); }
    finally { setBusy(false); }
  };
  const decide = async () => {
    if (!dialog) return;
    setBusy(true); setError("");
    try { await deliveryApi.reviewLeave(dialog.row.courierUserId, dialog.row.id, { decision: dialog.decision, reason: rejectReason }); setDialog(null); setRejectReason(""); await load(); }
    catch (caught) { setError(caught.message); setDialog(null); }
    finally { setBusy(false); }
  };
  const leaveList = (list) => <ul>{list.map((row) => { const phase = leavePhase(row); return <li className="grid min-w-0 gap-2 border-t border-[var(--kucur-border)] px-4 py-3.5 sm:px-5" key={`${row.courierUserId}-${row.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 break-words text-[15px]">{row.courier?.fullName}</strong><StatusBadge status={badgeTone[phase]}>{copy.status[phase]}</StatusBadge></div>
    <span className="text-[15px]">{when(row.startAt)} {copy.until} {row.endAt ? when(row.endAt) : copy.open}</span>
    {row.createdByAdmin && <span className="justify-self-start rounded-md bg-[var(--kucur-surface-elevated)] px-2 py-0.5 text-[13px] font-semibold text-[var(--kucur-text-muted)]">{copy.byAdmin}</span>}
    <p className="break-words text-sm text-[var(--kucur-text-muted)]"><b className="text-[var(--kucur-text)]">{copy.reasonLabel}:</b> {row.reason || "-"}{row.requestedAt && <> · {copy.requestedAt} {when(row.requestedAt)}</>}</p>
    {row.status === "rejected" && row.rejectionReason && <p className="text-sm text-rose-700 dark:text-rose-300"><b>{copy.rejectedReason}:</b> {row.rejectionReason}</p>}
    {row.plannedBatchCount > 0 && <p className="rounded-lg bg-[var(--kucur-amber-soft)] px-3 py-2 text-sm font-semibold text-[var(--kucur-amber-ink)]">{copy.plannedWarning.replace("{count}", row.plannedBatchCount)}</p>}
    {row.status === "pending" && <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><Button variant="secondary" disabled={busy} onClick={() => { setRejectReason(""); setDialog({ row, decision: "reject" }); }}>{copy.reject}</Button><Button disabled={busy} onClick={() => setDialog({ row, decision: "approve" })}>{copy.approve}</Button></div>}
    {(phase === "running" || phase === "approved") && <Button className="w-full sm:w-auto sm:justify-self-end" variant="secondary" disabled={busy} onClick={() => { setError(""); setNotice(""); setEnding({ row, phase }); }}>{phase === "running" ? copy.endLeave : copy.cancelLeave}</Button>}
  </li>; })}</ul>;

  return <div className="page-container admin-operations-page min-w-0">
    <PageHeader eyebrow={t("workspace.adminEyebrow")} title={copy.title} description={copy.description} actions={<Button onClick={() => { setError(""); setCreating({ fullName: "", email: "", phone: "", maxActiveDeliveries: "10" }); }}>{copy.add}</Button>} />
    {error && !recording && <p className="admin-error mb-4" role="alert">{error}</p>}
    {notice && <p className="mb-4 rounded-xl bg-[var(--kucur-green-soft)] p-4 text-[15px] font-semibold text-[var(--kucur-text)]" role="status">{notice}</p>}
    {loading ? <LoadingPanel label={copy.loading} rows={5} /> : <>
      <section className="mb-5 min-w-0 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]" aria-labelledby="courier-leave-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5"><h2 className="text-lg font-extrabold" id="courier-leave-title">{copy.leaveTitle}</h2>
          <div className="grid grid-cols-2 rounded-xl border border-[var(--kucur-border)] p-1" role="tablist">{[["pending", `${copy.waitingTab}${pending.length ? ` (${pending.length})` : ""}`], ["history", copy.historyTab]].map(([key, label]) => <button className={`min-h-11 sm:min-h-10 rounded-lg px-3 text-sm font-bold ${leaveTab === key ? "bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "text-[var(--kucur-text-muted)]"}`} type="button" role="tab" aria-selected={leaveTab === key} key={key} onClick={() => setLeaveTab(key)}>{label}</button>)}</div>
        </div>
        <div className="mt-3">{leaveTab === "pending" ? (pending.length ? leaveList(pending) : <p className="border-t border-[var(--kucur-border)] px-4 py-5 text-[15px] text-[var(--kucur-text-muted)] sm:px-5">{copy.noPending}</p>) : (history.length ? leaveList(history) : <p className="border-t border-[var(--kucur-border)] px-4 py-5 text-[15px] text-[var(--kucur-text-muted)] sm:px-5">{copy.noHistory}</p>)}</div>
      </section>
      <section className="mb-5 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4"><label className="admin-form-control max-w-2xl"><span>{copy.search}</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={copy.search} /></label></section>
      {filtered.length ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleRows.map((row) => <article className="card grid min-w-0 gap-3" key={row.userId}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{row.user.fullName}</h2><p className="break-all text-sm text-[var(--kucur-text-muted)]">{row.user.email}</p></div>{onLeave.has(row.userId) ? <StatusBadge status="pending">{copy.onLeave}</StatusBadge> : <StatusBadge status={row.isActive ? "active" : "inactive"}>{row.isActive ? copy.active : copy.inactive}</StatusBadge>}</div><dl className="grid gap-1 text-sm"><div className="flex justify-between gap-3"><dt>{copy.capacity}</dt><dd className="font-semibold">{row.maxActiveDeliveries}</dd></div></dl><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Link className="secondary-button min-h-11 justify-center" to={`/admin/couriers/${row.userId}`}>{copy.detail}</Link><Button variant="secondary" onClick={() => openRecord(row)}>{copy.recordLeave}</Button></div></article>)}</section><Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage}/></> : <EmptyState title={copy.empty} description={copy.emptyHint} />}
    </>}
    <ActionDialog open={Boolean(creating)} busy={busy} title={copy.addTitle} description={copy.addText} confirmLabel={busy ? copy.creating : copy.create} cancelLabel={copy.cancel} confirmDisabled={!creating?.fullName.trim() || !creating?.email.trim() || !creating?.phone.trim()} onCancel={() => setCreating(null)} onConfirm={createCourier}>
      {creating && <>
        {error && <p className="text-sm font-semibold text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
        {[["fullName", copy.fullName, "text", "name"], ["email", copy.email, "email", "email"], ["phone", copy.phone, "tel", "tel"], ["maxActiveDeliveries", copy.capacity2, "number", "off"]].map(([key, label, type, autoComplete]) => <label className="grid gap-1.5 text-[15px] font-semibold" key={key}>{label}<input className="min-h-11 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]" type={type} autoComplete={autoComplete} inputMode={type === "tel" ? "tel" : type === "number" ? "numeric" : undefined} min={type === "number" ? 1 : undefined} max={type === "number" ? 100 : undefined} value={creating[key]} placeholder={key === "phone" ? "08xxxxxxxxxx" : undefined} onChange={(event) => setCreating((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(created)} title={copy.createdTitle} description={copy.createdText} confirmLabel={copy.close} cancelLabel={copied ? copy.copied : copy.copy} onCancel={copyLogin} onConfirm={() => setCreated(null)}>
      {created && <>
        <dl className="grid gap-2 rounded-xl bg-[var(--kucur-surface-elevated)] p-4 text-[15px]"><div className="flex flex-wrap justify-between gap-2"><dt className="text-[var(--kucur-text-muted)]">{copy.email}</dt><dd className="break-all font-bold">{created.user.email}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-[var(--kucur-text-muted)]">{copy.password}</dt><dd className="font-mono font-bold">{created.initialPassword}</dd></div></dl>
        {whatsappLink(created.phone) && <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-green)] px-4 text-[15px] font-bold text-[var(--kucur-green-ink)]" href={whatsappLink(created.phone, loginText)} target="_blank" rel="noreferrer">{copy.sendWa}</a>}
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(recording)} busy={busy} title={recording ? copy.recordTitle.replace("{name}", recording.name) : ""} description={copy.recordText} confirmLabel={copy.save} cancelLabel={copy.cancel} confirmDisabled={!recording?.startAt || recordStartPast || recordEndInvalid || !recording?.reason.trim()} onCancel={() => setRecording(null)} onConfirm={saveRecord}>
      {recording && <>
        {error && <p className="text-sm font-semibold text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <label className="grid content-start gap-1.5 text-[15px] font-semibold">{copy.start}<input className={inputClass} type="datetime-local" required min={recording.min} aria-invalid={recordStartPast || undefined} value={recording.startAt} onChange={(event) => setRecording((value) => ({ ...value, startAt: event.target.value }))}/>{recordStartPast && <span className="text-[13px] font-semibold text-rose-700 dark:text-rose-300" role="alert">{copy.startPast}</span>}</label>
          <label className="grid content-start gap-1.5 text-[15px] font-semibold">{copy.end}<input className={inputClass} type="datetime-local" min={recording.startAt || recording.min} aria-invalid={recordEndInvalid || undefined} value={recording.endAt} onChange={(event) => setRecording((value) => ({ ...value, endAt: event.target.value }))}/>{recordEndInvalid ? <span className="text-[13px] font-semibold text-rose-700 dark:text-rose-300" role="alert">{copy.endBeforeStart}</span> : <span className="text-[13px] font-normal text-[var(--kucur-text-muted)]">{copy.endHint}</span>}</label>
        </div>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.reasonLabel}<textarea className="min-h-24 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-base text-[var(--kucur-text)]" required maxLength="255" placeholder={copy.reasonPlaceholder} value={recording.reason} onChange={(event) => setRecording((value) => ({ ...value, reason: event.target.value }))}/></label>
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(ending)} busy={busy} title={ending?.phase === "running" ? copy.endTitle : copy.cancelTitle} description={ending?.phase === "running" ? copy.endText : copy.cancelText} confirmLabel={ending?.phase === "running" ? copy.endLeave : copy.cancelLeave} cancelLabel={copy.cancel} destructive onCancel={() => setEnding(null)} onConfirm={confirmEnd}>
      {ending && <p className="text-[15px]"><b>{ending.row.courier?.fullName}</b> · {when(ending.row.startAt)} {copy.until} {ending.row.endAt ? when(ending.row.endAt) : copy.open}</p>}
    </ActionDialog>
    <ActionDialog open={Boolean(dialog)} busy={busy} title={dialog?.decision === "reject" ? copy.rejectTitle : copy.approveTitle} description={dialog?.decision === "reject" ? copy.rejectText : copy.approveText} confirmLabel={dialog?.decision === "reject" ? copy.reject : copy.approve} cancelLabel={copy.cancel} destructive={dialog?.decision === "reject"} confirmDisabled={dialog?.decision === "reject" && !rejectReason.trim()} onCancel={() => setDialog(null)} onConfirm={decide}>
      {dialog?.decision === "reject" && <label className="grid gap-1.5 text-[15px] font-semibold">{copy.rejectReason}<textarea className="min-h-24 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-base text-[var(--kucur-text)]" maxLength="255" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}/></label>}
    </ActionDialog>
  </div>;
}
