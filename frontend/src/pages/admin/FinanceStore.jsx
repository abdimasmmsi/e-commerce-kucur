import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { FinanceBadge, StoreFinanceStatus } from "../../components/admin/FinanceBadges";
import { buildFinanceLedger, daysBetween, groupAdminFeesByMonth, STATE_TONE } from "../../utils/adminFinance";
import { usePreferences } from "../../context/PreferencesContext";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { financeService } from "../../services/financeService";
import "./AdminDeliveryFinance.css";

const COPY = {
  id: {
    back: "Kembali ke Keuangan", eyebrow: "Rincian keuangan lapak", remind: "Ingatkan lapak ini", remindTitle: "Kirim pengingat ke lapak ini?", remindBody: "Pemilik lapak menerima notifikasi berisi total tagihan dan jatuh tempo terdekat. Paling banyak sekali sehari.", remindSend: "Kirim pengingat", cancel: "Batal",
    reminded: "Pengingat terkirim ke pemilik lapak.", alreadyReminded: "Lapak ini sudah diingatkan hari ini.", nothingToRemind: "Lapak ini tidak punya tagihan yang belum dibayar.",
    outstanding: "Belum dibayar", overdue: "Lewat jatuh tempo", overdueValue: "{count} tagihan · {amount}", oldest: "Tunggakan paling lama", oldestNone: "Tidak ada", waiting: "Menunggu konfirmasi", paid: "Sudah dibayar",
    statusReason: { suspended_admin_fee: "Ditangguhkan otomatis karena biaya admin belum lunas setelah batas bayar. Lapak aktif lagi begitu tunggakan biaya admin dikonfirmasi lunas.", pending_initial_payment: "Belum aktif: menunggu pembayaran pertama iuran pokok dikonfirmasi.", active: "Lapak aktif dan bisa menerima pesanan.", suspended: "Lapak ditangguhkan oleh Admin.", closed: "Ditutup sementara oleh pemilik lapak." },
    storeStatus: { active: "Aktif", suspended_admin_fee: "Ditangguhkan (biaya admin)", pending_initial_payment: "Menunggu iuran pertama", suspended: "Ditangguhkan", closed: "Tutup sementara", inactive: "Nonaktif" },
    confirmations: "Pembayaran menunggu konfirmasi", confirm: "Konfirmasi", reject: "Tolak", rejectTitle: "Tolak pembayaran ini?", rejectBody: "Lapak diberi tahu pembayarannya ditolak dan bisa mengajukan ulang.",
    kinds: { installment: "Cicilan iuran pokok ke-{number}", settlement: "Biaya admin ({count} tagihan)", contribution: "Iuran sukarela" },
    initialFee: "Iuran pokok", noPlan: "Lapak belum memilih skema iuran pokok.", plan: "Skema", plans: { FULL: "Lunas sekali", THREE_MONTHS: "Cicil 3 kali", SIX_MONTHS: "Cicil 6 kali" }, total: "Total", lateInterest: "Denda telat {percent}% per 7 hari dari sisa tagihan",
    installment: "Cicilan ke-{number}", installmentCol: "Cicilan", due: "Jatuh tempo", amount: "Jumlah", penalty: "Denda", status: "Status", paidOn: "Dibayar",
    collect: "Tandai sudah ditarik", collectTitle: "Tandai biaya admin sudah ditarik?", collectBody: "Catat bahwa biaya admin bulan ini sudah kamu terima langsung dari pemilik lapak, tanpa menunggu pengajuan pembayaran.", collectMonth: "Bulan", collectCount: "Jumlah tagihan", collectTotal: "Total", collectMethod: "Cara penarikan", methods: { CASH: "Tunai", TRANSFER: "Transfer", OTHER: "Lainnya" }, collectNote: "Catatan (opsional)", collectNoteHint: "Contoh: diterima di balai desa", collectConfirm: "Konfirmasi", collected: "Biaya admin {amount} ({count} tagihan) ditandai sudah ditarik.", reactivated: "Lapak aktif kembali.", collectPending: "Menunggu konfirmasi: konfirmasi atau tolak dulu di atas", collectBills: "{count} tagihan belum dibayar",
    adminFees: "Biaya admin per bulan", adminFeesHint: "Ditagih per bulan; batas bayar mengikuti tanggal di Pengaturan Platform (bulan berikutnya).", noAdminFees: "Belum ada biaya admin", noAdminFeesHint: "Biaya admin muncul setelah ada pesanan selesai.", month: "Bulan", orders: "Pesanan", cutoff: "Batas bayar",
    contributions: "Iuran sukarela", contributionsHint: "Sukarela, per akun penjual, tidak memengaruhi status lapak.", noContributions: "Belum ada iuran sukarela.",
    states: { paid: "Lunas", pending: "Menunggu konfirmasi", overdue: "Lewat jatuh tempo {days} hari", overdueToday: "Lewat jatuh tempo hari ini", dueSoon: "Jatuh tempo ≤7 hari", upcoming: "Belum jatuh tempo", cancelled: "Dibatalkan" },
    contributionStates: { PAID: "Dikonfirmasi", PENDING: "Menunggu konfirmasi", CANCELLED: "Ditolak", FAILED: "Ditolak" },
    notFound: "Lapak tidak ditemukan di data keuangan", notFoundHint: "Lapak ini belum punya tagihan, iuran, atau pembayaran.", loading: "Memuat rincian keuangan lapak", loadFailed: "Data keuangan gagal dimuat.", retry: "Coba lagi", done: "Berhasil diproses.", actionFailed: "Aksi gagal diproses. Coba lagi.", unknownStore: "Lapak tanpa nama",
  },
  en: {
    back: "Back to Finance", eyebrow: "Store finance details", remind: "Remind this store", remindTitle: "Send a reminder to this store?", remindBody: "The store owner gets a notification with the total unpaid and the nearest due date. At most once a day.", remindSend: "Send reminder", cancel: "Cancel",
    reminded: "Reminder sent to the store owner.", alreadyReminded: "This store was already reminded today.", nothingToRemind: "This store has no unpaid bills.",
    outstanding: "Unpaid", overdue: "Overdue", overdueValue: "{count} bills · {amount}", oldest: "Oldest overdue bill", oldestNone: "None", waiting: "Awaiting confirmation", paid: "Paid",
    statusReason: { suspended_admin_fee: "Suspended automatically because admin fees were still unpaid after the deadline. The store becomes active again once the overdue admin fees are confirmed as paid.", pending_initial_payment: "Not active yet: waiting for the first membership fee payment to be confirmed.", active: "The store is active and can receive orders.", suspended: "The store was suspended by an Admin.", closed: "Temporarily closed by the store owner." },
    storeStatus: { active: "Active", suspended_admin_fee: "Suspended (admin fee)", pending_initial_payment: "Awaiting first payment", suspended: "Suspended", closed: "Temporarily closed", inactive: "Inactive" },
    confirmations: "Payments awaiting confirmation", confirm: "Confirm", reject: "Reject", rejectTitle: "Reject this payment?", rejectBody: "The store is told the payment was rejected and can submit it again.",
    kinds: { installment: "Membership fee installment {number}", settlement: "Admin fees ({count} bills)", contribution: "Voluntary contribution" },
    initialFee: "Membership fee", noPlan: "The store has not chosen a membership fee plan yet.", plan: "Plan", plans: { FULL: "Pay in full", THREE_MONTHS: "3 installments", SIX_MONTHS: "6 installments" }, total: "Total", lateInterest: "Late penalty {percent}% of the remaining bill every 7 days",
    installment: "Installment {number}", installmentCol: "Installment", due: "Due", amount: "Amount", penalty: "Penalty", status: "Status", paidOn: "Paid",
    collect: "Mark as collected", collectTitle: "Mark admin fees as collected?", collectBody: "Record that this month's admin fees were received directly from the store owner, without waiting for a payment request.", collectMonth: "Month", collectCount: "Number of bills", collectTotal: "Total", collectMethod: "How it was collected", methods: { CASH: "Cash", TRANSFER: "Transfer", OTHER: "Other" }, collectNote: "Note (optional)", collectNoteHint: "Example: received at the village hall", collectConfirm: "Confirm", collected: "Admin fees {amount} ({count} bills) marked as collected.", reactivated: "The store is active again.", collectPending: "Awaiting confirmation: confirm or reject it above first", collectBills: "{count} unpaid bills",
    adminFees: "Admin fees per month", adminFeesHint: "Billed monthly; pay by the day set in Platform Settings (next month).", noAdminFees: "No admin fees yet", noAdminFeesHint: "Admin fees appear after orders are completed.", month: "Month", orders: "Orders", cutoff: "Pay by",
    contributions: "Voluntary contributions", contributionsHint: "Optional, per merchant account, never affects store status.", noContributions: "No voluntary contributions yet.",
    states: { paid: "Paid", pending: "Awaiting confirmation", overdue: "{days} days overdue", overdueToday: "Overdue today", dueSoon: "Due in ≤7 days", upcoming: "Not due yet", cancelled: "Cancelled" },
    contributionStates: { PAID: "Confirmed", PENDING: "Awaiting confirmation", CANCELLED: "Rejected", FAILED: "Rejected" },
    notFound: "Store not found in finance data", notFoundHint: "This store has no bills, contributions, or payments yet.", loading: "Loading store finance details", loadFailed: "Finance data could not be loaded.", retry: "Try again", done: "Done.", actionFailed: "The action could not be completed. Please try again.", unknownStore: "Unnamed store",
  },
};

const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replaceAll(`{${key}}`, replacement), text);
const sectionClass = "grid min-w-0 gap-3 border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 max-sm:-mx-3 max-sm:!max-w-none max-sm:border-y sm:rounded-2xl sm:border sm:p-5";
const tableWrap = "min-w-0 overflow-x-auto rounded-xl border border-[var(--kucur-border)]";
const th = "whitespace-nowrap bg-[var(--kucur-surface-muted)] px-3 py-2.5 text-left text-xs font-bold text-[var(--kucur-text-muted)]";
const td = "whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 align-middle";

// Rincian keuangan satu lapak untuk Admin: iuran pokok + cicilan, biaya admin per bulan, iuran sukarela, status lapak.
export default function AdminFinanceStore() {
  const { storeId } = useParams();
  const { formatCurrency, formatDate, language } = usePreferences();
  const copy = COPY[language === "en" ? "en" : "id"];
  const [data, setData] = useState(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState("");
  const [remindOpen, setRemindOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [collecting, setCollecting] = useState(null);
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try { const next = await financeService.monitor(); setNow(Date.now()); setData(next); setError(""); }
    catch { setError(copy.loadFailed); }
  }, [copy.loadFailed]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const silentRefresh = useCallback(async () => { try { const next = await financeService.monitor(); setNow(Date.now()); setData(next); } catch { /* data lama tetap tampil */ } }, []);
  useLiveRefresh(silentRefresh);

  const run = async (key, work, successText) => {
    setBusy(key); setFeedback({ type: "", text: "" });
    try { const result = await work(); setFeedback({ type: "success", text: successText ? successText(result) : copy.done }); await load(); return true; }
    catch (cause) { setFeedback({ type: "error", text: language === "id" && cause?.message ? cause.message : copy.actionFailed }); return false; }
    finally { setBusy(""); }
  };

  const ledger = useMemo(() => (data ? buildFinanceLedger(data, now).find((row) => row.storeId === storeId) || null : null), [data, now, storeId]);
  const months = useMemo(() => (ledger ? groupAdminFeesByMonth(ledger.adminFees, now) : []), [ledger, now]);
  const day = (value) => (value ? formatDate(value, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "–");
  const stateText = (state, dueAt) => {
    if (state !== "overdue") return copy.states[state] || copy.states.upcoming;
    const days = daysBetween(dueAt, now);
    return days ? fill(copy.states.overdue, { days }) : copy.states.overdueToday;
  };
  const monthLabel = (month) => formatDate(new Date(month.year, month.month - 1, 1), { month: "long", year: "numeric" });
  const openCollect = (month) => { setMethod("CASH"); setNote(""); setCollecting(month); };
  const submitCollect = async () => {
    const month = collecting;
    const ok = await run("collect", () => financeService.collectAdminFees(storeId, { obligationIds: month.collectIds, method, note: note.trim() }), (result) => [fill(copy.collected, { amount: formatCurrency(result?.amount ?? month.unpaid), count: result?.collected ?? month.collectIds.length }), result?.storeReactivated ? copy.reactivated : ""].filter(Boolean).join(" "));
    if (ok) setCollecting(null);
  };
  const kindText = (item) => fill(copy.kinds[item.kind], { number: item.number ?? "", count: item.count ?? "" });
  const backLink = <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[var(--kucur-green-ink)] hover:underline" to="/admin/finance"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>{copy.back}</Link>;

  if (!data) return <div className="page-container admin-finance-page min-w-0">{backLink}{error ? <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{copy.retry}</Button></section> : <LoadingPanel label={copy.loading} rows={5} />}</div>;
  if (!ledger) return <div className="page-container admin-finance-page min-w-0">{backLink}<EmptyState title={copy.notFound} description={copy.notFoundHint} /></div>;

  const status = ledger.storeStatus || "inactive";
  const contract = ledger.contract;
  const latePercent = ledger.installments.find((item) => item.latePercent != null)?.latePercent;

  return <div className="page-container admin-finance-page min-w-0">
    {backLink}
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid min-w-0 gap-1"><span className="text-sm font-semibold text-[var(--kucur-green-ink)]">{copy.eyebrow}</span><h1 className="break-words text-2xl font-extrabold sm:text-3xl">{ledger.storeName || copy.unknownStore}</h1><div className="flex flex-wrap items-center gap-2"><StoreFinanceStatus status={status} label={copy.storeStatus[status] || copy.storeStatus.inactive} /></div><p className="max-w-3xl text-sm text-[var(--kucur-text-muted)]">{copy.statusReason[status] || ""}</p></div>
      <Button className="shrink-0" disabled={Boolean(busy)} onClick={() => setRemindOpen(true)}>{copy.remind}</Button>
    </header>
    {feedback.text && <p role={feedback.type === "error" ? "alert" : "status"} className={`admin-feedback ${feedback.type === "error" ? "error" : "success"}`}>{feedback.text}</p>}

    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label={copy.outstanding} value={formatCurrency(ledger.outstanding)} tone={ledger.overdueCount ? "danger" : ""} />
      <Stat label={copy.overdue} value={fill(copy.overdueValue, { count: ledger.overdueCount, amount: formatCurrency(ledger.overdueAmount) })} tone={ledger.overdueCount ? "danger" : ""} />
      <Stat label={copy.oldest} value={ledger.oldestOverdue ? stateText("overdue", ledger.oldestOverdue.dueAt) : copy.oldestNone} hint={ledger.oldestOverdue ? `${ledger.oldestOverdue.kind === "installment" ? fill(copy.installment, { number: ledger.oldestOverdue.number }) : formatDate(new Date(ledger.oldestOverdue.billingYear, ledger.oldestOverdue.billingMonth - 1, 1), { month: "long", year: "numeric" })} · ${formatCurrency(ledger.oldestOverdue.amount)}` : ""} tone={ledger.oldestOverdue ? "danger" : ""} />
      <Stat label={copy.waiting} value={formatCurrency(ledger.awaitingConfirmation)} hint={`${copy.paid}: ${formatCurrency(ledger.paidTotal)}`} />
    </div>

    {ledger.confirmations.length > 0 && <section className={sectionClass} aria-labelledby="store-confirmations">
      <h2 className="text-lg font-extrabold" id="store-confirmations">{copy.confirmations}</h2>
      <ul className="grid divide-y divide-[var(--kucur-border)]">{ledger.confirmations.map((item) => <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4" key={`${item.kind}-${item.id}`}>
        <div className="min-w-0"><strong className="block text-[15px]">{kindText(item)}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{day(item.createdAt)}</span></div>
        <strong className="text-lg sm:text-right">{formatCurrency(item.amount)}</strong>
        <div className="grid grid-cols-2 gap-2 sm:flex"><Button disabled={Boolean(busy)} onClick={() => run(`confirm-${item.id}`, () => financeService.confirm(item.kind, item.id, true))}>{copy.confirm}</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => setRejecting(item)}>{copy.reject}</Button></div>
      </li>)}</ul>
    </section>}

    <section className={sectionClass} aria-labelledby="store-initial-fee">
      <div><h2 className="text-lg font-extrabold" id="store-initial-fee">{copy.initialFee}</h2>{contract && <p className="text-sm text-[var(--kucur-text-muted)]">{copy.plan}: {copy.plans[contract.planType] || contract.planType} · {copy.total}: {formatCurrency(contract.initialAmountSnapshot)}{latePercent != null ? ` · ${fill(copy.lateInterest, { percent: latePercent })}` : ""}</p>}</div>
      {!contract ? <p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.noPlan}</p> : <div className={tableWrap}><table className="w-full min-w-[560px] border-collapse text-sm"><thead><tr><th className={th} scope="col">{copy.installmentCol}</th><th className={th} scope="col">{copy.due}</th><th className={`${th} text-right`} scope="col">{copy.amount}</th><th className={`${th} text-right`} scope="col">{copy.penalty}</th><th className={th} scope="col">{copy.status}</th><th className={th} scope="col">{copy.paidOn}</th></tr></thead><tbody>
        {ledger.installments.map((item) => <tr className={item.state === "overdue" ? "bg-rose-50/60 dark:bg-rose-950/30" : ""} key={item.id}><th className={`${td} text-left font-bold`} scope="row">{fill(copy.installment, { number: item.number })}</th><td className={td}>{day(item.dueAt)}</td><td className={`${td} text-right font-semibold`}>{formatCurrency(item.paid ? item.principalAmount : item.amount)}</td><td className={`${td} text-right`}>{item.penalty ? formatCurrency(item.penalty) : "–"}</td><td className={td}><FinanceBadge tone={STATE_TONE[item.state]}>{stateText(item.state, item.dueAt)}</FinanceBadge></td><td className={td}>{item.paid ? day(item.paidAt) : "–"}</td></tr>)}
      </tbody></table></div>}
    </section>

    <section className={sectionClass} aria-labelledby="store-admin-fees">
      <div><h2 className="text-lg font-extrabold" id="store-admin-fees">{copy.adminFees}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.adminFeesHint}</p></div>
      {months.length ? <div className={tableWrap}><table className="w-full min-w-[620px] border-collapse text-sm"><thead><tr><th className={th} scope="col">{copy.month}</th><th className={`${th} text-right`} scope="col">{copy.orders}</th><th className={`${th} text-right`} scope="col">{copy.amount}</th><th className={th} scope="col">{copy.cutoff}</th><th className={th} scope="col">{copy.status}</th><th className={th} scope="col">{copy.paidOn}</th></tr></thead><tbody>
        {months.map((month) => <Fragment key={month.key}><tr className={month.state === "overdue" ? "bg-rose-50/60 dark:bg-rose-950/30" : ""}><th className={`${td} text-left font-bold`} scope="row">{monthLabel(month)}</th><td className={`${td} text-right`}>{month.items.length}</td><td className={`${td} text-right font-semibold`}>{formatCurrency(month.total)}{month.unpaid > 0 && month.unpaid !== month.total ? <small className="block text-xs font-normal text-[var(--kucur-text-muted)]">{copy.outstanding}: {formatCurrency(month.unpaid)}</small> : null}</td><td className={td}>{day(month.dueAt)}</td><td className={td}><FinanceBadge tone={STATE_TONE[month.state]}>{stateText(month.state, month.dueAt)}</FinanceBadge></td><td className={td}>{month.state === "paid" ? day(month.paidAt) : "–"}</td></tr>
          {month.pending > 0 ? <tr><td className="border-t border-dashed border-[var(--kucur-border)] bg-[var(--kucur-surface-muted)] px-3 py-2 text-sm text-[var(--kucur-text-muted)]" colSpan={6}><span className="sticky left-3 inline-block max-w-[calc(100vw-4rem)] whitespace-normal">{copy.collectPending}</span></td></tr> : month.collectIds.length > 0 ? <tr><td className="border-t border-dashed border-[var(--kucur-border)] bg-[var(--kucur-surface-muted)] px-3 py-2" colSpan={6}><div className="sticky left-3 flex max-w-[calc(100vw-4rem)] flex-wrap items-center gap-x-3 gap-y-2"><span className="text-sm text-[var(--kucur-text-muted)]">{fill(copy.collectBills, { count: month.collectIds.length })} · {formatCurrency(month.unpaid)}</span><Button variant="secondary" disabled={Boolean(busy)} onClick={() => openCollect(month)}>{copy.collect}</Button></div></td></tr> : null}
        </Fragment>)}
      </tbody></table></div> : <EmptyState title={copy.noAdminFees} description={copy.noAdminFeesHint} />}
    </section>

    <section className={sectionClass} aria-labelledby="store-contributions">
      <div><h2 className="text-lg font-extrabold" id="store-contributions">{copy.contributions}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.contributionsHint}</p></div>
      {ledger.contributions.length ? <ul className="grid divide-y divide-[var(--kucur-border)]">{[...ledger.contributions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((item) => <li className="flex items-center justify-between gap-3 py-2.5" key={item.id}><div className="min-w-0"><strong className="block text-[15px]">{formatCurrency(item.amount)}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{day(item.createdAt)}</span></div><FinanceBadge tone={item.status === "PAID" ? "success" : item.status === "PENDING" ? "info" : "danger"}>{copy.contributionStates[item.status] || item.status}</FinanceBadge></li>)}</ul> : <p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.noContributions}</p>}
    </section>

    <ActionDialog open={remindOpen} title={copy.remindTitle} description={ledger.outstanding > 0 ? copy.remindBody : copy.nothingToRemind} cancelLabel={copy.cancel} confirmLabel={copy.remindSend} confirmDisabled={!(ledger.outstanding > 0)} busy={busy === "remind"} onCancel={() => setRemindOpen(false)} onConfirm={async () => { await run("remind", () => financeService.remind(storeId), (result) => (result.reminded ? copy.reminded : result.alreadyReminded ? copy.alreadyReminded : copy.nothingToRemind)); setRemindOpen(false); }} />
    <ActionDialog open={Boolean(collecting)} title={copy.collectTitle} description={copy.collectBody} cancelLabel={copy.cancel} confirmLabel={copy.collectConfirm} busy={busy === "collect"} onCancel={() => setCollecting(null)} onConfirm={submitCollect}>
      {collecting && <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]"><dt className="text-[var(--kucur-text-muted)]">{copy.collectMonth}</dt><dd className="text-right font-bold">{monthLabel(collecting)}</dd><dt className="text-[var(--kucur-text-muted)]">{copy.collectCount}</dt><dd className="text-right font-bold">{collecting.collectIds.length}</dd><dt className="text-[var(--kucur-text-muted)]">{copy.collectTotal}</dt><dd className="text-right font-bold">{formatCurrency(collecting.unpaid)}</dd></dl>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-semibold">{copy.collectMethod}</legend><div className="grid grid-cols-3 gap-2">{["CASH", "TRANSFER", "OTHER"].map((key) => <label className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-sm font-bold ${method === key ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)]"}`} key={key}><input className="sr-only" type="radio" name="collect-method" value={key} checked={method === key} onChange={() => setMethod(key)} />{copy.methods[key]}</label>)}</div></fieldset>
        <label className="grid gap-1 text-sm font-semibold">{copy.collectNote}<input className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[15px] font-normal" type="text" maxLength={200} value={note} placeholder={copy.collectNoteHint} onChange={(event) => setNote(event.target.value)} /></label>
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(rejecting)} destructive title={copy.rejectTitle} description={copy.rejectBody} cancelLabel={copy.cancel} confirmLabel={copy.reject} busy={Boolean(busy)} onCancel={() => setRejecting(null)} onConfirm={async () => { const item = rejecting; await run(`reject-${item.id}`, () => financeService.confirm(item.kind, item.id, false)); setRejecting(null); }}>
      {rejecting && <p className="text-[15px]"><strong>{kindText(rejecting)}</strong> · {formatCurrency(rejecting.amount)}</p>}
    </ActionDialog>
  </div>;
}

function Stat({ label, value, hint = "", tone = "" }) {
  return <section className="grid min-w-0 content-start gap-1 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-3 sm:p-4"><span className="text-sm font-semibold text-[var(--kucur-text-muted)]">{label}</span><strong className={`break-words text-lg font-extrabold sm:text-xl ${tone === "danger" ? "text-rose-700 dark:text-rose-300" : "text-[var(--kucur-text)]"}`}>{value}</strong>{hint && <small className="text-xs text-[var(--kucur-text-muted)]">{hint}</small>}</section>;
}
