import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";

// Keuangan per lapak: yang perlu dibayar di atas, lalu iuran pokok (progres + cicilan) dan biaya admin per bulan.
export default function StoreFinance() {
  const { storeId } = useParams();
  const { errorMessage, formatCurrency, formatDate, language } = usePreferences();
  const copy = language === "id" ? {
    title: "Keuangan Lapak", toPay: "Perlu dibayar", nothingToPay: "Tidak ada tagihan. Terima kasih!", payAll: "Bayar {amount}", pending: "Menunggu konfirmasi pengelola",
    adminFeeDue: "Biaya admin, bayar sebelum {date}", overdueFee: "Biaya admin lewat batas. Lapak bisa dinonaktifkan sampai lunas.", installmentDue: "Cicilan iuran pokok ke-{number}, jatuh tempo {date}", installmentOverdue: "Cicilan iuran pokok ke-{number} terlambat sejak {date}",
    initialFee: "Iuran pokok", initialHint: "Biaya keanggotaan lapak, bisa dicicil.", paidOf: "Sudah dibayar {paid} dari {total}", choosePlan: "Pilih cara bayar iuran pokok", plans: { FULL: "Lunas sekali", THREE_MONTHS: "Cicil 3 kali", SIX_MONTHS: "Cicil 6 kali" },
    installment: "Cicilan ke-{number}", dueOn: "jatuh tempo {date}", paidOn: "dibayar {date}", penalty: "termasuk denda {amount}",
    adminFee: "Biaya admin", adminHint: "{rate} dari harga barang setiap pesanan selesai. Ditagih per bulan.", order: "1 pesanan", orders: "{count} pesanan", noFees: "Belum ada biaya admin", noFeesHint: "Biaya admin muncul setelah ada pesanan selesai.",
    paid: "Lunas", unpaid: "Belum dibayar", saved: "Pembayaran dicatat. Pengelola desa akan mengonfirmasi setelah uang diterima.", failed: "Pembayaran gagal dikirim.", loadFailed: "Data keuangan gagal dimuat.", retry: "Coba lagi", sending: "Mengirim...", loading: "Memuat keuangan lapak",
  } : {
    title: "Store Finance", toPay: "To pay", nothingToPay: "No bills due. Thank you!", payAll: "Pay {amount}", pending: "Waiting for manager confirmation",
    adminFeeDue: "Admin fee, pay before {date}", overdueFee: "Admin fee is past due. The store may be suspended until it is paid.", installmentDue: "Store fee installment {number}, due {date}", installmentOverdue: "Store fee installment {number} overdue since {date}",
    initialFee: "Store membership fee", initialHint: "Your store membership fee, payable in installments.", paidOf: "Paid {paid} of {total}", choosePlan: "Choose how to pay the membership fee", plans: { FULL: "Pay in full", THREE_MONTHS: "3 installments", SIX_MONTHS: "6 installments" },
    installment: "Installment {number}", dueOn: "due {date}", paidOn: "paid {date}", penalty: "includes {amount} penalty",
    adminFee: "Admin fee", adminHint: "{rate} of item prices for every completed order. Billed monthly.", order: "1 order", orders: "{count} orders", noFees: "No admin fees yet", noFeesHint: "Admin fees appear after orders are completed.",
    paid: "Paid", unpaid: "Unpaid", saved: "Payment recorded. The village manager will confirm it once the money is received.", failed: "The payment could not be sent.", loadFailed: "Finance data could not be loaded.", retry: "Try again", sending: "Sending...", loading: "Loading store finance",
  };
  const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, replacement), text);
  const day = (value) => value ? formatDate(value, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "–";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [busyAction, setBusyAction] = useState("");
  const actionLock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await financeService.summary(storeId)); }
    catch (cause) { setError(errorMessage(cause.code, copy.loadFailed)); }
    finally { setLoading(false); }
  }, [copy.loadFailed, errorMessage, storeId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  // Kunci sinkron supaya ketukan ganda tidak mengirim pembayaran dua kali; data selalu dimuat ulang (berhasil/gagal).
  const act = async (key, work) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusyAction(key); setFeedback({ type: "", text: "" });
    try { await work(); setFeedback({ type: "success", text: copy.saved }); }
    catch (cause) { setFeedback({ type: "error", text: language === "id" && cause?.message && cause.code !== "API_ERROR" ? cause.message : errorMessage(cause.code, copy.failed) }); }
    finally { await load(); actionLock.current = false; setBusyAction(""); }
  };

  const fee = data?.initialFee;
  const installments = useMemo(() => fee?.installments ?? [], [fee]);
  const obligations = useMemo(() => data?.adminFee?.obligations ?? [], [data]);
  const unpaidFees = obligations.filter((row) => row.status === "OUTSTANDING" && !row.settlementItem);
  const pendingFees = obligations.filter((row) => row.status === "OUTSTANDING" && row.settlementItem);
  const unpaidFeeTotal = unpaidFees.reduce((sum, row) => sum + Number(row.feeAmount), 0);
  const isPending = (row) => (row.payments ?? []).some((payment) => payment.paymentStatus === "PENDING");
  const nextInstallment = installments.find((row) => row.status !== "PAID" && !isPending(row));
  const installmentAmount = (row) => Math.round((Number(row.principalOutstanding) + Number(row.penaltyOutstanding)) * 100) / 100;
  const months = useMemo(() => {
    const groups = new Map();
    for (const row of obligations) {
      const key = `${row.billingYear}-${String(row.billingMonth).padStart(2, "0")}`;
      const group = groups.get(key) ?? { key, date: new Date(row.billingYear, row.billingMonth - 1, 1), rows: [], total: 0, unpaid: 0, pending: 0 };
      group.rows.push(row); group.total += Number(row.feeAmount);
      if (row.status === "OUTSTANDING" && row.settlementItem) group.pending += Number(row.feeAmount);
      else if (row.status === "OUTSTANDING") group.unpaid += Number(row.feeAmount);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.date - a.date);
  }, [obligations]);
  const rate = obligations[0] ? (obligations[0].feeTypeSnapshot === "percentage" ? `${Number(obligations[0].feeValueSnapshot)}%` : formatCurrency(obligations[0].feeValueSnapshot)) : "";
  const now = data?.serverNow ? new Date(data.serverNow) : new Date();
  const buttonClass = "inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl px-4 text-[15px] font-bold disabled:opacity-50";

  if (loading && !data) return <PageContainer><LoadingPanel label={copy.loading} rows={4} /></PageContainer>;

  return <PageContainer className="merchant-standard-page finance-page space-y-4">
    <header><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{data?.store?.name}</span><h1 className="text-2xl font-extrabold sm:text-3xl">{copy.title}</h1></header>
    {feedback.text && <p className={`rounded-xl p-3 text-[15px] font-semibold ${feedback.type === "error" ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)]"}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}
    {error && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert"><strong>{error}</strong><button className={`${buttonClass} border border-current`} type="button" onClick={load}>{copy.retry}</button></section>}

    {data && !error && <>
      <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="finance-to-pay">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold" id="finance-to-pay">{copy.toPay}</h2><StatusBadge status={data.store.status} /></div>
        {!unpaidFeeTotal && !nextInstallment && !pendingFees.length && <p className="rounded-xl bg-[var(--kucur-green-soft)] p-3 text-[15px] font-semibold">{copy.nothingToPay}</p>}
        {unpaidFeeTotal > 0 && <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${data.adminFee.overdue > 0 ? "bg-rose-50 dark:bg-rose-950/50" : "bg-[var(--kucur-surface-muted)]"}`}>
          <div className="min-w-0"><span className="block text-sm text-[var(--kucur-text-muted)]">{fill(copy.adminFeeDue, { date: day(data.adminFee.nextCutoffAt) })}</span><strong className="text-xl font-extrabold">{formatCurrency(unpaidFeeTotal)}</strong>{data.adminFee.overdue > 0 && <span className="block text-sm font-semibold text-rose-700 dark:text-rose-300">{copy.overdueFee}</span>}</div>
          <button className={`${buttonClass} bg-[var(--kucur-green)] text-[var(--kucur-on-green)]`} type="button" disabled={Boolean(busyAction)} onClick={() => act("settlement", () => financeService.settle(storeId, unpaidFees.map((row) => row.id), unpaidFeeTotal))}>{busyAction === "settlement" ? copy.sending : fill(copy.payAll, { amount: formatCurrency(unpaidFeeTotal) })}</button>
        </div>}
        {pendingFees.length > 0 && <p className="text-sm text-[var(--kucur-text-muted)]">{copy.adminFee}: {formatCurrency(pendingFees.reduce((sum, row) => sum + Number(row.feeAmount), 0))} · {copy.pending}</p>}
        {nextInstallment && <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${new Date(nextInstallment.dueAt) < now ? "bg-rose-50 dark:bg-rose-950/50" : "bg-[var(--kucur-surface-muted)]"}`}>
          <div className="min-w-0"><span className="block text-sm text-[var(--kucur-text-muted)]">{fill(new Date(nextInstallment.dueAt) < now ? copy.installmentOverdue : copy.installmentDue, { number: nextInstallment.installmentNumber, date: day(nextInstallment.dueAt) })}</span><strong className="text-xl font-extrabold">{formatCurrency(installmentAmount(nextInstallment))}</strong>{Number(nextInstallment.penaltyOutstanding) > 0 && <span className="block text-sm text-rose-700 dark:text-rose-300">{fill(copy.penalty, { amount: formatCurrency(nextInstallment.penaltyOutstanding) })}</span>}</div>
          <button className={`${buttonClass} ${unpaidFeeTotal ? "border border-[var(--kucur-border-strong)]" : "bg-[var(--kucur-green)] text-[var(--kucur-on-green)]"}`} type="button" disabled={Boolean(busyAction)} onClick={() => act(`installment-${nextInstallment.id}`, () => financeService.payInstallment(storeId, nextInstallment.id, installmentAmount(nextInstallment)))}>{busyAction === `installment-${nextInstallment.id}` ? copy.sending : fill(copy.payAll, { amount: formatCurrency(installmentAmount(nextInstallment)) })}</button>
        </div>}
      </section>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="finance-initial">
          <div><h2 className="text-lg font-extrabold" id="finance-initial">{copy.initialFee}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.initialHint}</p></div>
          {!fee ? <div className="grid gap-2"><p className="text-[15px] font-semibold">{copy.choosePlan}</p><div className="grid gap-2 sm:grid-cols-3">{Object.entries(copy.plans).map(([plan, label]) => <button className={`${buttonClass} border border-[var(--kucur-border-strong)]`} type="button" disabled={Boolean(busyAction)} onClick={() => act(`plan-${plan}`, () => financeService.setup(storeId, plan))} key={plan}>{busyAction === `plan-${plan}` ? copy.sending : label}</button>)}</div></div> : <>
            <div><strong className="text-[15px]">{fill(copy.paidOf, { paid: formatCurrency(fee.paid), total: formatCurrency(fee.total) })}</strong><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--kucur-surface-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={Number(fee.total)} aria-valuenow={Number(fee.paid)}><i className="block h-full rounded-full bg-[var(--kucur-green)]" style={{ width: `${Math.min(100, Number(fee.paid) / Number(fee.total || 1) * 100)}%` }} /></div></div>
            <ul className="grid divide-y divide-[var(--kucur-border)]">{installments.map((row) => <li className="flex items-center justify-between gap-3 py-2.5 text-[15px]" key={row.id}><div className="min-w-0"><strong className="block">{fill(copy.installment, { number: row.installmentNumber })}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{row.status === "PAID" ? fill(copy.paidOn, { date: day(row.paidAt) }) : isPending(row) ? copy.pending : fill(copy.dueOn, { date: day(row.dueAt) })}</span></div><div className="text-right"><strong className="block">{formatCurrency(row.status === "PAID" ? row.principalAmount : installmentAmount(row))}</strong><StatusBadge status={row.status} /></div></li>)}</ul>
          </>}
        </section>

        <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="finance-admin">
          <div><h2 className="text-lg font-extrabold" id="finance-admin">{copy.adminFee}</h2>{rate && <p className="text-sm text-[var(--kucur-text-muted)]">{fill(copy.adminHint, { rate })}</p>}</div>
          {months.length ? <ul className="finance-months grid divide-y divide-[var(--kucur-border)]">{months.map((month) => <li className="flex items-center justify-between gap-3 py-2.5 text-[15px]" key={month.key}><div className="min-w-0"><strong className="block">{formatDate(month.date, { month: "long", year: "numeric" })}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{fill(month.rows.length === 1 ? copy.order : copy.orders, { count: month.rows.length })}</span></div><div className="text-right"><strong className="block">{formatCurrency(month.total)}</strong><span className={`text-sm font-bold ${month.unpaid ? "text-amber-700 dark:text-amber-300" : month.pending ? "text-[var(--kucur-text-muted)]" : "text-[var(--kucur-green-ink)]"}`}>{month.unpaid ? copy.unpaid : month.pending ? copy.pending : copy.paid}</span></div></li>)}</ul> : <EmptyState title={copy.noFees} description={copy.noFeesHint} />}
        </section>
      </div>
    </>}
  </PageContainer>;
}
