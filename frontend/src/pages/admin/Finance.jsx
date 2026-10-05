import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import { downloadCsv, reportFileName } from "../../utils/csv";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";
import "./AdminDeliveryFinance.css";

const upper = (value) => String(value || "").toUpperCase();
const amountOf = (row) => Number(row.amount ?? row.totalAmount ?? 0);

export default function AdminFinance() {
  const { formatCurrency, formatDate, language, t } = usePreferences();
  const storeCopy = language === "id" ? { store: "Lapak", unpaid: "Belum dibayar", paid: "Sudah dibayar", bills: "Tagihan", nearest: "Batas bayar", overdue: "Lewat batas", clear: "Lunas", hint: "Ringkasan biaya admin per lapak." } : { store: "Store", unpaid: "Unpaid", paid: "Paid", bills: "Bills", nearest: "Pay by", overdue: "Overdue", clear: "Paid up", hint: "Admin fee summary per store." };
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentTime] = useState(() => Date.now());
  const load = useCallback(async () => {
    try { setData(await financeService.monitor()); setError(""); }
    catch { setError(t("adminFinance.loadFailed")); }
  }, [t]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const run = async (work) => {
    setBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(t("adminFinance.success")); await load(); }
    catch { setError(t("adminFinance.loadFailed")); }
    finally { setBusy(false); }
  };

  const perStore = useMemo(() => {
    const groups = new Map();
    for (const row of data?.adminFees ?? []) {
      const key = row.store?.id ?? row.storeId;
      const group = groups.get(key) ?? { key, name: row.store?.name, unpaid: 0, paid: 0, count: 0, nearest: null, overdue: false };
      const amount = Number(row.feeAmount || row.amount || 0);
      group.count += 1;
      if (upper(row.status) === "PAID") group.paid += amount;
      else {
        group.unpaid += amount;
        if (row.cutoffAt && (!group.nearest || new Date(row.cutoffAt) < new Date(group.nearest))) group.nearest = row.cutoffAt;
        if (row.cutoffAt && new Date(row.cutoffAt).getTime() < currentTime) group.overdue = true;
      }
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.unpaid - a.unpaid);
  }, [currentTime, data]);
  const derived = useMemo(() => {
    if (!data) return null;
    const installments = data.initialFees.flatMap((fee) => fee.installments || []);
    const installmentPayments = installments.flatMap((row) => (row.payments || []).filter((payment) => upper(payment.paymentStatus) === "PENDING"));
    const confirmations = [
      ...installmentPayments.map((row) => ["installment", row]),
      ...(data.settlements || []).filter((row) => upper(row.paymentStatus) === "PENDING").map((row) => ["settlement", row]),
      ...(data.contributions || []).filter((row) => upper(row.paymentStatus || row.status) === "PENDING").map((row) => ["contribution", row]),
    ];
    const outstanding = data.adminFees.filter((row) => !["PAID", "CANCELLED"].includes(upper(row.status))).reduce((sum, row) => sum + Number(row.feeAmount || row.amount || 0), 0)
      + installments.reduce((sum, row) => sum + Number(row.principalOutstanding || 0) + Number(row.penaltyOutstanding || 0), 0);
    const overdue = data.adminFees.filter((row) => upper(row.status) !== "PAID" && row.cutoffAt && new Date(row.cutoffAt).getTime() <= currentTime).reduce((sum, row) => sum + Number(row.feeAmount || row.amount || 0), 0)
      + installments.filter((row) => upper(row.status) === "OVERDUE").reduce((sum, row) => sum + Number(row.principalOutstanding || 0) + Number(row.penaltyOutstanding || 0), 0);
    const paid = data.adminFees.filter((row) => upper(row.status) === "PAID").reduce((sum, row) => sum + Number(row.feeAmount || row.amount || 0), 0)
      + installments.filter((row) => upper(row.status) === "PAID").reduce((sum, row) => sum + Number(row.principalAmount || 0), 0);
    return { confirmations, outstanding, overdue, paid };
  }, [currentTime, data]);

  return <div className="page-container admin-finance-page min-w-0">
    <PageHeader eyebrow={t("adminFinance.eyebrow")} title={t("adminFinance.title")} description={t("adminFinance.subtitle")} actions={<><Button variant="secondary" disabled={busy} onClick={() => run(financeService.reconcileInstallments)}>{t("adminFinance.reconcileInstallments")}</Button><Button disabled={busy} onClick={() => run(financeService.reconcileAdminFees)}>{t("adminFinance.reconcileFees")}</Button></>} />
    {error && <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{t("adminFinance.retry")}</Button></section>}
    {message && <p role="status" className="admin-feedback success">{message}</p>}
    {!data ? (error ? null : <LoadingPanel label={t("adminFinance.loading")} rows={5} />) : <>
      <div className="finance-summary-grid">
        <section className="finance-summary-card attention"><span>{t("adminFinance.outstanding")}</span><strong>{formatCurrency(derived.outstanding)}</strong><small>{data.adminFees.length} {t("adminFinance.adminFees").toLowerCase()}</small></section>
        <section className="finance-summary-card danger"><span>{t("adminFinance.overdue")}</span><strong>{formatCurrency(derived.overdue)}</strong><small>{data.suspendedStores.length} {t("adminFinance.suspended").toLowerCase()}</small></section>
        <section className="finance-summary-card"><span>{t("adminFinance.paid")}</span><strong>{formatCurrency(derived.paid)}</strong><small>{data.initialFees.length} {t("adminFinance.initialFees").toLowerCase()}</small></section>
        <section className="finance-summary-card"><span>{t("adminFinance.pending")}</span><strong>{derived.confirmations.length}</strong><small>{data.contributions.length} {t("adminFinance.contributions").toLowerCase()}</small></section>
      </div>

      <section className="admin-ops-panel finance-confirmations">
        <div className="admin-section-heading"><div><h2>{t("adminFinance.confirmations")}</h2><p>{t("adminFinance.confirmationsHint")}</p></div><strong className="admin-count-pill">{derived.confirmations.length}</strong></div>
        {derived.confirmations.length ? <div className="confirmation-list">{derived.confirmations.map(([kind, row]) => <div className="confirmation-row" key={`${kind}-${row.id}`}><span><strong>{t(`adminFinance.${kind}`)}</strong><small>{row.createdAt ? formatDate(row.createdAt, { dateStyle: "medium" }) : t("adminFinance.notAvailable")}</small></span><b>{formatCurrency(amountOf(row))}</b><div><Button disabled={busy} onClick={() => run(() => financeService.confirm(kind, row.id, true))}>{t("adminFinance.confirm")}</Button><Button variant="danger" disabled={busy} onClick={() => run(() => financeService.confirm(kind, row.id, false))}>{t("adminFinance.reject")}</Button></div></div>)}</div> : <EmptyState title={t("adminFinance.noPending")} description={t("adminFinance.noPendingHint")} />}
      </section>

      <section className="finance-obligations-section">
        <div className="admin-section-heading"><div><h2>{t("adminFinance.obligations")}</h2><p>{storeCopy.hint}</p></div>{perStore.length > 0 && <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-text)] hover:border-[var(--kucur-green)] disabled:opacity-50" type="button" onClick={() => downloadCsv(reportFileName(language === "id" ? "biaya-admin-per-lapak" : "admin-fees-by-store"), [{ label: storeCopy.store, value: (row) => row.name }, { label: storeCopy.unpaid, value: (row) => Math.round(row.unpaid) }, { label: storeCopy.paid, value: (row) => Math.round(row.paid) }, { label: storeCopy.bills, value: (row) => row.count }, { label: storeCopy.nearest, value: (row) => (row.nearest ? String(row.nearest).slice(0, 10) : "") }], perStore)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>{language === "id" ? "Unduh CSV" : "Download CSV"}</button>}</div>
        {perStore.length ? <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>{storeCopy.store}</th><th className="numeric">{storeCopy.unpaid}</th><th className="numeric">{storeCopy.paid}</th><th>{storeCopy.bills}</th><th>{storeCopy.nearest}</th></tr></thead><tbody>{perStore.map((row) => <tr key={row.key}><td data-label={storeCopy.store}><strong>{row.name || t("adminFinance.unknownStore")}</strong></td><td className="numeric" data-label={storeCopy.unpaid}><strong className={row.overdue ? "text-rose-700 dark:text-rose-300" : ""}>{formatCurrency(row.unpaid)}</strong></td><td className="numeric" data-label={storeCopy.paid}>{formatCurrency(row.paid)}</td><td data-label={storeCopy.bills}>{row.count}</td><td data-label={storeCopy.nearest}>{row.unpaid ? <span className={row.overdue ? "font-bold text-rose-700 dark:text-rose-300" : ""}>{row.overdue ? storeCopy.overdue : formatDate(row.nearest)}</span> : <span className="font-bold text-[var(--kucur-green-ink)]">{storeCopy.clear}</span>}</td></tr>)}</tbody></table></div> : <EmptyState title={t("adminFinance.noFees")} description={t("adminFinance.noFeesHint")} />}
      </section>
    </>}
  </div>;
}
