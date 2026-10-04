import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BUG_REPORT_STORAGE_KEY, BUG_REPORT_UPDATED_EVENT, getBugReports } from "../../services/mockBugReportService";
import { usePreferences } from "../../context/PreferencesContext";
import { matchesStatusFilter } from "../../utils/statusFilter";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import { adminBugReportCopy, localizedBugStatus } from "./adminBugReportCopy";
import "./BugReports.css";

export default function BugReports() {
  const { user } = useAuth(); const { formatDate, language } = usePreferences(); const c = adminBugReportCopy[language] ?? adminBugReportCopy.id;
  const [reports, setReports] = useState(getBugReports); const [search, setSearch] = useState(""); const [status, setStatus] = useState("all");
  useEffect(() => { const refresh = () => setReports(getBugReports()); const handleStorage = (event) => { if (event.key === BUG_REPORT_STORAGE_KEY) refresh(); }; window.addEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.addEventListener("storage", handleStorage); return () => { window.removeEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.removeEventListener("storage", handleStorage); }; }, []);
  const rows = useMemo(() => reports.filter((report) => matchesStatusFilter(report.status, status, ["resolved"])).filter((report) => { const query = search.trim().toLowerCase(); return !query || [report.reportNumber, report.subject, report.reporterName, report.reporterRole].some((value) => value?.toLowerCase().includes(query)); }), [reports, search, status]);
  return <div className="page-container admin-bug-page">
    <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.subtitle} actions={<Button as={Link} variant="secondary" to="/report-bug" state={{ from: "/admin/bug-reports" }}>{c.reportBug}</Button>} />
    <section className="admin-bug-toolbar"><label><span>{c.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c.searchHint} /></label><label><span>{c.status}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{c.allStatus}</option><option value="uncompleted">{c.uncompleted}</option>{["open", "in-progress", "resolved"].map((value) => <option value={value} key={value}>{localizedBugStatus(value, language)}</option>)}</select></label></section>
    <div className="admin-bug-list">{rows.map((report) => { const unread = !(report.readBy ?? []).includes(user.id); return <article className={`admin-bug-card${unread ? " unread" : ""}`} key={report.id}><div className="admin-bug-card-heading"><div><span>{report.reportNumber}{unread && <i>{c.new}</i>}</span><h2>{report.subject}</h2></div><StatusBadge status={report.status}>{localizedBugStatus(report.status, language)}</StatusBadge></div><dl><div><dt>{c.reporter}</dt><dd>{report.reporterName}</dd></div><div><dt>{c.role}</dt><dd>{report.reporterRole}</dd></div><div><dt>{c.submitted}</dt><dd>{formatDate(report.createdAt, { dateStyle: "medium", timeStyle: "short" })}</dd></div><div><dt>{c.screenshots}</dt><dd>{report.screenshots.length} {c.files}</dd></div><div><dt>{c.clarification}</dt><dd>{report.messages.length} {c.messages}</dd></div></dl><p>{report.description}</p><Button as={Link} variant="secondary" to={`/admin/bug-reports/${report.id}`}>{c.view}</Button></article>; })}</div>
    {!rows.length && <EmptyState title={c.empty} description={c.emptyHint} />}
  </div>;
}
