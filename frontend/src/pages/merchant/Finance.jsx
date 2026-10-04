/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";
import { filterByPeriod } from "../../utils/datePeriod";
import { paginate } from "../../utils/pagination";
import FinancePeriodFilter from "./FinancePeriodFilter";
import "./Finance.css";

const PAGE_SIZE = 10;

export default function MerchantFinance() {
  const { errorMessage, formatCurrency, formatDate, t } = usePreferences();
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [filter, setFilter] = useState({ period: "", start: "", end: "" });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await financeService.contributions()); }
    catch (cause) { setError(errorMessage(cause.code, t("merchantFinancePage.contributionsLoadFailed"))); }
    finally { setLoading(false); }
  }, [errorMessage, t]);
  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => filter.period
    ? filterByPeriod(items, (row) => row.createdAt || row.paidAt, filter.period, filter.start, filter.end)
    : items, [filter, items]);
  const pageItems = useMemo(() => paginate(visibleItems, page, PAGE_SIZE), [page, visibleItems]);
  const visibleTotal = visibleItems.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paidCount = visibleItems.filter((row) => String(row.paymentStatus).toUpperCase() === "PAID").length;

  const submit = async (event) => {
    event.preventDefault();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setFeedback({ type: "error", text: t("merchantFinancePage.amountRequired") });
      return;
    }
    setSubmitting(true);
    setFeedback({ type: "", text: "" });
    try {
      await financeService.contribute(Number(amount));
      setAmount("");
      setFeedback({ type: "success", text: t("merchantFinancePage.contributionSaved") });
      await load();
    } catch (cause) {
      setFeedback({ type: "error", text: errorMessage(cause.code, t("merchantFinancePage.submissionFailed")) });
    } finally { setSubmitting(false); }
  };

  return <div className="page-container merchant-standard-page finance-page min-w-0">
    <PageHeader eyebrow={t("merchantFinancePage.merchantEyebrow")} title={t("merchantFinancePage.merchantFinance")} description={t("merchantFinancePage.contributionHint")}/>
    <FinancePeriodFilter {...filter} onChange={(next) => { setFilter(next); setPage(1); }}/>

    {feedback.text && <p className={`finance-feedback is-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}
    {error && <section className="finance-error-panel" role="alert"><div><strong>{t("merchantFinancePage.contributionsLoadFailed")}</strong><p>{error}</p></div><button className="secondary-button" type="button" onClick={load}>{t("merchantFinancePage.retry")}</button></section>}

    {loading ? <LoadingPanel label={t("merchantFinancePage.loading")} rows={4} /> : !error && <>
      <section className="finance-summary" aria-label={t("merchantFinancePage.periodSummary")}>
        {[["contributionCount", visibleItems.length], ["contributionTotal", formatCurrency(visibleTotal)], ["confirmedCount", paidCount]].map(([key, value]) => <article key={key}><small>{t(`merchantFinancePage.${key}`)}</small><strong>{value}</strong></article>)}
      </section>

      <section className="finance-card">
        <header><h2>{t("merchantFinancePage.voluntaryContribution")}</h2><p>{t("merchantFinancePage.contributionFormHint")}</p></header>
        <form className="finance-contribution-form" onSubmit={submit}><label><span>{t("merchantFinancePage.amount")}</span><input type="number" min="1" step="1" inputMode="numeric" placeholder={t("merchantFinancePage.amountPlaceholder")} value={amount} onChange={(event) => { setAmount(event.target.value); setFeedback({ type: "", text: "" }); }}/></label><button type="submit" disabled={submitting}>{t(submitting ? "merchantFinancePage.submitting" : "merchantFinancePage.submitPayment")}</button></form>
      </section>

      <section className="finance-card">
        <header><h2>{t("merchantFinancePage.history")}</h2><p>{t("merchantFinancePage.historyHint")}</p></header>
        {visibleItems.length ? <><div className="finance-list">{pageItems.map((row) => <article key={row.id}><div className="finance-row-heading"><div><strong>{formatCurrency(row.amount)}</strong><small>{row.createdAt ? formatDate(row.createdAt, { dateStyle: "medium", timeStyle: "short" }) : t("merchantFinancePage.dateUnavailable")}</small></div><StatusBadge status={row.paymentStatus}/></div></article>)}</div><Pagination page={page} pageSize={PAGE_SIZE} totalItems={visibleItems.length} onPageChange={setPage}/></> : <EmptyState title={t(filter.period ? "merchantFinancePage.filteredEmpty" : "merchantFinancePage.emptyContributions")} description={t(filter.period ? "merchantFinancePage.filteredEmptyHint" : "merchantFinancePage.emptyContributionsHint")}/>} 
      </section>
    </>}
  </div>;
}
