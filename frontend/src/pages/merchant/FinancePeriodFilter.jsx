import { DATE_PERIODS } from "../../utils/datePeriod";
import { usePreferences } from "../../context/PreferencesContext";

const buttonClass = (active) => `finance-period-button${active ? " is-active" : ""}`;

export default function FinancePeriodFilter({ period, start, end, onChange }) {
  const { t } = usePreferences();
  const setPeriod = (value) => onChange({ period: value, start: value === "custom" ? start : "", end: value === "custom" ? end : "" });

  return <section className="finance-toolbar" aria-label={t("merchantFinancePage.periodFilter")}>
    <div>
      <span>{t("merchantFinancePage.periodFilter")}</span>
      <div className="finance-period-options">
        <button className={buttonClass(!period)} type="button" onClick={() => setPeriod("")}>{t("orderManagement.allTime")}</button>
        {DATE_PERIODS.map(([value]) => <button className={buttonClass(period === value)} type="button" onClick={() => setPeriod(value)} key={value}>{t(`orderManagement.periods.${value}`)}</button>)}
      </div>
    </div>
    {period === "custom" && <div className="finance-date-range">
      <label><span>{t("orderManagement.startDate")}</span><input type="date" value={start} max={end || undefined} onChange={(event) => onChange({ period, start: event.target.value, end })}/></label>
      <label><span>{t("orderManagement.endDate")}</span><input type="date" value={end} min={start || undefined} onChange={(event) => onChange({ period, start, end: event.target.value })}/></label>
    </div>}
  </section>;
}
