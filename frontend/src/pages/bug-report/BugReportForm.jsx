import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BugScreenshotModal from "../../components/BugScreenshotModal";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { usePreferences } from "../../context/PreferencesContext";
import { prepareBugReportScreenshots } from "../../services/bugReportAttachmentService";
import { createBugReport } from "../../services/mockBugReportService";
import "./BugReportForm.css";
import "./BugAccountActions.css";

function BugReportForm() {
  const location = useLocation();
  const { activeRole, user } = useAuth();
  const { activeStore, activeStoreId } = useStore();
  const { t } = usePreferences();
  const fileRef = useRef(null);
  const submitLock = useRef(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState([]);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [submittedReport, setSubmittedReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleScreenshots = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    setMessage({ type: "", text: "" });
    try {
      const prepared = await prepareBugReportScreenshots(files, screenshots.length);
      setScreenshots((current) => [...current, ...prepared]);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      event.target.value = "";
    }
  };

  const removeScreenshot = (id) => setScreenshots((items) => items.filter((item) => item.id !== id));
  const submit = (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    if (!subject.trim() || !description.trim()) return setMessage({ type: "error", text: t("bugReportForm.required") });
    submitLock.current = true;
    setSubmitting(true);
    try {
      const report = createBugReport({
        user,
        role: activeRole,
        subject,
        description,
        screenshots,
        currentPath: location.state?.from ?? "/report-bug",
        activeStoreId: activeRole === "merchant" && activeStoreId && activeStoreId !== "all" ? activeStoreId : null,
        browserUserAgent: navigator.userAgent,
      });
      setSubmittedReport(report);
      setSubject("");
      setDescription("");
      setScreenshots([]);
      setMessage({ type: "success", text: t("bugReportForm.sent") });
    } catch {
      setMessage({ type: "error", text: t("bugReportForm.failed") });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (submittedReport) return <div className="page-container bug-form-page"><section className="card bug-submit-success"><span>{t("bugReportForm.success")}</span><h1>{t("bugReportForm.sent")}</h1><strong>{submittedReport.reportNumber}</strong><p>{t("bugReportForm.sentHint")}</p><div><Link className="secondary-button" to={location.state?.from ?? "/"}>{t("bugReportForm.back")}</Link><Link className="primary-button" to={`/my-bug-reports/${submittedReport.id}`}>{t("bugReportForm.viewReport")}</Link></div></section></div>;

  return <div className="page-container bug-form-page">
    <header className="account-profile-heading"><div><span>{t("account.eyebrow")}</span><h1>{t("bugReportForm.title")}</h1><p>{t("bugReportForm.subtitle")}</p></div><Link className="secondary-button" to="/my-bug-reports">{t("bugReportForm.myReports")}</Link></header>
    <div className="bug-report-layout"><form className="card bug-form" onSubmit={submit}>
      <label><span>{t("bugReportForm.subject")}</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength="150" placeholder={t("bugReportForm.subjectPlaceholder")} required /><small>{subject.length}/150</small></label>
      <label><span>{t("bugReportForm.description")}</span><textarea rows="8" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="5000" placeholder={t("bugReportForm.descriptionPlaceholder")} required /><small>{description.length}/5000</small></label>
      <label className="bug-upload"><span>{t("bugReportForm.screenshot")}</span><input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={handleScreenshots} disabled={screenshots.length >= 3} /><small>{t("bugReportForm.screenshotHint")}</small></label>
      {screenshots.length > 0 && <div className="bug-thumbnail-grid">{screenshots.map((screenshot) => <article key={screenshot.id}><button type="button" onClick={() => setPreview(screenshot)}><img src={screenshot.dataUrl} alt={screenshot.name} /></button><div><span title={screenshot.name}>{screenshot.name}</span><button type="button" onClick={() => removeScreenshot(screenshot.id)}>Hapus</button></div></article>)}</div>}
      <section className="bug-auto-context"><strong>{t("bugReportForm.autoContext")}</strong><span>{t("bugReportForm.activeRole")}: {t(`role.${activeRole}`)}</span><span>{t("bugReportForm.page")}: {location.state?.from ?? "/report-bug"}</span>{activeRole === "merchant" && activeStoreId !== "all" && <span>{t("bugReportForm.activeStore")}: {activeStore?.name ?? t("bugReportForm.unavailable")}</span>}</section>
      {message.text && <p className={`bug-form-message ${message.type}`} role="status">{message.text}</p>}
      <button className="primary-button" type="submit" disabled={submitting}>{submitting ? t("bugReportForm.sending") : t("bugReportForm.submit")}</button>
    </form><aside className="bug-report-guide"><h2>{t("bugReportForm.guideTitle")}</h2><p>{t("bugReportForm.guideHint")}</p><ol><li>{t("bugReportForm.guideOne")}</li><li>{t("bugReportForm.guideTwo")}</li><li>{t("bugReportForm.guideThree")}</li></ol></aside></div>
    <BugScreenshotModal screenshot={preview} onClose={() => setPreview(null)} />
  </div>;
}

export default BugReportForm;
