import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";

export default function Availability() {
  const { formatDate, t } = usePreferences();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ startAt: "", endAt: "", reason: "" });
  const [state, setState] = useState({ loading: true, busy: false, error: "" });
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try { setRows(await deliveryApi.availability()); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, loading: false })); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const activePeriod = useMemo(() => {
    const now = new Date();
    return rows.find((row) => new Date(row.startAt) <= now && (!row.endAt || new Date(row.endAt) > now));
  }, [rows]);
  const submit = async (event) => {
    event.preventDefault();
    setState((value) => ({ ...value, busy: true, error: "" }));
    try {
      await deliveryApi.unavailable({ ...form, endAt: form.endAt || null });
      setForm({ startAt: "", endAt: "", reason: "" });
      await load();
    } catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: false })); }
  };
  const endPeriod = async (id) => {
    setState((value) => ({ ...value, busy: true, error: "" }));
    try { await deliveryApi.endUnavailable(id); await load(); }
    catch (cause) { setState((value) => ({ ...value, error: cause.message })); }
    finally { setState((value) => ({ ...value, busy: false })); }
  };

  return <div className="page-container min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.courier")} title={t("courierDelivery.availability")} description={t("courierDelivery.availabilityHint")}/>
    {state.error && <section className="mb-4 rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</section>}
    {state.loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={3}/> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.65fr)]">
      <form className="grid content-start gap-4 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:grid-cols-2 sm:p-5" onSubmit={submit}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--kucur-border)] pb-4 sm:col-span-2"><h2 className="text-lg font-semibold text-kucur-ink">{t("courierDelivery.availability")}</h2><StatusBadge status={activePeriod ? "INACTIVE" : "ACTIVE"}/></div>
        <label className="grid gap-1.5 text-sm font-semibold">{t("courierDelivery.startAt")}<input className="min-h-11 w-full rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[var(--kucur-text)]" type="datetime-local" required value={form.startAt} onChange={(event) => setForm((value) => ({ ...value, startAt: event.target.value }))}/></label>
        <label className="grid gap-1.5 text-sm font-semibold">{t("courierDelivery.endAt")}<input className="min-h-11 w-full rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[var(--kucur-text)]" type="datetime-local" value={form.endAt} onChange={(event) => setForm((value) => ({ ...value, endAt: event.target.value }))}/></label>
        <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">{t("courierDelivery.reason")}<textarea className="min-h-24 w-full resize-y rounded-kucur-control border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-3 text-[var(--kucur-text)]" maxLength="255" value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))}/></label>
        <Button className="sm:col-span-2 sm:justify-self-start" disabled={state.busy || Boolean(activePeriod)} type="submit">{t("courierDelivery.savePeriod")}</Button>
      </form>
      <section className="min-w-0 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-kucur-ink">{t("courierDelivery.history")}</h2>
        <div className="grid gap-3">
          {rows.map((row) => <article className="grid min-w-0 gap-2 rounded-xl border border-[var(--kucur-border)] p-3" key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-2"><strong className="break-words text-sm">{formatDate(row.startAt, { dateStyle: "medium", timeStyle: "short" })}</strong><StatusBadge status={!row.endAt ? "ACTIVE" : "COMPLETED"}/></div>
            <span className="text-xs text-[var(--kucur-text-muted)]">{row.endAt ? formatDate(row.endAt, { dateStyle: "medium", timeStyle: "short" }) : t("courierDelivery.active")}</span>
            <p className="break-words text-sm text-[var(--kucur-text-muted)]">{row.reason || t("courierDelivery.noReason")}</p>
            {!row.endAt && <Button className="justify-self-start" variant="secondary" disabled={state.busy} onClick={() => void endPeriod(row.id)}>{t("courierDelivery.endNow")}</Button>}
          </article>)}
          {!rows.length && <EmptyState title={t("courierDelivery.empty")} description={t("courierDelivery.availabilityHint")}/>} 
        </div>
      </section>
    </div>}
  </div>;
}
