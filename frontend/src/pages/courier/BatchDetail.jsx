import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { prepareProofPhoto } from "../../services/proofImageService";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { shortOrderCode } from "../../utils/orderCode";
import { whatsappLink } from "../../utils/whatsapp";

const ACTIVE = ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"];
const mapsLink = (order) => {
  const location = order.deliveryLocation;
  const query = Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude)) ? `${location.latitude},${location.longitude}` : order.deliveryAddress;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query ?? "")}`;
};

// Layar kerja kurir: satu kartu per pemberhentian, satu tombol utama sesuai tahapnya.
export default function BatchDetail() {
  const { batchId } = useParams();
  const { formatCurrency, formatDate, language, statusLabel, t } = usePreferences();
  const copy = language === "id" ? {
    back: "Semua pengiriman", title: "Pengiriman {date}", depart: "Berangkat {time}", progress: "{done} dari {total} terkirim", collect: "Total COD ditagih", start: "Mulai pengiriman", stop: "Tujuan {number}",
    pickupHint: "Ambil barang di {store}. Bayar harga barang ke penjual.", pickup: "Konfirmasi Ambil Barang", deliverHint: "Barang sudah di tangan. Berangkat ke alamat pembeli.", startDelivery: "Mulai Antar", proofHint: "Serahkan barang, tagih uang, lalu foto barang yang diterima.",
    photo: "Foto & selesaikan", photoAgain: "Ganti foto", finish: "Selesaikan dengan Bukti", call: "Telepon", whatsapp: "WhatsApp", waText: "Halo {name}, saya kurir Kucur yang mengantar pesanan {code}. ", maps: "Maps", codCollect: "Tagih dari pembeli", codPaid: "Sudah dibayar", tip: "termasuk tip {amount}", fail: "Gagal antar", photoError: "Foto tidak bisa dipakai. Coba ambil ulang.", waitCurrent: "Selesaikan atau tandai gagal pengantaran yang sedang berjalan dulu.",
    allDone: "Semua tujuan sudah selesai", allDoneHint: "Tidak ada lagi yang perlu kamu antar. Jadwal ini akan ditutup oleh Admin, jadi statusnya tetap Berjalan sampai saat itu.",
  } : {
    back: "All deliveries", title: "Delivery {date}", depart: "Leaves {time}", progress: "{done} of {total} delivered", collect: "COD to collect", start: "Start delivery", stop: "Stop {number}",
    pickupHint: "Pick up at {store}. Pay the item price to the seller.", pickup: "Confirm Pickup", deliverHint: "You have the items. Head to the buyer's address.", startDelivery: "Start Delivery", proofHint: "Hand over the items, collect payment, then photograph the delivered items.",
    photo: "Take photo & finish", photoAgain: "Retake photo", finish: "Complete with Proof", call: "Call", whatsapp: "WhatsApp", waText: "Hi {name}, I am the Kucur courier delivering order {code}. ", maps: "Maps", codCollect: "Collect from buyer", codPaid: "Already paid", tip: "includes {amount} tip", fail: "Delivery failed", photoError: "This photo cannot be used. Please take it again.", waitCurrent: "Finish or mark the delivery in progress as failed first.",
    allDone: "All stops are finished", allDoneHint: "There is nothing left for you to deliver. The Admin will close this schedule, so it stays In progress until then.",
  };
  const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, replacement), text);
  const [batch, setBatch] = useState(null);
  const [state, setState] = useState({ loading: true, busy: "", error: "" });
  const [photos, setPhotos] = useState({});
  const [failure, setFailure] = useState({ orderId: "", reason: "" });
  const fileInputs = useRef({});
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try { setBatch(await deliveryApi.courierBatch(batchId)); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, loading: false })); }
  }, [batchId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  // Muat ulang diam-diam: hanya data batch. Foto bukti (photos), dialog gagal antar (failure), dan pesan galat tidak disentuh;
  // ditahan saat ada aksi berjalan agar tidak menimpa hasil aksi.
  useLiveRefresh(() => deliveryApi.courierBatch(batchId).then(setBatch), { enabled: Boolean(batch) && !state.busy });
  const mutate = async (key, action) => {
    setState((value) => ({ ...value, busy: key, error: "" }));
    try { await action(); setFailure({ orderId: "", reason: "" }); await load(); }
    // Gagal (mis. pesanan dibatalkan): tutup dialog supaya pesan terlihat, lalu muat ulang daftar dengan status terbaru.
    catch (cause) { setFailure({ orderId: "", reason: "" }); await load(); setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: "" })); }
  };
  const choosePhoto = async (orderId, file) => {
    if (!file) return;
    try { const dataUrl = await prepareProofPhoto(file); setPhotos((rows) => ({ ...rows, [orderId]: dataUrl })); }
    catch { setState((value) => ({ ...value, error: copy.photoError })); }
  };

  if (state.loading && !batch) return <PageContainer><LoadingPanel label={t("courierDelivery.loading")} rows={4}/></PageContainer>;
  if (!batch) return <PageContainer><EmptyState title={t("courierDelivery.empty")} description={state.error || t("courierDelivery.emptyHint")} action={<Button as={Link} to="/courier/batches" variant="secondary">{copy.back}</Button>}/></PageContainer>;

  const stops = [...batch.orders].sort((a, b) => (a.pickupSequence ?? 99) - (b.pickupSequence ?? 99));
  const delivered = stops.filter((item) => item.status === "DELIVERED").length;
  // Satu pengantaran berjalan dalam satu waktu: tombol Mulai Antar lain menunggu sampai yang berjalan selesai atau gagal.
  const onTheRoad = stops.some((item) => item.status === "OUT_FOR_DELIVERY");
  const codTotal = stops.filter((item) => item.commerceOrder.paymentMethod === "COD" && item.commerceOrder.paymentStatus !== "paid" && ACTIVE.includes(item.status)).reduce((sum, item) => sum + Number(item.commerceOrder.totalAmount || 0), 0);
  const actionClass = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--kucur-green)] px-4 text-base font-bold text-[var(--kucur-on-green)] disabled:opacity-50";
  const smallClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold";
  // Tombol kontak pembeli (Telepon / WhatsApp / Maps): ikon di atas teks supaya tiga tombol muat di HP 360px.
  const contactClass = "inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--kucur-border-strong)] px-1 text-[13px] font-bold";

  return <><PageContainer as="main" className="space-y-4 text-[var(--kucur-text)]">
    <header className="grid gap-1">
      <Link className="inline-flex min-h-11 w-fit items-center text-[15px] font-bold text-[var(--kucur-green-ink)]" to="/courier/batches">← {copy.back}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-extrabold">{fill(copy.title, { date: formatDate(batch.deliveryDate, { weekday: "long", day: "numeric", month: "long" }) })}</h1><StatusBadge status={batch.status}/></div>
      <p className="text-[15px] text-[var(--kucur-text-muted)]">{fill(copy.depart, { time: formatDate(batch.dispatchAt, { timeStyle: "short" }) })} · {fill(copy.progress, { done: delivered, total: stops.length })}</p>
    </header>

    <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4">
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--kucur-surface-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={stops.length} aria-valuenow={delivered}><i className="block h-full rounded-full bg-[var(--kucur-green)]" style={{ width: `${stops.length ? delivered / stops.length * 100 : 0}%` }} /></div>
      {codTotal > 0 && <div className="flex items-center justify-between gap-3"><span className="text-[15px] text-[var(--kucur-text-muted)]">{copy.collect}</span><strong className="text-xl font-extrabold">{formatCurrency(codTotal)}</strong></div>}
      {["PLANNED", "READY"].includes(batch.status) && <button className={actionClass} type="button" disabled={Boolean(state.busy)} onClick={() => void mutate(`batch-${batch.id}`, () => deliveryApi.startBatch(batch.id))}>{copy.start}</button>}
    </section>
    {batch.status === "IN_PROGRESS" && stops.length > 0 && !stops.some((item) => ACTIVE.includes(item.status)) && <section className="grid gap-1 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-green-soft)] p-4" role="status"><strong className="text-[15px] text-[var(--kucur-green-ink)]">{copy.allDone}</strong><p className="text-[15px]">{copy.allDoneHint}</p></section>}
    {state.error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</p>}

    <section className="grid gap-3 lg:grid-cols-2">
      {stops.map(({ commerceOrder: order, ...assignment }, index) => {
        const photo = photos[order.id];
        const active = ACTIVE.includes(assignment.status);
        const code = order.orderCode || order.orderNumber;
        return <article className={`grid min-w-0 gap-3 rounded-2xl border bg-[var(--kucur-surface)] p-4 ${active ? "border-[var(--kucur-border)]" : "border-[var(--kucur-border)] opacity-80"}`} key={assignment.id}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{fill(copy.stop, { number: assignment.pickupSequence ?? index + 1 })} · {shortOrderCode(code)}</span><h2 className="break-words text-lg font-extrabold">{order.recipientName || t("merchantOrderDetail.unavailableValue")}</h2><p className="break-all text-[12px] text-[var(--kucur-text-muted)]">{code}</p></div>
            <StatusBadge status={assignment.status}/>
          </div>
          <p className="break-words text-[15px] leading-6">{order.deliveryAddress}</p>
          <p className="text-sm text-[var(--kucur-text-muted)]">{order.storeName}</p>
          {active && <div className="grid grid-cols-3 gap-2">
            {order.recipientPhone ? <a className={contactClass} href={`tel:${order.recipientPhone}`}><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>{copy.call}</a> : <span />}
            {whatsappLink(order.recipientPhone, fill(copy.waText, { name: order.recipientName || "", code: shortOrderCode(code) })) ? <a className={contactClass} href={whatsappLink(order.recipientPhone, fill(copy.waText, { name: order.recipientName || "", code: shortOrderCode(code) }))} target="_blank" rel="noreferrer"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/></svg>{copy.whatsapp}</a> : <span />}
            <a className={contactClass} href={mapsLink(order)} target="_blank" rel="noreferrer"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>{copy.maps}</a>
          </div>}
          {order.paymentMethod === "COD" && <div className={`flex items-center justify-between gap-3 rounded-xl p-3 ${order.paymentStatus === "paid" ? "bg-[var(--kucur-green-soft)]" : "bg-amber-50 dark:bg-amber-950/40"}`}><div className="min-w-0"><span className="block text-[15px] font-bold">{order.paymentStatus === "paid" ? copy.codPaid : copy.codCollect}</span><span className="text-[13px] text-[var(--kucur-text-muted)]">{Number(order.courierTip) > 0 ? fill(copy.tip, { amount: formatCurrency(order.courierTip) }) : t("courierDelivery.codHint")}</span></div><strong className="text-xl font-extrabold">{formatCurrency(order.totalAmount)}</strong></div>}

          {assignment.status === "WAITING_PICKUP" && <><p className="text-sm text-[var(--kucur-text-muted)]">{fill(copy.pickupHint, { store: order.storeName })}</p><button className={actionClass} type="button" disabled={Boolean(state.busy)} onClick={() => void mutate(`pickup-${order.id}`, () => deliveryApi.pickup(order.id))}>{copy.pickup}</button></>}
          {assignment.status === "PICKED_UP" && <><p className="text-sm text-[var(--kucur-text-muted)]">{onTheRoad ? copy.waitCurrent : copy.deliverHint}</p><button className={actionClass} type="button" disabled={Boolean(state.busy) || onTheRoad} onClick={() => void mutate(`delivery-${order.id}`, () => deliveryApi.outForDelivery(order.id))}>{copy.startDelivery}</button></>}
          {assignment.status === "OUT_FOR_DELIVERY" && <div className="grid gap-2">
            <p className="text-sm text-[var(--kucur-text-muted)]">{copy.proofHint}</p>
            <input ref={(node) => { fileInputs.current[order.id] = node; }} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label={copy.photo} onChange={(event) => void choosePhoto(order.id, event.target.files?.[0])} />
            {photo && <img className="max-h-56 w-full rounded-xl border border-[var(--kucur-border)] object-contain" src={photo} alt={t("merchantOrderDetail.deliveryProof")} />}
            {photo
              ? <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><button className={smallClass} type="button" onClick={() => fileInputs.current[order.id]?.click()}>{copy.photoAgain}</button><button className={actionClass} type="button" disabled={Boolean(state.busy)} onClick={() => void mutate(`proof-${order.id}`, () => deliveryApi.proof(order.id, { photoDataUrl: photo }))}>{copy.finish}</button></div>
              : <button className={actionClass} type="button" onClick={() => fileInputs.current[order.id]?.click()}>{copy.photo}</button>}
          </div>}
          {active && <button className="inline-flex min-h-11 w-fit items-center text-sm font-bold text-rose-700 underline dark:text-rose-300" type="button" disabled={Boolean(state.busy)} onClick={() => setFailure({ orderId: order.id, reason: "" })}>{copy.fail}</button>}
          {!active && <p className="text-sm text-[var(--kucur-text-muted)]">{statusLabel(assignment.status)}</p>}
        </article>;
      })}
    </section>
    {!stops.length && <EmptyState title={t("courierDelivery.empty")} description={t("courierDelivery.emptyHint")}/>}
  </PageContainer><ActionDialog open={Boolean(failure.orderId)} busy={Boolean(state.busy)} destructive confirmDisabled={!failure.reason.trim()} title={copy.fail} description={t("courierDelivery.reason")} cancelLabel={t("merchantPickup.cancel")} confirmLabel={copy.fail} onCancel={() => setFailure({ orderId: "", reason: "" })} onConfirm={() => void mutate(`fail-${failure.orderId}`, () => deliveryApi.failed(failure.orderId, failure.reason))}><label className="grid gap-1.5 text-[15px] font-semibold">{t("courierDelivery.reason")}<textarea autoFocus className="min-h-24 w-full resize-y rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-base text-[var(--kucur-text)]" required maxLength="1000" value={failure.reason} onChange={(event) => setFailure((value) => ({ ...value, reason: event.target.value }))}/></label></ActionDialog></>;
}
