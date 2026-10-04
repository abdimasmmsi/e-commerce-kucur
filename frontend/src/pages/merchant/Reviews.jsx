import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReviewPhoto from "../../components/ReviewPhoto";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import LoadingPanel from "../../components/ui/LoadingPanel";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { getAverageRating, reviewService } from "../../services/reviewService";
import { paginate } from "../../utils/pagination";
import "./Reviews.css";

const FILTERS = ["all", "unanswered", "answered", "5", "4", "3", "2", "1"];
const PAGE_SIZE = 9;

function Reviews() {
  const { activeStoreId } = useStore();
  const { errorMessage, formatDate, t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get("filter") ?? "all";
  const filter = FILTERS.includes(requestedFilter) ? requestedFilter : "all";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedStoreId, setLoadedStoreId] = useState(null);
  const [error, setError] = useState("");
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await reviewService.merchant(activeStoreId));
    } catch (cause) {
      setError(errorMessage(cause.code, cause.message));
    } finally {
      setLoadedStoreId(activeStoreId);
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    reviewService.merchant(activeStoreId)
      .then((value) => { if (active) { setRows(value); setError(""); } })
      .catch((cause) => { if (active) setError(errorMessage(cause.code, cause.message)); })
      .finally(() => { if (active) { setLoadedStoreId(activeStoreId); setLoading(false); } });
    return () => { active = false; };
  }, [activeStoreId, errorMessage]);

  useEffect(() => {
    if (!replying && !preview) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape" || saving) return;
      setReplying(null);
      setPreview(null);
      setReplyError("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [preview, replying, saving]);

  const isLoading = loading || loadedStoreId !== activeStoreId;
  const sourceRows = useMemo(() => isLoading ? [] : rows, [isLoading, rows]);
  const reviews = useMemo(() => sourceRows.filter((row) => filter === "all"
    || (filter === "answered" ? Boolean(row.merchantReply) : filter === "unanswered" ? !row.merchantReply : row.rating === Number(filter))), [filter, sourceRows]);
  const visibleReviews = useMemo(() => paginate(reviews, page, PAGE_SIZE), [page, reviews]);
  const average = getAverageRating(sourceRows);
  const unanswered = sourceRows.filter((row) => !row.merchantReply).length;

  const changeFilter = (value) => {
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("filter"); else next.set("filter", value);
    setSearchParams(next, { replace: true });
  };

  const openReply = (row) => {
    setReplying(row);
    setReply(row.merchantReply?.text ?? "");
    setReplyError("");
    setSuccess("");
  };

  const closeReply = () => {
    if (saving) return;
    setReplying(null);
    setReply("");
    setReplyError("");
  };

  const save = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text) {
      setReplyError(t("merchantReviews.replyRequired"));
      return;
    }
    setSaving(true);
    setReplyError("");
    try {
      const updated = await reviewService.reply(replying.id, text, Boolean(replying.merchantReply));
      setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
      setReplying(null);
      setReply("");
      setSuccess(t("merchantReviews.replySaved"));
    } catch (cause) {
      setReplyError(errorMessage(cause.code, cause.message));
    } finally {
      setSaving(false);
    }
  };

  return <div className="merchant-standard-page merchant-reviews-page">
    <PageHeader eyebrow={t("merchantReviews.eyebrow")} title={t("merchantReviews.title")} description={t("merchantReviews.subtitle")}/>

    <section className="merchant-review-summary" aria-label={t("merchantReviews.summaryLabel")}>
      <article><span>{t("merchantReviews.total")}</span><strong>{sourceRows.length}</strong></article>
      <article><span>{t("merchantReviews.average")}</span><strong>{average ?? "\u2014"}{average !== null && <small>/5</small>}</strong></article>
      <article><span>{t("merchantReviews.needsReply")}</span><strong>{unanswered}</strong></article>
    </section>

    <section className="merchant-review-toolbar" aria-label={t("merchantReviews.filter")}>
      <strong>{t("merchantReviews.filter")}</strong>
      <div>
        {FILTERS.map((value) => <button className={filter === value ? "is-active" : ""} type="button" aria-pressed={filter === value} onClick={() => changeFilter(value)} key={value}>
          {t(value === "all" ? "merchantReviews.all" : value === "answered" ? "merchantReviews.answered" : value === "unanswered" ? "merchantReviews.unanswered" : "merchantReviews.stars", { count: value })}
        </button>)}
      </div>
    </section>

    {success && <p className="merchant-review-success" role="status">{success}</p>}
    {!isLoading && error && <section className="merchant-review-error" role="alert"><div><strong>{t("merchantReviews.loadFailed")}</strong><p>{error}</p></div><button type="button" onClick={load}>{t("merchantReviews.retry")}</button></section>}

    {isLoading ? <LoadingPanel label={t("merchantReviews.loading")} rows={3} /> : !error && reviews.length ? <><section className="merchant-review-grid">
      {visibleReviews.map((row) => <article className="merchant-review-card" key={row.id}>
        <header>
          <div>
            <span className="merchant-review-product">{row.transactionContext?.targetName || t("merchantReviews.productFallback")}</span>
            <h2>{row.customerName || t("merchantReviews.customerFallback")}</h2>
            {row.createdAt && <time dateTime={row.createdAt}>{formatDate(row.createdAt, { dateStyle: "medium" })}</time>}
          </div>
          <div className="merchant-review-card-status">
            <span className="merchant-review-stars" aria-label={t("merchantReviews.ratingLabel", { count: row.rating })}>{"\u2605".repeat(row.rating)}<i>{"\u2605".repeat(5 - row.rating)}</i></span>
            <span className={row.merchantReply ? "is-answered" : "is-unanswered"}>{t(row.merchantReply ? "merchantReviews.answered" : "merchantReviews.unanswered")}</span>
          </div>
        </header>

        <p className={row.text ? "merchant-review-comment" : "merchant-review-comment is-empty"}>{row.text || t("merchantReviews.noComment")}</p>
        {row.photos?.length > 0 && <div className="merchant-review-photos">{row.photos.map((photo) => <ReviewPhoto photo={photo} alt={t("merchantReviews.photoAlt")} onClick={setPreview} key={photo.id}/>)}</div>}
        {row.merchantReply && <section className="merchant-review-reply"><strong>{t("reviewsUi.merchantReply")}</strong><p>{row.merchantReply.text}</p></section>}
        <footer><button type="button" onClick={() => openReply(row)}>{t(row.merchantReply ? "merchantReviews.editReply" : "merchantReviews.reply")}</button></footer>
      </article>)}
    </section><Pagination page={page} pageSize={PAGE_SIZE} totalItems={reviews.length} onPageChange={setPage}/></> : !error && <EmptyState title={t(sourceRows.length ? "merchantReviews.filteredEmpty" : "merchantReviews.empty")} description={t(sourceRows.length ? "merchantReviews.filteredEmptyHint" : "merchantReviews.emptyHint")}/>} 

    {replying && <div className="merchant-review-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReply(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="merchant-review-reply-title" onSubmit={save}>
        <header><div><span>{replying.transactionContext?.targetName}</span><h2 id="merchant-review-reply-title">{t(replying.merchantReply ? "merchantReviews.editReplyTitle" : "merchantReviews.replyTitle")}</h2></div><button type="button" aria-label={t("merchantReviews.close")} onClick={closeReply}>{"\u00D7"}</button></header>
        <p>{t("merchantReviews.replyHint", { customer: replying.customerName })}</p>
        <label><span>{t("merchantReviews.yourReply")}</span><textarea autoFocus rows="6" maxLength="2000" value={reply} placeholder={t("merchantReviews.replyPlaceholder")} onChange={(event) => { setReply(event.target.value); setReplyError(""); }}/><small>{t("merchantReviews.characterCount", { count: reply.length })}</small></label>
        {replyError && <p className="merchant-review-modal-error" role="alert">{replyError}</p>}
        <footer><button type="button" onClick={closeReply} disabled={saving}>{t("merchantReviews.cancel")}</button><button className="is-primary" type="submit" disabled={saving || !reply.trim()}>{t(saving ? "merchantReviews.saving" : "merchantReviews.saveReply")}</button></footer>
      </form>
    </div>}

    {preview && <div className="merchant-review-photo-modal" role="dialog" aria-modal="true" aria-label={t("reviewsUi.largePhoto")} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><section><button type="button" aria-label={t("reviewsUi.closePreview")} onClick={() => setPreview(null)}>{"\u00D7"}</button><img src={preview.source || preview.url} alt={t("reviewsUi.largePhoto")}/></section></div>}
  </div>;
}

export default Reviews;
