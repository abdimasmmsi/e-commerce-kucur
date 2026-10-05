import { useCallback, useEffect, useState } from "react";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";

const presets = [10000, 25000, 50000, 100000];

// Iuran sukarela: pilih/isi nominal, kirim, lalu lihat riwayatnya. Tidak memengaruhi status lapak.
export default function MerchantFinance() {
  const { errorMessage, formatCurrency, formatDate, language, t } = usePreferences();
  const copy = language === "id"
    ? { eyebrow: "Akun Merchant", title: "Iuran Sukarela", hint: "Sumbangan untuk kas pengelola desa. Boleh kapan saja, nominal bebas, dan tidak memengaruhi status lapak.", amount: "Nominal", other: "Nominal lain", send: "Kirim iuran {amount}", sendEmpty: "Kirim iuran", total: "Total iuran Anda", history: "Riwayat iuran", pending: "Menunggu konfirmasi pengelola" }
    : { eyebrow: "Merchant account", title: "Voluntary Contribution", hint: "A donation to the village management fund. Any time, any amount, and it never affects your store status.", amount: "Amount", other: "Other amount", send: "Send {amount}", sendEmpty: "Send contribution", total: "Your total contributions", history: "Contribution history", pending: "Waiting for manager confirmation" };
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const loadFailed = t("merchantFinancePage.contributionsLoadFailed");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await financeService.contributions()); }
    catch (cause) { setError(errorMessage(cause.code, loadFailed)); }
    finally { setLoading(false); }
  }, [errorMessage, loadFailed]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const confirmedTotal = items.filter((row) => String(row.paymentStatus).toUpperCase() === "PAID").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const submit = async (event) => {
    event.preventDefault();
    if (!valid) { setFeedback({ type: "error", text: t("merchantFinancePage.amountRequired") }); return; }
    setSubmitting(true); setFeedback({ type: "", text: "" });
    try { await financeService.contribute(value); setAmount(""); setFeedback({ type: "success", text: t("merchantFinancePage.contributionSaved") }); await load(); }
    catch (cause) { setFeedback({ type: "error", text: errorMessage(cause.code, t("merchantFinancePage.submissionFailed")) }); }
    finally { setSubmitting(false); }
  };

  return <PageContainer className="merchant-standard-page space-y-4">
    <header className="grid gap-1"><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{copy.eyebrow}</span><h1 className="text-2xl font-extrabold sm:text-3xl">{copy.title}</h1><p className="max-w-2xl text-[15px] text-[var(--kucur-text-muted)]">{copy.hint}</p></header>
    {feedback.text && <p className={`rounded-xl p-3 text-[15px] font-semibold ${feedback.type === "error" ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)]"}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error} <button className="ml-2 font-bold underline" type="button" onClick={load}>{t("merchantFinancePage.retry")}</button></p>}
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <form className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" onSubmit={submit}>
        <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0"><legend className="mb-1 p-0 text-[15px] font-bold">{copy.amount}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{presets.map((preset) => <button className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${value === preset ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)]"}`} type="button" aria-pressed={value === preset} key={preset} onClick={() => { setAmount(String(preset)); setFeedback({ type: "", text: "" }); }}>{formatCurrency(preset)}</button>)}</div></fieldset>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.other}<input className="min-h-12 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base" type="number" min="1" step="1000" inputMode="numeric" placeholder={t("merchantFinancePage.amountPlaceholder")} value={amount} onChange={(event) => { setAmount(event.target.value); setFeedback({ type: "", text: "" }); }}/></label>
        <button className="min-h-12 rounded-xl bg-[var(--kucur-green)] px-4 text-base font-bold text-[var(--kucur-on-green)] disabled:opacity-50" type="submit" disabled={submitting || !valid}>{submitting ? t("merchantFinancePage.submitting") : valid ? copy.send.replace("{amount}", formatCurrency(value)) : copy.sendEmpty}</button>
      </form>
      <section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="contribution-history">
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-lg font-extrabold" id="contribution-history">{copy.history}</h2><div className="text-right"><span className="block text-sm text-[var(--kucur-text-muted)]">{copy.total}</span><strong className="text-lg">{formatCurrency(confirmedTotal)}</strong></div></div>
        {loading ? <LoadingPanel label={t("merchantFinancePage.loading")} rows={3} /> : items.length ? <ul className="grid divide-y divide-[var(--kucur-border)]">{items.map((row) => <li className="flex items-center justify-between gap-3 py-2.5" key={row.id}><div><strong className="block text-[15px]">{formatCurrency(row.amount)}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{row.createdAt ? formatDate(row.createdAt, { dateStyle: "medium" }) : ""}{String(row.paymentStatus).toUpperCase() === "PENDING" ? ` · ${copy.pending}` : ""}</span></div><StatusBadge status={row.paymentStatus}/></li>)}</ul> : <EmptyState title={t("merchantFinancePage.emptyContributions")} description={t("merchantFinancePage.emptyContributionsHint")}/>}
      </section>
    </div>
  </PageContainer>;
}
