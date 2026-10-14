import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import { FinanceBadge as Badge, StoreFinanceStatus as StoreStatus } from "../../components/admin/FinanceBadges";
import { downloadCsv, reportFileName } from "../../utils/csv";
import { buildAdminFeeRecap, buildFinanceLedger, FINANCE_FILTERS, filterLedgers, sortLedgers } from "../../utils/adminFinance";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";
import "./AdminDeliveryFinance.css";

const COPY = {
  id: {
    eyebrow: "Admin Desa", title: "Keuangan", subtitle: "Lihat tagihan setiap lapak: mana yang lewat jatuh tempo, mana yang segera jatuh tempo, dan konfirmasi pembayaran yang masuk.",
    remindAll: "Ingatkan semua lapak", remindTitle: "Ingatkan semua lapak?", remindBody: "Pemilik {count} lapak yang masih punya tagihan akan menerima notifikasi berisi jumlah tagihan dan jatuh tempo terdekat. Setiap lapak paling banyak diingatkan sekali sehari.", remindNone: "Semua lapak sudah lunas. Tidak ada yang perlu diingatkan.", remindSend: "Kirim pengingat", cancel: "Batal",
    remindDone: "Pengingat terkirim ke {count} lapak.", remindAlready: "{count} lapak sudah diingatkan hari ini.", remindZero: "Tidak ada pengingat baru yang dikirim.",
    outstanding: "Belum dibayar", outstandingHint: "{count} lapak punya tagihan", overdue: "Lewat jatuh tempo", overdueHint: "{count} tagihan · {amount}", atRisk: "Berisiko ditangguhkan", atRiskHint: "Biaya admin lewat/dekat batas", suspended: "Lapak ditangguhkan", suspendedHint: "Aktif lagi setelah lunas", showOverdue: "Tampilkan lapak yang lewat jatuh tempo",
    confirmations: "Pembayaran menunggu konfirmasi", confirmationsHint: "Periksa uang sudah diterima, lalu konfirmasi. Tolak bila nominal tidak sesuai.", noPending: "Tidak ada pembayaran yang menunggu", noPendingHint: "Pembayaran yang diajukan lapak akan muncul di sini.", confirm: "Konfirmasi", reject: "Tolak", openStore: "Lihat lapak",
    kinds: { installment: "Cicilan iuran pokok ke-{number}", settlement: "Biaya admin ({count} tagihan)", contribution: "Iuran sukarela" },
    rejectTitle: "Tolak pembayaran ini?", rejectBody: "Lapak akan diberi tahu bahwa pembayarannya ditolak dan bisa mengajukan ulang.",
    stores: "Tagihan per lapak", storesHint: "Ketuk lapak untuk melihat rincian tagihan, cicilan, dan biaya admin.", filters: { all: "Semua", unpaid: "Belum dibayar", overdue: "Lewat jatuh tempo", dueSoon: "Jatuh tempo ≤7 hari", atRisk: "Berisiko ditangguhkan", suspended: "Ditangguhkan", paid: "Lunas" }, showList: "Tampilkan daftar lapak", confirmed: "Pembayaran dikonfirmasi.", rejected: "Pembayaran ditolak. Pemilik lapak diberi tahu.",
    unknownStore: "Lapak tanpa nama", noRows: "Tidak ada lapak di filter ini", noRowsHint: "Pilih filter lain untuk melihat lapak lainnya.", noData: "Belum ada tagihan lapak", noDataHint: "Tagihan muncul setelah lapak memilih skema iuran pokok atau ada pesanan selesai.",
    overdueBadge: "Lewat {days} hari", overdueCount: "{count} tagihan lewat jatuh tempo", dueSoon: "Jatuh tempo {date}", nextDue: "Jatuh tempo berikutnya {date}", paidUp: "Lunas", waiting: "{amount} menunggu konfirmasi", unpaidLabel: "belum dibayar",
    storeStatus: { active: "Aktif", suspended_admin_fee: "Ditangguhkan (biaya admin)", pending_initial_payment: "Menunggu iuran pertama", suspended: "Ditangguhkan", closed: "Tutup sementara", inactive: "Nonaktif" },
    download: "Unduh CSV", csv: { store: "Lapak", status: "Status lapak", unpaid: "Belum dibayar", overdue: "Tagihan lewat jatuh tempo", oldest: "Terlambat (hari)", nearest: "Jatuh tempo terdekat", paid: "Sudah dibayar" },
    automation: "Pembaruan status tagihan", automationHint: "Berjalan otomatis setiap jam. Tombol di bawah untuk menjalankannya sekarang juga.", runNow: "Jalankan sekarang",
    installmentsTitle: "Hitung denda cicilan", installmentsHelp: "Menandai cicilan iuran pokok yang lewat jatuh tempo dan menambahkan denda keterlambatan setiap 7 hari sesuai Pengaturan Platform. Aman dijalankan berkali-kali: denda tiap periode hanya dihitung sekali.",
    feesTitle: "Cek batas bayar biaya admin", feesHelp: "Menangguhkan lapak aktif yang biaya adminnya belum lunas melewati batas bayar (tanggal 1, sampai jam akhir masa tenggang), dan mengaktifkan lagi lapak yang sudah tidak punya tunggakan. Aman dijalankan berkali-kali.",
    installmentsDone: "Selesai: {count} cicilan diperiksa, {penalties} denda baru.", feesDone: "Selesai: {suspended} lapak ditangguhkan, {reactivated} lapak diaktifkan lagi.",
    recap: "Rekap biaya admin per bulan", recapHint: "Total biaya admin dari pesanan selesai, dikelompokkan per bulan tagihan.", recapDownload: "Unduh rekap (CSV)", recapEmpty: "Belum ada biaya admin", recapEmptyHint: "Rekap muncul setelah ada pesanan selesai.", recapCols: { month: "Bulan", orders: "Pesanan", total: "Total tagihan", collected: "Sudah ditarik", outstanding: "Belum ditarik", owing: "Lapak menunggak" }, recapCsv: { month: "Bulan", store: "Lapak", orders: "Jumlah pesanan", total: "Total tagihan", collected: "Sudah ditarik", outstanding: "Belum ditarik" }, recapFile: "rekap-biaya-admin",
    loading: "Memuat keuangan", loadFailed: "Data keuangan gagal dimuat.", actionFailed: "Aksi gagal diproses. Coba lagi.", retry: "Coba lagi", done: "Berhasil diproses.",
  },
  en: {
    eyebrow: "Village Admin", title: "Finance", subtitle: "See every store's bills: which are overdue, which are due soon, and incoming payments to confirm.",
    remindAll: "Remind all stores", remindTitle: "Remind all stores?", remindBody: "The owners of {count} stores with unpaid bills will get a notification with the amount and the nearest due date. Each store is reminded at most once a day.", remindNone: "Every store is paid up. Nobody needs a reminder.", remindSend: "Send reminders", cancel: "Cancel",
    remindDone: "Reminders sent to {count} stores.", remindAlready: "{count} stores were already reminded today.", remindZero: "No new reminders were sent.",
    outstanding: "Unpaid", outstandingHint: "{count} stores have bills", overdue: "Overdue", overdueHint: "{count} bills · {amount}", atRisk: "At risk of suspension", atRiskHint: "Admin fee past or near its deadline", suspended: "Suspended stores", suspendedHint: "Active again once paid", showOverdue: "Show overdue stores",
    confirmations: "Payments awaiting confirmation", confirmationsHint: "Check that the money arrived, then confirm. Reject if the amount is wrong.", noPending: "No payments waiting", noPendingHint: "Payments submitted by stores will appear here.", confirm: "Confirm", reject: "Reject", openStore: "View store",
    kinds: { installment: "Membership fee installment {number}", settlement: "Admin fees ({count} bills)", contribution: "Voluntary contribution" },
    rejectTitle: "Reject this payment?", rejectBody: "The store will be told the payment was rejected and can submit it again.",
    stores: "Bills per store", storesHint: "Tap a store to see its bills, installments, and admin fees.", filters: { all: "All", unpaid: "Unpaid", overdue: "Overdue", dueSoon: "Due in ≤7 days", atRisk: "At risk", suspended: "Suspended", paid: "Paid up" }, showList: "Show the store list", confirmed: "Payment confirmed.", rejected: "Payment rejected. The store owner has been notified.",
    unknownStore: "Unnamed store", noRows: "No stores in this filter", noRowsHint: "Choose another filter to see other stores.", noData: "No store bills yet", noDataHint: "Bills appear once a store picks a membership fee plan or an order is completed.",
    overdueBadge: "{days} days overdue", overdueCount: "Overdue bills: {count}", dueSoon: "Due {date}", nextDue: "Next due {date}", paidUp: "Paid up", waiting: "{amount} awaiting confirmation", unpaidLabel: "unpaid",
    storeStatus: { active: "Active", suspended_admin_fee: "Suspended (admin fee)", pending_initial_payment: "Awaiting first payment", suspended: "Suspended", closed: "Temporarily closed", inactive: "Inactive" },
    download: "Download CSV", csv: { store: "Store", status: "Store status", unpaid: "Unpaid", overdue: "Overdue bills", oldest: "Days overdue", nearest: "Nearest due date", paid: "Paid" },
    automation: "Bill status updates", automationHint: "Runs automatically every hour. Use the buttons below to run them right now.", runNow: "Run now",
    installmentsTitle: "Calculate installment penalties", installmentsHelp: "Marks overdue membership fee installments and adds a late penalty every 7 days as set in Admin Settings. Safe to run repeatedly: each period's penalty is only added once.",
    feesTitle: "Check admin fee deadlines", feesHelp: "Suspends active stores whose admin fees are still unpaid after the deadline (the 1st, until the grace time), and reactivates stores that no longer owe anything. Safe to run repeatedly.",
    installmentsDone: "Done: {count} installments checked, {penalties} new penalties.", feesDone: "Done: {suspended} stores suspended, {reactivated} stores reactivated.",
    recap: "Monthly admin fee recap", recapHint: "Admin fees from completed orders, grouped by billing month.", recapDownload: "Download recap (CSV)", recapEmpty: "No admin fees yet", recapEmptyHint: "The recap appears once orders are completed.", recapCols: { month: "Month", orders: "Orders", total: "Total billed", collected: "Collected", outstanding: "Not collected", owing: "Stores in arrears" }, recapCsv: { month: "Month", store: "Store", orders: "Orders", total: "Total billed", collected: "Collected", outstanding: "Not collected" }, recapFile: "admin-fee-recap",
    loading: "Loading finance monitoring", loadFailed: "Finance data could not be loaded.", actionFailed: "The action could not be completed. Please try again.", retry: "Try again", done: "Done.",
  },
};

const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replaceAll(`{${key}}`, replacement), text);
const sectionClass = "grid min-w-0 gap-3 border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 max-sm:-mx-3 max-sm:!max-w-none max-sm:border-y sm:rounded-2xl sm:border sm:p-5";

export default function AdminFinance() {
  const { formatCurrency, formatDate, language } = usePreferences();
  const copy = COPY[language === "en" ? "en" : "id"];
  const [data, setData] = useState(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("all");
  const [remindOpen, setRemindOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    try { const next = await financeService.monitor(); setNow(Date.now()); setData(next); setError(""); }
    catch { setError(copy.loadFailed); }
  }, [copy.loadFailed]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const failText = (cause) => (language === "id" && cause?.message ? cause.message : copy.actionFailed);
  const run = async (key, work, successText) => {
    setBusy(key); setFeedback({ type: "", text: "" });
    try { const result = await work(); setFeedback({ type: "success", text: successText ? successText(result) : copy.done }); await load(); return true; }
    catch (cause) { setFeedback({ type: "error", text: failText(cause) }); return false; }
    finally { setBusy(""); }
  };

  const storesRef = useRef(null);
  const showList = (key) => { setFilter(key); window.requestAnimationFrame(() => { storesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); const chip = storesRef.current?.querySelector(`[data-finance-filter="${key}"]`); chip?.parentElement?.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" }); }); };
  const ledgers = useMemo(() => (data ? sortLedgers(buildFinanceLedger(data, now)) : []), [data, now]);
  const visible = useMemo(() => filterLedgers(ledgers, filter), [filter, ledgers]);
  const counts = useMemo(() => Object.fromEntries(FINANCE_FILTERS.map((key) => [key, filterLedgers(ledgers, key).length])), [ledgers]);
  const totals = useMemo(() => ({
    outstanding: ledgers.reduce((sum, row) => sum + row.outstanding, 0),
    owing: ledgers.filter((row) => row.outstanding > 0).length,
    overdueCount: ledgers.reduce((sum, row) => sum + row.overdueCount, 0),
    overdueAmount: ledgers.reduce((sum, row) => sum + row.overdueAmount, 0),
    atRisk: ledgers.filter((row) => row.atRisk).length,
    suspended: data?.suspendedStores?.length ?? ledgers.filter((row) => row.suspended).length,
  }), [data, ledgers]);
  const recap = useMemo(() => buildAdminFeeRecap(ledgers), [ledgers]);
  const monthName = (row) => formatDate(new Date(row.year, row.month - 1, 1), { month: "long", year: "numeric" });
  const downloadRecap = () => downloadCsv(reportFileName(copy.recapFile), [
    { label: copy.recapCsv.month, value: (row) => row.key },
    { label: copy.recapCsv.store, value: (row) => row.storeName || copy.unknownStore },
    { label: copy.recapCsv.orders, value: (row) => row.orders },
    { label: copy.recapCsv.total, value: (row) => Math.round(row.total) },
    { label: copy.recapCsv.collected, value: (row) => Math.round(row.paid) },
    { label: copy.recapCsv.outstanding, value: (row) => Math.round(row.outstanding) },
  ], recap.perStore);
  const confirmations = useMemo(() => ledgers.flatMap((row) => row.confirmations.map((item) => ({ ...item, storeId: row.storeId, storeName: row.storeName }))).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)), [ledgers]);

  const day = (value) => (value ? formatDate(value, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "–");
  const statusText = (status) => copy.storeStatus[status] || copy.storeStatus.inactive;
  const kindText = (item) => fill(copy.kinds[item.kind], { number: item.number ?? "", count: item.count ?? "" });

  const remindAll = async () => {
    const ok = await run("remind", () => financeService.remind(), (result) => [result.reminded ? fill(copy.remindDone, { count: result.reminded }) : copy.remindZero, result.alreadyReminded ? fill(copy.remindAlready, { count: result.alreadyReminded }) : ""].filter(Boolean).join(" "));
    void ok; setRemindOpen(false);
  };
  const downloadReport = () => downloadCsv(reportFileName(language === "id" ? "tagihan-per-lapak" : "bills-by-store"), [
    { label: copy.csv.store, value: (row) => row.storeName || copy.unknownStore },
    { label: copy.csv.status, value: (row) => statusText(row.storeStatus) },
    { label: copy.csv.unpaid, value: (row) => Math.round(row.outstanding) },
    { label: copy.csv.overdue, value: (row) => row.overdueCount },
    { label: copy.csv.oldest, value: (row) => row.oldestOverdueDays || "" },
    { label: copy.csv.nearest, value: (row) => (row.nearestDue?.dueAt ? String(row.nearestDue.dueAt).slice(0, 10) : "") },
    { label: copy.csv.paid, value: (row) => Math.round(row.paidTotal) },
  ], visible);

  return <div className="page-container admin-finance-page min-w-0">
    <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.subtitle} actions={data ? <Button disabled={Boolean(busy)} onClick={() => setRemindOpen(true)}><BellIcon />{copy.remindAll}</Button> : null} />
    {error && <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{copy.retry}</Button></section>}
    {feedback.text && <p role={feedback.type === "error" ? "alert" : "status"} className={`admin-feedback ${feedback.type === "error" ? "error" : "success"}`}>{feedback.text}</p>}
    {!data ? (error ? null : <LoadingPanel label={copy.loading} rows={5} />) : <>
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Kartu ringkas = pintasan: ketuk untuk menyaring daftar lapak dan langsung menggulir ke sana. */}
        <Stat label={copy.outstanding} value={formatCurrency(totals.outstanding)} hint={fill(copy.outstandingHint, { count: totals.owing })} active={filter === "unpaid"} onClick={() => showList("unpaid")} actionLabel={copy.showList} />
        <Stat label={copy.overdue} value={String(totals.overdueCount)} hint={fill(copy.overdueHint, { count: totals.overdueCount, amount: formatCurrency(totals.overdueAmount) })} tone={totals.overdueCount ? "danger" : ""} active={filter === "overdue"} onClick={() => showList("overdue")} actionLabel={copy.showOverdue} />
        <Stat label={copy.atRisk} value={String(totals.atRisk)} hint={copy.atRiskHint} tone={totals.atRisk ? "warning" : ""} active={filter === "atRisk"} onClick={() => showList("atRisk")} actionLabel={copy.showList} />
        <Stat label={copy.suspended} value={String(totals.suspended)} hint={copy.suspendedHint} tone={totals.suspended ? "danger" : ""} active={filter === "suspended"} onClick={() => showList("suspended")} actionLabel={copy.showList} />
      </div>

      <section className={sectionClass} aria-labelledby="finance-confirmations">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-lg font-extrabold" id="finance-confirmations">{copy.confirmations}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.confirmationsHint}</p></div><strong className="admin-count-pill">{confirmations.length}</strong></div>
        {confirmations.length ? <ul className="grid divide-y divide-[var(--kucur-border)]">{confirmations.map((item) => <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4" key={`${item.kind}-${item.id}`}>
          <div className="min-w-0"><strong className="block break-words text-[15px]">{kindText(item)}</strong><Link className="text-sm font-semibold text-[var(--kucur-green-ink)] underline-offset-2 hover:underline" to={`/admin/finance/${item.storeId}`}>{item.storeName || copy.unknownStore}</Link><span className="text-sm text-[var(--kucur-text-muted)]">{item.createdAt ? ` · ${day(item.createdAt)}` : ""}</span></div>
          <strong className="text-lg sm:text-right">{formatCurrency(item.amount)}</strong>
          <div className="grid grid-cols-2 gap-2 sm:flex"><Button disabled={Boolean(busy)} onClick={() => run(`confirm-${item.id}`, () => financeService.confirm(item.kind, item.id, true), () => copy.confirmed)}>{copy.confirm}</Button><Button variant="secondary" disabled={Boolean(busy)} onClick={() => setRejecting(item)}>{copy.reject}</Button></div>
        </li>)}</ul> : <EmptyState title={copy.noPending} description={copy.noPendingHint} />}
      </section>

      <section className={`${sectionClass} scroll-mt-24`} aria-labelledby="finance-stores" ref={storesRef}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-lg font-extrabold" id="finance-stores">{copy.stores}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.storesHint}</p></div>{ledgers.length > 0 && <Button variant="secondary" onClick={downloadReport}><DownloadIcon />{copy.download}</Button>}</div>
        {ledgers.length > 0 && <div className="kucur-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={copy.stores}>{FINANCE_FILTERS.map((key) => <button className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold ${filter === key ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`} type="button" aria-pressed={filter === key} key={key} data-finance-filter={key} onClick={() => setFilter(key)}>{copy.filters[key]}<span className="rounded-full bg-[var(--kucur-surface-muted)] px-2 py-0.5 text-xs">{counts[key]}</span></button>)}</div>}
        {!ledgers.length ? <EmptyState title={copy.noData} description={copy.noDataHint} /> : visible.length ? <ul className="grid divide-y divide-[var(--kucur-border)]" aria-live="polite">{visible.map((row) => <li key={row.storeId}>
          <Link className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-1 py-3 hover:bg-[var(--kucur-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--kucur-green)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:px-2" to={`/admin/finance/${row.storeId}`}>
            <span className="col-start-1 row-start-1 grid min-w-0 gap-1 sm:col-start-auto sm:row-start-auto"><strong className="truncate text-[15px]">{row.storeName || copy.unknownStore}</strong><span className="flex flex-wrap items-center gap-1.5"><StoreStatus status={row.storeStatus} label={statusText(row.storeStatus)} />{row.overdueCount > 0 && <Badge tone="danger">{fill(copy.overdueBadge, { days: row.oldestOverdueDays })}</Badge>}</span></span>
            <span className="col-span-2 col-start-1 row-start-2 grid min-w-0 gap-0.5 text-sm text-[var(--kucur-text-muted)] sm:col-span-1 sm:col-start-auto sm:row-start-auto">
              {row.overdueCount > 0 ? <span className="font-semibold text-rose-700 dark:text-rose-300">{fill(copy.overdueCount, { count: row.overdueCount })}</span> : row.nearestDue ? <span className={row.dueSoonCount ? "font-semibold text-amber-800 dark:text-amber-200" : ""}>{fill(row.dueSoonCount ? copy.dueSoon : copy.nextDue, { date: day(row.nearestDue.dueAt) })}</span> : <span className="font-semibold text-[var(--kucur-green-ink)]">{copy.paidUp}</span>}
              {row.awaitingConfirmation > 0 && <span>{fill(copy.waiting, { amount: formatCurrency(row.awaitingConfirmation) })}</span>}
            </span>
            <span className="col-start-2 row-start-1 self-start text-right sm:col-start-auto sm:row-start-auto sm:self-center"><strong className={`block text-[15px] ${row.overdueCount ? "text-rose-700 dark:text-rose-300" : ""}`}>{formatCurrency(row.outstanding)}</strong><small className="text-xs text-[var(--kucur-text-muted)]">{copy.unpaidLabel}</small></span>
            <ChevronIcon />
          </Link>
        </li>)}</ul> : <EmptyState title={copy.noRows} description={copy.noRowsHint} />}
      </section>

      <section className={sectionClass} aria-labelledby="finance-recap">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-lg font-extrabold" id="finance-recap">{copy.recap}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.recapHint}</p></div>{recap.months.length > 0 && <Button variant="secondary" onClick={downloadRecap}><DownloadIcon />{copy.recapDownload}</Button>}</div>
        {recap.months.length ? <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--kucur-border)]"><table className="w-full min-w-[640px] border-collapse text-sm"><thead><tr>{[["month", ""], ["orders", " text-right"], ["total", " text-right"], ["collected", " text-right"], ["outstanding", " text-right"], ["owing", " text-right"]].map(([key, align]) => <th className={`whitespace-nowrap bg-[var(--kucur-surface-muted)] px-3 py-2.5 text-left text-xs font-bold text-[var(--kucur-text-muted)]${align}`} scope="col" key={key}>{copy.recapCols[key]}</th>)}</tr></thead><tbody>
          {recap.months.map((row) => <tr key={row.key}><th className="whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-left font-bold" scope="row">{monthName(row)}</th><td className="whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-right">{row.orders}</td><td className="whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-right font-semibold">{formatCurrency(row.total)}</td><td className="whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-right text-[var(--kucur-green-ink)]">{formatCurrency(row.paid)}</td><td className={`whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-right ${row.outstanding > 0 ? "font-semibold text-rose-700 dark:text-rose-300" : ""}`}>{formatCurrency(row.outstanding)}</td><td className="whitespace-nowrap border-t border-[var(--kucur-border)] px-3 py-3 text-right">{row.storesOwing}</td></tr>)}
        </tbody></table></div> : <EmptyState title={copy.recapEmpty} description={copy.recapEmptyHint} />}
      </section>

      <section className={sectionClass} aria-labelledby="finance-automation">
        <div><h2 className="text-lg font-extrabold" id="finance-automation">{copy.automation}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.automationHint}</p></div>
        <div className="grid gap-3 lg:grid-cols-2">
          <AutomationRow title={copy.installmentsTitle} help={copy.installmentsHelp} label={copy.runNow} busy={busy} running={busy === "installments"} onRun={() => run("installments", financeService.reconcileInstallments, (result) => fill(copy.installmentsDone, { count: result?.reconciled ?? 0, penalties: result?.penaltiesCreated ?? 0 }))} />
          <AutomationRow title={copy.feesTitle} help={copy.feesHelp} label={copy.runNow} busy={busy} running={busy === "fees"} onRun={() => run("fees", financeService.reconcileAdminFees, (result) => fill(copy.feesDone, { suspended: result?.suspended ?? 0, reactivated: result?.reactivated ?? 0 }))} />
        </div>
      </section>
    </>}

    <ActionDialog open={remindOpen} title={copy.remindTitle} description={totals.owing ? fill(copy.remindBody, { count: totals.owing }) : copy.remindNone} cancelLabel={copy.cancel} confirmLabel={copy.remindSend} confirmDisabled={!totals.owing} busy={busy === "remind"} onCancel={() => setRemindOpen(false)} onConfirm={remindAll} />
    <ActionDialog open={Boolean(rejecting)} destructive title={copy.rejectTitle} description={copy.rejectBody} cancelLabel={copy.cancel} confirmLabel={copy.reject} busy={Boolean(busy)} onCancel={() => setRejecting(null)} onConfirm={async () => { const item = rejecting; await run(`reject-${item.id}`, () => financeService.confirm(item.kind, item.id, false), () => copy.rejected); setRejecting(null); }}>
      {rejecting && <p className="text-[15px]"><strong>{kindText(rejecting)}</strong> · {rejecting.storeName || copy.unknownStore} · {formatCurrency(rejecting.amount)}</p>}
    </ActionDialog>
  </div>;
}

function Stat({ label, value, hint, tone = "", onClick, actionLabel, active = false }) {
  const toneClass = tone === "danger" ? "text-rose-700 dark:text-rose-300" : tone === "warning" ? "text-amber-800 dark:text-amber-200" : "text-[var(--kucur-text)]";
  const body = <><span className="flex items-start justify-between gap-2 text-sm font-semibold text-[var(--kucur-text-muted)]"><span>{label}</span>{onClick && <svg className="mt-0.5 size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>}</span><strong className={`break-words text-xl font-extrabold sm:text-2xl ${toneClass}`}>{value}</strong><small className="text-xs text-[var(--kucur-text-muted)]">{hint}</small></>;
  const className = `grid min-w-0 content-start gap-1 rounded-2xl border bg-[var(--kucur-surface)] p-3 text-left sm:p-4 ${active ? "border-[var(--kucur-green)] ring-1 ring-[var(--kucur-green)]" : "border-[var(--kucur-border)]"}`;
  return onClick ? <button className={`${className} min-h-11 transition-colors hover:border-[var(--kucur-green)]`} type="button" aria-pressed={active} onClick={onClick} aria-label={`${label}: ${value}. ${actionLabel}`} data-no-busy>{body}</button> : <section className={className}>{body}</section>;
}

function AutomationRow({ title, help, label, busy, running, onRun }) {
  return <div className="grid content-start gap-2 rounded-xl bg-[var(--kucur-surface-muted)] p-3 sm:p-4"><strong className="text-[15px]">{title}</strong><p className="text-sm text-[var(--kucur-text-muted)]">{help}</p><Button className="justify-self-start" variant="secondary" disabled={Boolean(busy)} aria-busy={running} onClick={onRun}>{label}</Button></div>;
}

const BellIcon = () => <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
const DownloadIcon = () => <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" /></svg>;
const ChevronIcon = () => <svg className="hidden size-5 text-[var(--kucur-text-muted)] sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
