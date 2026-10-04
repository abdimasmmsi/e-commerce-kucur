import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { BUG_REPORT_STORAGE_KEY, BUG_REPORT_UPDATED_EVENT, bugReportStatusLabels, getUserBugReports } from "../../services/mockBugReportService";
import { matchesStatusFilter } from "../../utils/statusFilter";
import "./BugReportForm.css";
import "./BugAccountActions.css";
import "./MyBugReports.css";

function MyBugReports() {
  const { user } = useAuth();
  const { formatDate, t } = usePreferences();
  const [reports, setReports] = useState(() => getUserBugReports(user.id));
  const [status, setStatus] = useState("all");
  useEffect(() => {
    const refresh = () => setReports(getUserBugReports(user.id));
    const storage = (event) => { if (event.key === BUG_REPORT_STORAGE_KEY) refresh(); };
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.removeEventListener("storage", storage); };
  }, [user.id]);
  const rows = useMemo(() => {
    const priority = { "in-progress": 0, open: 1, resolved: 2 };
    return reports.filter((report) => matchesStatusFilter(report.status, status, ["resolved"])).sort((a, b) => {
      const statusDifference = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
      const aUpdated = a.messages.at(-1)?.createdAt ?? a.updatedAt ?? a.createdAt;
      const bUpdated = b.messages.at(-1)?.createdAt ?? b.updatedAt ?? b.createdAt;
      return statusDifference || new Date(bUpdated) - new Date(aUpdated);
    });
  }, [reports, status]);
  const statusLabel = (value) => t(`customerBugReports.status.${value.replace("-", "")}`);

  return <div className="page-container my-bug-page">
    <header className="account-profile-heading"><div><span>{t("account.eyebrow")}</span><h1>{t("customerBugReports.title")}</h1><p>{t("customerBugReports.subtitle")}</p></div><Link className="primary-button my-bug-create-button" to="/report-bug" state={{ from: "/my-bug-reports" }}>{t("customerBugReports.create")}</Link></header>
    <section className="my-bug-filter"><label><span>{t("customerBugReports.statusLabel")}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("customerBugReports.allStatuses")}</option><option value="uncompleted">{t("common.uncompleted")}</option>{Object.keys(bugReportStatusLabels).map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label></section>
    <div className="my-bug-list">{rows.map((report) => {
      const unread = !(report.readBy ?? []).includes(user.id);
      const latest = report.messages.at(-1)?.createdAt ?? report.updatedAt ?? report.createdAt;
      return <article className={`card${unread ? " unread" : ""}`} key={report.id}><div><span>{report.reportNumber}{unread && <i>{t("customerBugReports.new")}</i>}</span><span className={`bug-status ${report.status}`}>{statusLabel(report.status)}</span></div><h2>{report.subject}</h2><p>{report.description}</p><small>{t("customerBugReports.updated")} {formatDate(latest, { dateStyle: "medium", timeStyle: "short" })} · {t("customerBugReports.messages", { count: report.messages.length })}</small><Link to={`/my-bug-reports/${report.id}`}>{t("customerBugReports.view")}</Link></article>;
    })}</div>
    {!rows.length && <section className="bug-list-empty"><h2>{t("customerBugReports.empty")}</h2><p>{t("customerBugReports.emptyHint")}</p><Link className="primary-button" to="/report-bug">{t("customerBugReports.create")}</Link></section>}
  </div>;
}

export default MyBugReports;
