import { fixOne } from "../../utils/singularEn";
import { useCallback, useEffect, useMemo, useState } from "react";
import ActionDialog from "../ui/ActionDialog";
import Button from "../ui/Button";
import StatusBadge from "../ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { shortOrderCode } from "../../utils/orderCode";

// Tanggal pengiriman tidak boleh sebelum hari ini (WIB); backend juga menolaknya.
const todayWib = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

const copyByLanguage = {
  id: {
    title: "Draf jadwal otomatis", hint: "Sistem membagi pesanan siap kirim ke kurir yang tidak cuti, dikelompokkan per lapak. Periksa, pindahkan bila perlu, lalu setujui. Kurir baru menerima jadwal setelah disetujui.",
    date: "Tanggal pengiriman", cutoff: "Batas pesan", dispatch: "Kurir berangkat", reminder: "Pengingat", beforeCutoff: "Draf sementara: pesanan masih bisa bertambah sampai batas pesan pukul {time}.",
    late: "Kurir berangkat pukul {time}. Setujui sekarang, tanpa persetujuan pesanan ini tidak akan diantar.", empty: "Tidak ada pesanan yang menunggu jadwal untuk tanggal ini.",
    orders: "{count} pesanan", capacity: "sisa kapasitas {count}", onLeave: "Cuti", unassigned: "Belum dapat kurir", unassignedHint: "Kapasitas kurir penuh atau semua kurir cuti. Pindahkan ke kurir lain atau biarkan bergeser ke jadwal berikutnya.",
    moveTo: "Kurir", none: "Belum dijadwalkan", over: "Melebihi kapasitas", approve: "Setujui {count} pesanan", approving: "Menyetujui...", confirmTitle: "Setujui draf jadwal?", confirmText: "Jadwal dibuat untuk setiap kurir dan kurir mendapat notifikasi. Pesanan yang belum dijadwalkan tetap menunggu.", cancel: "Kembali", done: "Jadwal disetujui dan dikirim ke kurir.", pastDate: "Tanggal pengiriman tidak boleh sebelum hari ini. Pilih hari ini atau tanggal berikutnya.",
  },
  en: {
    title: "Automatic schedule draft", hint: "The system splits ready orders across couriers who are not on leave, grouped by store. Review, move orders if needed, then approve. Couriers only receive a schedule after approval.",
    date: "Delivery date", cutoff: "Order cutoff", dispatch: "Couriers leave", reminder: "Reminder", beforeCutoff: "Provisional draft: orders can still come in until the {time} cutoff.",
    late: "Couriers leave at {time}. Approve now; without approval these orders will not be delivered.", empty: "No orders are waiting for a schedule on this date.",
    orders: "{count} orders", capacity: "{count} capacity left", onLeave: "On leave", unassigned: "No courier yet", unassignedHint: "Courier capacity is full or every courier is on leave. Move orders to another courier or let them shift to the next schedule.",
    moveTo: "Courier", none: "Not scheduled", over: "Over capacity", approve: "Approve {count} orders", approving: "Approving...", confirmTitle: "Approve the schedule draft?", confirmText: "A schedule is created for each courier and couriers are notified. Unscheduled orders keep waiting.", cancel: "Back", done: "Schedules approved and sent to couriers.", pastDate: "The delivery date cannot be before today. Pick today or a later date.",
  },
};

export default function DeliveryDraftPanel({ onApproved }) {
  const { formatCurrency, formatDate, language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  // Kosong = server memilih: hari ini sebelum kurir berangkat, sesudahnya besok.
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dateError, setDateError] = useState(false);
  const [draft, setDraft] = useState(null);
  const [plan, setPlan] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [now, setNow] = useState(() => Date.now());
  const apply = useCallback((data) => {
    setDraft(data); setNow(Date.now());
    const next = {};
    for (const courier of data.couriers) for (const order of courier.orders) next[order.id] = courier.courierUserId;
    for (const order of data.unassigned) next[order.id] = "";
    setPlan(next);
  }, []);
  const load = useCallback((date) => deliveryApi.drafts(date).then(apply).catch((caught) => setMessage({ type: "error", text: /sebelum hari ini|before today/i.test(caught.message || "") ? copy.pastDate : caught.message })), [apply, copy.pastDate]);
  useEffect(() => { void load(deliveryDate); }, [deliveryDate, load]);
  // Muat ulang diam-diam: pindahan manual Admin dipertahankan untuk pesanan yang masih ada; pesanan baru memakai usulan sistem.
  const silentRefresh = useCallback(async () => {
    try {
      const data = await deliveryApi.drafts(deliveryDate);
      setDraft(data); setNow(Date.now());
      setPlan((previous) => {
        const validCouriers = new Set(data.couriers.filter((courier) => !courier.onLeave).map((courier) => courier.courierUserId));
        const next = {};
        for (const courier of data.couriers) for (const order of courier.orders) next[order.id] = courier.courierUserId;
        for (const order of data.unassigned) next[order.id] = "";
        for (const id of Object.keys(next)) if (id in previous && (previous[id] === "" || validCouriers.has(previous[id]))) next[id] = previous[id];
        return next;
      });
    } catch { /* data lama tetap tampil */ }
  }, [deliveryDate]);
  useLiveRefresh(silentRefresh, { enabled: !confirming && !busy });

  const clock = (value) => formatDate(value, { hour: "2-digit", minute: "2-digit" });
  const orders = useMemo(() => draft ? [...draft.couriers.flatMap((courier) => courier.orders), ...draft.unassigned] : [], [draft]);
  const columns = useMemo(() => {
    if (!draft) return [];
    const byCourier = (id) => orders.filter((order) => (plan[order.id] ?? "") === id);
    return [...draft.couriers.map((courier) => ({ ...courier, list: byCourier(courier.courierUserId), limit: courier.remaining + courier.orders.length })), { courierUserId: "", fullName: copy.unassigned, list: byCourier(""), unassigned: true }];
  }, [copy.unassigned, draft, orders, plan]);
  const scheduledCount = orders.filter((order) => plan[order.id]).length;
  const late = draft && draft.total > 0 && now >= new Date(draft.reminderAt).getTime() && now < new Date(draft.dispatchAt).getTime();
  const overCapacity = columns.some((column) => !column.unassigned && column.list.length > column.limit);
  const options = draft ? draft.couriers.filter((courier) => !courier.onLeave) : [];

  const approve = async () => {
    setBusy(true); setMessage({ type: "", text: "" });
    try {
      const assignments = columns.filter((column) => !column.unassigned && column.list.length).map((column) => ({ courierUserId: column.courierUserId, commerceOrderIds: column.list.map((order) => order.id) }));
      await deliveryApi.approveDrafts({ deliveryDate: draft.deliveryDate, assignments });
      setConfirming(false); setMessage({ type: "success", text: copy.done });
      await load(deliveryDate); onApproved?.();
    } catch (caught) { setConfirming(false); setMessage({ type: "error", text: caught.message }); }
    finally { setBusy(false); }
  };

  return <section className="admin-ops-panel grid gap-4" aria-labelledby="delivery-draft-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-3xl"><h2 className="text-lg font-extrabold" id="delivery-draft-title">{copy.title}</h2><p className="mt-1 text-sm text-[var(--kucur-text-muted)]">{copy.hint}</p></div>
      <label className="grid gap-1 text-sm font-semibold">{copy.date}<input className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[var(--kucur-text)]" type="date" min={todayWib()} value={deliveryDate || draft?.deliveryDate || ""} aria-invalid={dateError || undefined} aria-describedby={dateError ? "draft-date-error" : undefined} onChange={(event) => { const value = event.target.value; if (!value) return; if (value < todayWib()) { setDateError(true); return; } setDateError(false); setMessage((current) => (current.text === copy.pastDate ? { type: "", text: "" } : current)); setDeliveryDate(value); }} />{dateError && <span className="text-[13px] font-semibold text-rose-700 dark:text-rose-300" id="draft-date-error" role="alert">{copy.pastDate}</span>}</label>
    </div>
    {draft && <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><div className="flex gap-1.5"><dt className="text-[var(--kucur-text-muted)]">{copy.cutoff}</dt><dd className="font-bold">{clock(draft.cutoffAt)}</dd></div><div className="flex gap-1.5"><dt className="text-[var(--kucur-text-muted)]">{copy.dispatch}</dt><dd className="font-bold">{clock(draft.dispatchAt)}</dd></div><div className="flex gap-1.5"><dt className="text-[var(--kucur-text-muted)]">{copy.reminder}</dt><dd className="font-bold">{clock(draft.reminderAt)}</dd></div></dl>}
    {message.text && <p className={`rounded-xl p-3 text-[15px] font-semibold ${message.type === "error" ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)] text-[var(--kucur-text)]"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    {late && <p className="rounded-xl border-2 border-rose-500 bg-rose-50 p-3 text-[15px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-100" role="alert">{copy.late.replace("{time}", clock(draft.dispatchAt))}</p>}
    {draft && !draft.cutoffPassed && draft.total > 0 && <p className="rounded-xl bg-[var(--kucur-amber-soft)] p-3 text-sm font-semibold text-[var(--kucur-amber-ink)]">{copy.beforeCutoff.replace("{time}", clock(draft.cutoffAt))}</p>}
    {draft && !draft.total && <p className="rounded-xl border border-dashed border-[var(--kucur-border-strong)] p-5 text-center text-[15px] text-[var(--kucur-text-muted)]">{copy.empty}</p>}
    {draft && draft.total > 0 && <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.filter((column) => !column.unassigned || column.list.length).map((column) => <article className={`grid content-start gap-2 rounded-xl border p-3 ${column.unassigned ? "border-dashed border-[var(--kucur-amber)] bg-[var(--kucur-amber-soft)]/40" : "border-[var(--kucur-border)] bg-[var(--kucur-surface)]"}`} key={column.courierUserId || "none"}>
          <header className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[15px]">{column.fullName}</strong>{column.onLeave ? <StatusBadge status="pending">{copy.onLeave}</StatusBadge> : <span className="text-sm text-[var(--kucur-text-muted)]">{fixOne(copy.orders.replace("{count}", column.list.length))}{!column.unassigned && ` · ${copy.capacity.replace("{count}", Math.max(column.limit - column.list.length, 0))}`}</span>}</header>
          {column.unassigned && <p className="text-[13px] text-[var(--kucur-amber-ink)]">{copy.unassignedHint}</p>}
          {!column.unassigned && column.list.length > column.limit && <p className="text-[13px] font-bold text-rose-700 dark:text-rose-300">{copy.over}</p>}
          <ul className="grid gap-2">{column.list.map((order) => <li className="grid gap-1.5 rounded-lg bg-[var(--kucur-surface-elevated)] p-2.5 text-sm" key={order.id}>
            <div className="flex flex-wrap justify-between gap-2"><strong>{shortOrderCode(order.orderCode || order.orderNumber)} · {order.storeName}</strong><span className="font-semibold">{formatCurrency(order.totalAmount)}</span></div>
            <span className="text-[var(--kucur-text-muted)]">{order.recipientName} · {order.deliveryAddress}</span>
            <label className="flex items-center gap-2 font-semibold"><span className="shrink-0">{copy.moveTo}</span><select className="min-h-11 sm:min-h-10 w-full rounded-lg border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-2 text-[var(--kucur-text)]" value={plan[order.id] ?? ""} onChange={(event) => setPlan((value) => ({ ...value, [order.id]: event.target.value }))}><option value="">{copy.none}</option>{options.map((courier) => <option value={courier.courierUserId} key={courier.courierUserId}>{courier.fullName}</option>)}</select></label>
          </li>)}</ul>
        </article>)}
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button disabled={busy || !scheduledCount || overCapacity} onClick={() => setConfirming(true)}>{fixOne(copy.approve.replace("{count}", scheduledCount))}</Button></div>
    </>}
    <ActionDialog open={confirming} busy={busy} title={copy.confirmTitle} description={copy.confirmText} confirmLabel={busy ? copy.approving : fixOne(copy.approve.replace("{count}", scheduledCount))} cancelLabel={copy.cancel} onCancel={() => setConfirming(false)} onConfirm={approve} />
  </section>;
}
