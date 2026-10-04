import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BugReportThread from "../../components/BugReportThread";
import BugScreenshotModal from "../../components/BugScreenshotModal";
import ChronologyOrderControl from "../../components/ChronologyOrderControl";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import { adminBugReportCopy, interpolateAdminBugCopy, localizedBugStatus } from "./adminBugReportCopy";
import { addBugReportMessage, BUG_REPORT_STORAGE_KEY, BUG_REPORT_UPDATED_EVENT, bugReportStatusLabels, getBugReportById, markBugReportRead, updateBugReportStatus } from "../../services/mockBugReportService";
import { markNotificationsByLink } from "../../services/notificationService";
import "./BugReports.css";
import "./AdminPrivateNotes.css";

function BugReportDetail() {
  const { reportId } = useParams();
  const { user } = useAuth();
  const { formatDate, language } = usePreferences();
  const c = adminBugReportCopy[language] ?? adminBugReportCopy.id;
  const [report, setReport] = useState(() => getBugReportById(reportId));
  const [status, setStatus] = useState(() => report?.status ?? "open");
  const [privateNote, setPrivateNote] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const [privateNoteOrder, setPrivateNoteOrder] = useState("desc");
  const [statusHistoryOrder, setStatusHistoryOrder] = useState("desc");
  const orderedPrivateNotes = useMemo(() => [...(report?.privateNotes ?? [])].sort((a, b) => {
    const difference = new Date(a.createdAt) - new Date(b.createdAt);
    return privateNoteOrder === "asc" ? difference : -difference;
  }), [privateNoteOrder, report?.privateNotes]);
  const orderedStatusHistory = useMemo(() => [...(report?.statusHistory ?? [])].sort((a, b) => {
    const difference = new Date(a.timestamp) - new Date(b.timestamp);
    return statusHistoryOrder === "asc" ? difference : -difference;
  }), [report?.statusHistory, statusHistoryOrder]);
  useEffect(() => {
    const refresh = () => {
      const current = getBugReportById(reportId);
      setReport(current);
      if (current) setStatus(current.status);
      markBugReportRead(reportId, user.id);
    };
    const storage = (event) => { if (event.key === BUG_REPORT_STORAGE_KEY) refresh(); };
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    markBugReportRead(reportId, user.id);
    markNotificationsByLink(`/admin/bug-reports/${reportId}`, user.id, "admin");
    return () => { window.removeEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.removeEventListener("storage", storage); };
  }, [reportId, user.id]);

  if (!report) return <div className="page-container"><EmptyState title={c.notFound} description={c.notFoundHint} action={<Button as={Link} variant="secondary" to="/admin/bug-reports">{c.back}</Button>} /></div>;
  const save = () => {
    if (status === report.status && !privateNote.trim()) {
      setNotice(c.noChange);
      return;
    }
    const updated = updateBugReportStatus({ reportId, status, privateNote, admin: user });
    if (updated) {
      setReport(updated);
      setPrivateNote("");
      setNotice(status !== report.status ? c.statusSaved : c.noteSaved);
    }
  };
  const send = (text) => addBugReportMessage({ reportId, sender: { id: user.id, name: user.fullName, role: "admin", roles: user.roles }, text });

  return <div className="page-container admin-bug-page">
    <PageHeader eyebrow={`${c.eyebrow} · ${report.reportNumber}`} title={report.subject} description={interpolateAdminBugCopy(c.reportedBy, { name: report.reporterName, role: report.reporterRole })} actions={<Button as={Link} variant="secondary" to="/admin/bug-reports">{c.back}</Button>} />
    <div className="admin-bug-detail-layout"><main className="admin-bug-detail-content">
      <section className="card"><h2>{c.description}</h2><p className="admin-bug-description">{report.description}</p></section>
      {report.screenshots.length > 0 && <section className="card admin-bug-screenshot"><h2>{c.screenshots}</h2><div className="admin-bug-screenshot-grid">{report.screenshots.map((screenshot) => <article key={screenshot.id ?? screenshot.name}><button type="button" onClick={() => setPreview(screenshot)}><img src={screenshot.dataUrl} alt={screenshot.name} /></button><span>{screenshot.name}</span></article>)}</div></section>}
      <BugReportThread report={report} currentUserId={user.id} onSend={send} />
      <section className="card admin-private-notes"><div className="admin-private-note-heading"><div><span>{c.internal}</span><h2>{c.privateNotes}</h2><p>{c.privateHint}</p></div><ChronologyOrderControl value={privateNoteOrder} onChange={setPrivateNoteOrder} /></div><div className="admin-private-note-list">{orderedPrivateNotes.map((note) => <article key={note.id}><p>{note.text}</p><small>{note.authorName} · {formatDate(note.createdAt, { dateStyle: "medium", timeStyle: "short" })}</small></article>)}{!report.privateNotes.length && <p className="admin-private-note-empty">{c.noNotes}</p>}</div></section>
      <section className="card"><div className="admin-history-heading"><h2>{c.statusHistory}</h2><ChronologyOrderControl value={statusHistoryOrder} onChange={setStatusHistoryOrder} /></div><div className="admin-bug-timeline">{orderedStatusHistory.map((entry, index) => <div key={`${entry.timestamp}-${index}`}><i /><span><strong>{localizedBugStatus(entry.status, language)}</strong><small>{entry.actorName} · {entry.actorRole}</small><time>{formatDate(entry.timestamp, { dateStyle: "medium", timeStyle: "short" })}</time></span></div>)}</div></section>
    </main><aside className="card admin-bug-action-panel">
      <StatusBadge status={report.status}>{localizedBugStatus(report.status, language)}</StatusBadge>
      <label><span>{c.status}</span><select value={status} onChange={(event) => { setStatus(event.target.value); setNotice(""); }}>{Object.keys(bugReportStatusLabels).map((value) => <option value={value} key={value}>{localizedBugStatus(value, language)}</option>)}</select></label>
      <label><span>{c.privateLabel}</span><textarea rows="5" value={privateNote} onChange={(event) => { setPrivateNote(event.target.value); setNotice(""); }} placeholder={c.privatePlaceholder} /></label>
      <Button onClick={save}>{c.save}</Button>{notice && <p role="status">{notice}</p>}
      <dl><div><dt>{c.email}</dt><dd>{report.reporterEmail}</dd></div><div><dt>{c.page}</dt><dd>{report.currentPath}</dd></div>{report.activeStoreId && <div><dt>{c.activeStore}</dt><dd>{report.activeStoreId}</dd></div>}<div><dt>{c.browser}</dt><dd title={report.browserUserAgent}>{report.browserUserAgent}</dd></div><div><dt>{c.created}</dt><dd>{formatDate(report.createdAt, { dateStyle: "medium", timeStyle: "short" })}</dd></div></dl>
    </aside></div><BugScreenshotModal screenshot={preview} onClose={() => setPreview(null)} />
  </div>;
}

export default BugReportDetail;
