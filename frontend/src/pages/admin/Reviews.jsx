import { useCallback, useEffect, useState } from "react";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { reviewService } from "../../services/reviewService";
import { useLiveRefresh } from "../../utils/liveRefresh";
import "./AdminOperations.css";
import "./Reviews.css";

export default function Reviews() {
  const { formatDate, t } = usePreferences();
  const [rows, setRows] = useState([]);
  const [visibility, setVisibility] = useState("all");
  const [reason, setReason] = useState("");
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await reviewService.admin({ type: "product", visibility })); setError(""); }
    catch { setError(t("adminReviews.loadFailed")); }
    finally { setLoading(false); }
  }, [t, visibility]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  // Diam-diam; ditahan saat dialog moderasi terbuka supaya alasan yang diketik dan baris yang ditinjau tidak berubah.
  useLiveRefresh(() => reviewService.admin({ type: "product", visibility }).then(setRows).catch(() => {}), { enabled: !loading && !active && !busy });
  const moderate = async (row, hidden) => {
    setBusy(true);
    try { await reviewService.moderate(row.id, hidden, reason); setActive(null); setReason(""); await load(); }
    catch { setError(t("adminReviews.loadFailed")); }
    finally { setBusy(false); }
  };
  const pageSize = 6;
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const activeReview = rows.find((row) => row.id === active);

  return <><div className="page-container admin-operations-page min-w-0">
    <PageHeader eyebrow={t("adminReviews.eyebrow")} title={t("adminReviews.title")} description={t("adminReviews.subtitle")} />
    {error && <section className="admin-feedback error" role="alert"><span>{error}</span><Button variant="secondary" onClick={load}>{t("adminReviews.retry")}</Button></section>}
    <section className="card admin-toolbar review-toolbar"><label><span>{t("adminReviews.visibility")}</span><select value={visibility} onChange={(event) => { setVisibility(event.target.value); setPage(1); setActive(null); setReason(""); }}><option value="all">{t("adminReviews.all")}</option><option value="visible">{t("adminReviews.visible")}</option><option value="hidden">{t("adminReviews.hidden")}</option></select></label></section>
    {loading ? <LoadingPanel label={t("adminReviews.loading")} rows={4} /> : visibleRows.length ? <>
      <div className="review-moderation-grid">{visibleRows.map((row) => <article className="card review-moderation-card" key={row.id}>
        <header className="review-card-heading"><div><span className="review-product-label">{t("adminReviews.product")}</span><h2>{row.transactionContext?.targetName || t("adminReviews.unavailable")}</h2>{row.transactionContext?.orderNumber && <small>{row.transactionContext.orderNumber}</small>}</div><StatusBadge status={row.isHidden ? "hidden" : "visible"}>{row.isHidden ? t("adminReviews.hidden") : t("adminReviews.visible")}</StatusBadge></header>
        <div className="review-customer-line"><strong>{row.customerName}</strong><span aria-label={`${row.rating}/5`}>{"★".repeat(row.rating)}{"☆".repeat(5 - row.rating)}</span></div>
        <p className={`review-comment ${row.text ? "" : "is-empty"}`}>{row.text || "—"}</p>
        {row.photos?.length > 0 && <div className="review-thumbnail-list">{row.photos.map((photo) => <a href={photo.source || photo.url} target="_blank" rel="noreferrer" key={photo.id || photo.url}><img src={photo.source || photo.url} alt={t("reviewsUi.largePhoto")} /></a>)}</div>}
        {row.merchantReply && <div className="review-merchant-reply"><strong>{t("reviewsUi.merchantReply")}</strong><p>{row.merchantReply.text}</p></div>}
        {row.isHidden && <div className="review-moderation-reason"><strong>{t("adminReviews.moderationReason")}</strong><span>{row.moderationReason || "—"}</span>{row.moderatedAt && <small>{t("adminReviews.moderatedAt", { date: formatDate(row.moderatedAt, { dateStyle: "medium", timeStyle: "short" }) })}</small>}</div>}
        <footer className="review-card-actions"><Button variant={row.isHidden ? "secondary" : "danger"} disabled={busy} onClick={() => row.isHidden ? moderate(row, false) : setActive(row.id)}>{row.isHidden ? t("adminReviews.show") : t("adminReviews.hide")}</Button></footer>
      </article>)}</div>
      <Pagination page={page} pageSize={pageSize} totalItems={rows.length} onPageChange={setPage} />
    </> : <EmptyState title={t("adminReviews.empty")} description={t("adminReviews.emptyHint")} />}
  </div><ActionDialog open={Boolean(activeReview)} busy={busy} destructive confirmDisabled={!reason.trim()} title={t("adminReviews.hide")} description={t("adminReviews.reasonPlaceholder")} cancelLabel={t("adminReviews.cancel")} confirmLabel={t("adminReviews.confirmHide")} onCancel={() => { setActive(null); setReason(""); }} onConfirm={() => moderate(activeReview, true)}><label className="review-reason-field"><span>{t("adminReviews.hideReason")}</span><textarea autoFocus rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("adminReviews.reasonPlaceholder")} /></label></ActionDialog></>;
}
