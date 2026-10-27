import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { leavePhase } from "../../utils/courierLeave";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { deliveryApi } from "../../services/deliveryApiService";
import { ACTIONABLE_STATUSES, batchTime, useCourierBatches } from "./courierDeliveryModel";

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Beranda kurir: pengiriman hari ini (stop, uang COD) di atas, lalu jadwal berikutnya dan status ketersediaan.
export default function Dashboard() {
  const { formatCurrency, formatDate, language, t } = usePreferences();
  const copy = language === "id" ? {
    hello: "Halo, {name}", today: "Pengiriman hari ini", none: "Belum ada pengiriman hari ini", noneHint: "Jadwal dari pengelola akan muncul di sini.", depart: "Berangkat {time}",
    stops: "Tujuan", left: "Belum selesai", cod: "COD ditagih", open: "Buka pengiriman", next: "Jadwal berikutnya", nextNone: "Belum ada jadwal berikutnya", orders: "{count} pesanan",
    available: "Kamu siap menerima pengiriman", unavailable: "Kamu sedang cuti", pendingLeave: "Pengajuan cuti menunggu persetujuan Admin", change: "Cuti", all: "Semua pengiriman",
  } : {
    hello: "Hi, {name}", today: "Today's delivery", none: "No deliveries today", noneHint: "Batches from the manager will appear here.", depart: "Leaves {time}",
    stops: "Stops", left: "Remaining", cod: "COD to collect", open: "Open delivery", next: "Next schedule", nextNone: "No upcoming schedule", orders: "{count} orders",
    available: "You are available for deliveries", unavailable: "You are on leave", pendingLeave: "Leave request waiting for Admin approval", change: "Leave", all: "All deliveries",
  };
  const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, replacement), text);
  const batches = useCourierBatches();
  const [availability, setAvailability] = useState({ rows: [], loading: true, error: "" });
  useEffect(() => { let mounted = true; deliveryApi.availability().then((rows) => { if (mounted) setAvailability({ rows, loading: false, error: "" }); }).catch((error) => { if (mounted) setAvailability({ rows: [], loading: false, error: error.message }); }); return () => { mounted = false; }; }, []);

  useLiveRefresh(() => deliveryApi.availability().then((rows) => setAvailability({ rows, loading: false, error: "" })), { enabled: !availability.loading });

  const data = useMemo(() => {
    const now = new Date();
    const open = batches.scheduledBatches.filter((batch) => (batch.orders || []).some((item) => ACTIONABLE_STATUSES.has(item.status)));
    const todayBatch = open.find((batch) => sameDay(new Date(batch.deliveryDate || batch.dispatchAt), now)) ?? open.find((batch) => batchTime(batch) <= now.getTime());
    const nextBatch = open.filter((batch) => batch !== todayBatch && batchTime(batch) > now.getTime()).sort((a, b) => batchTime(a) - batchTime(b))[0];
    const unavailable = availability.rows.some((row) => leavePhase(row, now) === "running");
    const pendingLeave = availability.rows.some((row) => row.status === "pending");
    const orders = todayBatch?.orders ?? [];
    const remaining = orders.filter((item) => ACTIONABLE_STATUSES.has(item.status));
    const cod = remaining.filter((item) => item.commerceOrder?.paymentMethod === "COD" && item.commerceOrder?.paymentStatus !== "paid").reduce((sum, item) => sum + Number(item.commerceOrder.totalAmount || 0), 0);
    return { todayBatch, nextBatch, unavailable, pendingLeave, stops: orders.length, remaining: remaining.length, cod };
  }, [availability.rows, batches.scheduledBatches]);
  const loading = batches.loading || availability.loading;
  const error = batches.error || availability.error;
  const name = data.todayBatch?.courier?.fullName?.split(" ")[0];

  return <PageContainer className="space-y-4 text-[var(--kucur-text)]">
    <header>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("workspace.dashboard")}</h1>
      {name && <p className="mt-1 text-[15px] text-[var(--kucur-text-muted)]">{fill(copy.hello, { name })}</p>}
    </header>
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}
    {loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={4} /> : <>
      <section className="grid gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="courier-today">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold" id="courier-today">{copy.today}</h2>{data.todayBatch && <StatusBadge status={data.todayBatch.status} />}</div>
        {data.todayBatch ? <>
          <p className="text-[15px] text-[var(--kucur-text-muted)]">{formatDate(data.todayBatch.deliveryDate, { weekday: "long", day: "numeric", month: "long" })} · {fill(copy.depart, { time: formatDate(data.todayBatch.dispatchAt, { timeStyle: "short" }) })}</p>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-[var(--kucur-surface-muted)] p-3"><dt className="text-[13px] text-[var(--kucur-text-muted)]">{copy.stops}</dt><dd className="text-2xl font-extrabold">{data.stops}</dd></div>
            <div className="rounded-xl bg-[var(--kucur-surface-muted)] p-3"><dt className="text-[13px] text-[var(--kucur-text-muted)]">{copy.left}</dt><dd className="text-2xl font-extrabold">{data.remaining}</dd></div>
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-left dark:bg-amber-950/40"><dt className="text-[15px] text-[var(--kucur-text-muted)]">{copy.cod}</dt><dd className="text-xl font-extrabold">{formatCurrency(data.cod)}</dd></div>
          </dl>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-4 text-base font-bold text-[var(--kucur-on-green)]" to={`/courier/batches/${data.todayBatch.id}`}>{copy.open}</Link>
        </> : <EmptyState title={copy.none} description={copy.noneHint} />}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-2 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" aria-labelledby="courier-next">
          <h2 className="text-lg font-extrabold" id="courier-next">{copy.next}</h2>
          {data.nextBatch ? <Link className="flex items-center justify-between gap-3 rounded-xl border border-[var(--kucur-border)] p-3" to={`/courier/batches/${data.nextBatch.id}`}><div><strong className="block text-[15px]">{formatDate(data.nextBatch.dispatchAt, { weekday: "long", day: "numeric", month: "short" })}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{fill(copy.orders, { count: data.nextBatch.orders.length })}</span></div><span aria-hidden="true">→</span></Link> : <p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.nextNone}</p>}
          <Link className="inline-flex min-h-11 w-fit items-center text-sm font-bold text-[var(--kucur-green-ink)]" to="/courier/batches">{copy.all}</Link>
        </section>
        <section className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${data.unavailable || data.pendingLeave ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : "border-[var(--kucur-border)] bg-[var(--kucur-surface)]"}`}>
          <strong className="text-[15px]">{data.unavailable ? copy.unavailable : data.pendingLeave ? copy.pendingLeave : copy.available}</strong>
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-[var(--kucur-border-strong)] px-4 text-sm font-bold" to="/courier/availability">{copy.change}</Link>
        </section>
      </div>
    </>}
  </PageContainer>;
}
