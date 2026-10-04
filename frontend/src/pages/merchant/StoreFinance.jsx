/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

const PAGE_SIZE = 8;

export default function StoreFinance() {
  const { storeId } = useParams();
  const { errorMessage, formatCurrency, formatDate, statusLabel, t } = usePreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [selected, setSelected] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [filter, setFilter] = useState({ period: "", start: "", end: "" });
  const [installmentPage, setInstallmentPage] = useState(1);
  const [obligationPage, setObligationPage] = useState(1);
  const selectAllRef = useRef(null);
  const date = (value) => value
    ? formatDate(value, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })
    : t("merchantFinancePage.dateUnavailable");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await financeService.summary(storeId)); }
    catch (cause) { setError(errorMessage(cause.code, t("merchantFinancePage.storeLoadFailed"))); }
    finally { setLoading(false); }
  }, [errorMessage, storeId, t]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key, work) => {
    setBusyAction(key);
    setFeedback({ type: "", text: "" });
    try {
      await work();
      setSelected([]);
      setFeedback({ type: "success", text: t("merchantFinancePage.submissionSaved") });
      await load();
    } catch (cause) {
      setFeedback({ type: "error", text: errorMessage(cause.code, t("merchantFinancePage.submissionFailed")) });
    } finally { setBusyAction(""); }
  };

  const fee = data?.initialFee;
  const obligations = useMemo(() => data?.adminFee?.obligations || [], [data]);
  const installments = useMemo(() => fee?.installments || [], [fee]);
  const visibleObligations = useMemo(() => filter.period
    ? filterByPeriod(obligations, (row) => row.cutoffAt || row.createdAt, filter.period, filter.start, filter.end)
    : obligations, [filter, obligations]);
  const visibleInstallments = useMemo(() => filter.period
    ? filterByPeriod(installments, (row) => row.dueAt || row.createdAt, filter.period, filter.start, filter.end)
    : installments, [filter, installments]);
  const pageInstallments = useMemo(() => paginate(visibleInstallments, installmentPage, PAGE_SIZE), [installmentPage, visibleInstallments]);
  const pageObligations = useMemo(() => paginate(visibleObligations, obligationPage, PAGE_SIZE), [obligationPage, visibleObligations]);
  const selectableObligationIds = useMemo(
    () => visibleObligations.filter((row) => row.status === "OUTSTANDING").map((row) => row.id),
    [visibleObligations],
  );
  const selectedVisibleCount = selectableObligationIds.filter((id) => selected.includes(id)).length;
  const allVisibleSelected = selectableObligationIds.length > 0 && selectedVisibleCount === selectableObligationIds.length;
  const chosen = obligations.filter((row) => selected.includes(row.id));
  const selectedTotal = chosen.reduce((sum, row) => sum + Number(row.feeAmount), 0);
  const plans = [["FULL", "payFull"], ["THREE_MONTHS", "threeMonths"], ["SIX_MONTHS", "sixMonths"]];
  const changeFilter = (next) => { setFilter(next); setSelected([]); setInstallmentPage(1); setObligationPage(1); };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, selectedVisibleCount]);

  const toggleAllVisibleObligations = (checked) => {
    setSelected((current) => checked
      ? [...new Set([...current, ...selectableObligationIds])]
      : current.filter((id) => !selectableObligationIds.includes(id)));
  };

  return <div className="page-container merchant-standard-page finance-page min-w-0">
    <PageHeader eyebrow={data?.store?.name || t("merchantFinancePage.storeEyebrow")} title={t("merchantFinancePage.storeFinance")} description={data ? t("merchantFinancePage.ledgerHint", { date: date(data.serverNow) }) : t("merchantFinancePage.storeFinanceHint")}/>
    <FinancePeriodFilter {...filter} onChange={changeFilter}/>

    {feedback.text && <p className={`finance-feedback is-${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}
    {error && <section className="finance-error-panel" role="alert"><div><strong>{t("merchantFinancePage.storeLoadFailed")}</strong><p>{error}</p></div><button className="secondary-button" type="button" onClick={load}>{t("merchantFinancePage.retry")}</button></section>}

    {loading ? <LoadingPanel label={t("merchantFinancePage.loading")} rows={4} /> : data && !error ? <>
      {data.adminFee.overdue > 0 && <section className="finance-overdue"><strong>{t("merchantFinancePage.overdueTitle", { amount: formatCurrency(data.adminFee.overdue) })}</strong><p>{t("merchantFinancePage.overdueHint")}</p></section>}

      <section className="finance-summary" aria-label={t("merchantFinancePage.currentSummary")}>
        {[["storeStatus", <StatusBadge status={data.store.status} key="status"/>], ["initialFeeBalance", formatCurrency(fee?.outstanding || 0)], ["adminFeeBalance", formatCurrency(data.adminFee.outstanding)]].map(([key, value]) => <article key={key}><small>{t(`merchantFinancePage.${key}`)}</small><strong>{value}</strong></article>)}
      </section>

      <section className="finance-card">
        <header><h2>{t("merchantFinancePage.initialFee")}</h2><p>{t("merchantFinancePage.initialFeeHint")}</p></header>
        {!fee ? <div><p>{t("merchantFinancePage.choosePlan")}</p><div className="finance-plan-options">{plans.map(([plan, key]) => <button type="button" disabled={Boolean(busyAction)} onClick={() => act(`plan-${plan}`, () => financeService.setup(storeId, plan))} key={plan}>{busyAction === `plan-${plan}` ? t("merchantFinancePage.submitting") : t(`merchantFinancePage.${key}`)}</button>)}</div></div> : visibleInstallments.length ? <><div className="finance-list">{pageInstallments.map((row) => <article key={row.id}><div className="finance-row-heading"><div><strong>{t("merchantFinancePage.installment", { number: row.installmentNumber })}</strong><small>{t("merchantFinancePage.dueDate")}: {date(row.dueAt)}</small></div><StatusBadge status={row.status}/></div><dl className="finance-detail-list"><div><dt>{t("merchantFinancePage.principal")}</dt><dd>{formatCurrency(row.principalOutstanding)}</dd></div><div><dt>{t("merchantFinancePage.penalty")}</dt><dd>{formatCurrency(row.penaltyOutstanding)}</dd></div><div><dt>{t("merchantFinancePage.plan")}</dt><dd>{statusLabel(fee.planType)}</dd></div><div><dt>{t("merchantFinancePage.total")}</dt><dd>{formatCurrency(Number(row.principalOutstanding) + Number(row.penaltyOutstanding))}</dd></div></dl>{row.status !== "PAID" && <button className="finance-action-button" type="button" disabled={Boolean(busyAction)} onClick={() => act(`installment-${row.id}`, () => financeService.payInstallment(storeId, row.id, Number(row.principalOutstanding) + Number(row.penaltyOutstanding)))}>{busyAction === `installment-${row.id}` ? t("merchantFinancePage.submitting") : t("merchantFinancePage.submitFullPayment")}</button>}</article>)}</div><Pagination page={installmentPage} pageSize={PAGE_SIZE} totalItems={visibleInstallments.length} onPageChange={setInstallmentPage}/></> : <EmptyState title={t("merchantFinancePage.filteredInstallmentsEmpty")} description={t("merchantFinancePage.filteredEmptyHint")}/>} 
      </section>

      <section className="finance-card">
        <header><h2>{t("merchantFinancePage.adminFee")}</h2><p>{t("merchantFinancePage.adminFeeHint")}</p></header>
        {visibleObligations.length ? <><label className="finance-select-all"><input ref={selectAllRef} type="checkbox" disabled={!selectableObligationIds.length || Boolean(busyAction)} checked={allVisibleSelected} onChange={(event) => toggleAllVisibleObligations(event.target.checked)}/><span><strong>{t("merchantFinancePage.selectAllOutstanding")}</strong><small>{t("merchantFinancePage.selectedObligations", { selected: selectedVisibleCount, total: selectableObligationIds.length })}</small></span></label><div className="finance-list">{pageObligations.map((row, index) => <label className="finance-obligation" key={row.id}><input type="checkbox" disabled={row.status !== "OUTSTANDING" || Boolean(busyAction)} checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}/><span><strong>{t("merchantFinancePage.obligation", { number: (obligationPage - 1) * PAGE_SIZE + index + 1 })}</strong><small>{statusLabel(row.feeTypeSnapshot)}{" \u00B7 "}{t("merchantFinancePage.cutoff", { date: date(row.cutoffAt) })}</small><b>{formatCurrency(row.feeAmount)}{" \u00B7 "}{statusLabel(row.status)}</b></span></label>)}</div><Pagination page={obligationPage} pageSize={PAGE_SIZE} totalItems={visibleObligations.length} onPageChange={setObligationPage}/></> : <EmptyState title={t(filter.period ? "merchantFinancePage.filteredObligationsEmpty" : "merchantFinancePage.emptyObligations")} description={t(filter.period ? "merchantFinancePage.filteredEmptyHint" : "merchantFinancePage.emptyObligationsHint")}/>} 
        {selected.length > 0 && <button className="finance-action-button" type="button" disabled={Boolean(busyAction)} onClick={() => act("settlement", () => financeService.settle(storeId, selected, selectedTotal))}>{busyAction === "settlement" ? t("merchantFinancePage.submitting") : t("merchantFinancePage.submitSettlement", { amount: formatCurrency(selectedTotal) })}</button>}
      </section>
    </> : !loading && !error && <EmptyState title={t("merchantFinancePage.unavailable")} description={t("merchantFinancePage.unavailableHint")}/>}
  </div>;
}
