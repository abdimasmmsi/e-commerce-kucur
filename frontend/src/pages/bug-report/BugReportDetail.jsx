import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BugReportThread from "../../components/BugReportThread";
import BugScreenshotModal from "../../components/BugScreenshotModal";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { addBugReportMessage, BUG_REPORT_STORAGE_KEY, BUG_REPORT_UPDATED_EVENT, bugReportStatusLabels, getBugReportById, markBugReportRead } from "../../services/mockBugReportService";
import { markNotificationsByLink } from "../../services/notificationService";
import "./BugReportForm.css";

function BugReportDetail() {
  const { reportId } = useParams();
  const { activeRole, user } = useAuth();
  const { t } = usePreferences();
  const { stores } = useStore();
  const [report, setReport] = useState(() => getBugReportById(reportId));
  const [preview, setPreview] = useState(null);
  const ownedReport = report?.reporterUserId === user.id;
  useEffect(() => {
    const refresh = () => {
      setReport(getBugReportById(reportId));
      if (ownedReport) markBugReportRead(reportId, user.id);
    };
    const storage = (event) => { if (event.key === BUG_REPORT_STORAGE_KEY) refresh(); };
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    if (ownedReport) {
      markBugReportRead(reportId, user.id);
      markNotificationsByLink(`/my-bug-reports/${reportId}`, user.id, activeRole);
    }
    return () => { window.removeEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.removeEventListener("storage", storage); };
  }, [activeRole, ownedReport, reportId, user.id]);
  if (!ownedReport) return <div className="page-container"><section className="card bug-list-empty"><h1>Laporan tidak ditemukan</h1><Link to="/my-bug-reports">Kembali</Link></section></div>;
  const send = (text) => addBugReportMessage({ reportId, sender: { id: user.id, name: user.fullName, role: activeRole, roles: user.roles }, text });

  const reportStore = stores.find((store) => store.id === String(report.activeStoreId));
  return <div className="page-container bug-detail-page"><div className="page-header"><div><span className="bug-report-number">{report.reportNumber}</span><h1>{report.subject}</h1><p>{new Date(report.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div><Link className="secondary-button" to="/my-bug-reports">Kembali</Link></div><div className="bug-detail-layout"><main><section className="card"><h2>Deskripsi</h2><p className="bug-description">{report.description}</p></section>{report.screenshots.length > 0 && <section className="card"><h2>Tangkapan Layar</h2><div className="bug-thumbnail-grid">{report.screenshots.map((screenshot) => <article key={screenshot.id ?? screenshot.name}><button type="button" onClick={() => setPreview(screenshot)}><img src={screenshot.dataUrl} alt={screenshot.name} /></button><span>{screenshot.name}</span></article>)}</div></section>}<BugReportThread report={report} currentUserId={user.id} onSend={send} /></main><aside className="card bug-detail-summary"><span className={`bug-status ${report.status}`}>{bugReportStatusLabels[report.status]}</span><dl><div><dt>Halaman Dilaporkan</dt><dd>{report.currentPath}</dd></div>{report.activeStoreId && <div><dt>Lapak Aktif</dt><dd>{reportStore?.name ?? "Tidak tersedia"}</dd></div>}<div><dt>Role</dt><dd>{t(`role.${report.reporterRole}`)}</dd></div></dl><p>Status laporan dikelola Admin. Gunakan percakapan untuk menambahkan klarifikasi.</p></aside></div><BugScreenshotModal screenshot={preview} onClose={() => setPreview(null)} /></div>;
}

export default BugReportDetail;
