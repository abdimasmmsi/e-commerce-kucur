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
  const { language, t } = usePreferences();
  const copy = language === "id"
    ? { description: "Data akun dan batas pengiriman kamu.", limitTitle: "Batas pengiriman", activeLimit: "Maks. pengiriman aktif sekaligus", dailyLimit: "Maks. pengiriman desa per hari", limitHint: "Batas ini diatur oleh admin desa." }
    : { description: "Your account details and delivery limits.", limitTitle: "Delivery limits", activeLimit: "Max. active deliveries at once", dailyLimit: "Max. village deliveries per day", limitHint: "These limits are set by the village admin." };
  const { settings } = useSystemSettings();
  const [state, setState] = useState({ loading: true, profile: null, error: "" });
  useEffect(() => {
    let active = true;
    deliveryApi.profile().then((profile) => { if (active) setState({ loading: false, profile, error: "" }); }).catch((error) => { if (active) setState({ loading: false, profile: null, error: error.message }); });
    return () => { active = false; };
  }, []);

  return <div className="page-container min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.courierEyebrow")} title={t("workspace.settings")} description={copy.description}/>
    {state.error && <section className="mb-4 rounded-kucur-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{state.error}</section>}
    {state.loading ? <LoadingPanel label={t("courierDelivery.loading")} rows={3}/> : <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--kucur-border)] pb-4"><div><span className="text-xs font-bold uppercase tracking-wider text-[var(--kucur-text-muted)]">{t("header.profile")}</span><h2 className="mt-1 text-lg font-semibold text-kucur-ink">{user.fullName}</h2></div><StatusBadge status={state.profile?.isActive ? "ACTIVE" : "INACTIVE"}/></div>
        <dl className="grid gap-3 py-4 text-sm"><div><dt className="text-[var(--kucur-text-muted)]">{t("adminUsers.account")}</dt><dd className="mt-1 break-all font-semibold">{user.email}</dd></div><div><dt className="text-[var(--kucur-text-muted)]">{t("merchantOrderDetail.phone")}</dt><dd className="mt-1 font-semibold">{user.phone || t("merchantOrderDetail.unavailableValue")}</dd></div></dl>
        <Button as={Link} to="/profile" variant="secondary">{t("header.profile")}</Button>
      </section>
      <section className="rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-kucur-ink">{copy.limitTitle}</h2>
        <dl className="my-4 grid grid-cols-2 gap-3">{[[copy.activeLimit, state.profile?.maxActiveDeliveries], [copy.dailyLimit, settings.maxDailyDeliveries]].map(([label, value]) => <div className="grid content-start gap-1 rounded-xl bg-kucur-sand p-3" key={label}><dt className="text-sm text-[var(--kucur-text-muted)]">{label}</dt><dd className="m-0 text-2xl font-extrabold text-kucur-ink">{value ?? "—"}</dd></div>)}</dl>
        <p className="mb-4 text-sm text-[var(--kucur-text-muted)]">{copy.limitHint}</p>
        <Button as={Link} to="/courier/availability">{t("courierDelivery.availability")}</Button>
      </section>
    </div>}
  </div>;
}
