import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSystemSettings } from "../../context/SystemSettingsContext";
import { deliveryApi } from "../../services/deliveryApiService";

export default function Settings() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { settings } = useSystemSettings();
  const [state, setState] = useState({ loading: true, profile: null, error: "" });
  useEffect(() => {
    let active = true;
    deliveryApi.profile().then((profile) => { if (active) setState({ loading: false, profile, error: "" }); }).catch((error) => { if (active) setState({ loading: false, profile: null, error: error.message }); });
    return () => { active = false; };
  }, []);

  return <div className="page-container min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.courier")} title={t("workspace.settings")} description={t("courierDelivery.availabilityHint")}/>
    {state.error && <section className="mb-4 rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</section>}
    {state.loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={3}/> : <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kucur-border)] pb-4"><div><span className="text-xs font-bold uppercase tracking-wider text-[var(--kucur-text-muted)]">{t("header.profile")}</span><h2 className="mt-1 text-lg font-semibold text-kucur-ink">{user.fullName}</h2></div><StatusBadge status={state.profile?.isActive ? "ACTIVE" : "INACTIVE"}/></div>
        <dl className="grid gap-3 py-4 text-sm"><div><dt className="text-[var(--kucur-text-muted)]">{t("adminUsers.account")}</dt><dd className="mt-1 break-all font-semibold">{user.email}</dd></div><div><dt className="text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.phone")}</dt><dd className="mt-1 font-semibold">{user.phone || t("merchantOrderDetail.unavailableValue")}</dd></div></dl>
        <Button as={Link} to="/profile" variant="secondary">{t("header.profile")}</Button>
      </section>
      <section className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--kucur-text-muted)]">{t("workspace.courier")}</span><h2 className="mt-1 text-lg font-semibold text-kucur-ink">{t("workspace.activeDeliveries")}</h2>
        <div className="my-4 rounded-xl bg-kucur-sand p-4"><strong className="block text-2xl text-kucur-ink">{state.profile?.maxActiveDeliveries ?? "—"} / {settings.maxDailyDeliveries}</strong><span className="mt-1 block text-sm text-[var(--kucur-text-muted)]">{t("courierDelivery.availabilityHint")}</span></div>
        <Button as={Link} to="/courier/availability">{t("courierDelivery.availability")}</Button>
      </section>
    </div>}
  </div>;
}
