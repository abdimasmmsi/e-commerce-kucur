import { useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { getAverageRating, getRatingDistribution, reviewService } from "../services/reviewService";
import ReviewPhoto from "./ReviewPhoto";
import "./Reviews.css";
import "./ReviewsCanonical.css";

// limit: tampilkan sebagian ulasan, ringkasan tetap dari semua. hideAuthor: untuk "Ulasan Saya".
function ReviewList({ reviews = null, targetType = null, targetId = null, includeHidden = false, showSummary = true, limit = null, hideAuthor = false }) {
  const { language, t } = usePreferences();
  const [remote, setRemote] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (reviews || !targetType || !targetId) return undefined;
    let active = true;
    reviewService.publicForTarget(targetType, targetId).then((result) => { if (active) setRemote(result.items || []); }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [reviews, targetId, targetType]);
  const source = reviews ?? remote;
  const visible = includeHidden ? source : source.filter((review) => !review.isHidden);
  const average = getAverageRating(visible);
  const distribution = getRatingDistribution(visible);
  const shown = limit ? visible.slice(0, limit) : visible;
  const averageText = average == null ? null : Number(average).toLocaleString(language === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return <div className="review-section-component">
    {error && <p role="alert">{error}</p>}
    {showSummary && <div className="review-summary"><div><strong>{averageText ?? "—"}</strong><span>{average ? (language === "id" ? "dari 5" : "out of 5") : t("reviewsUi.noReviews")}</span><small>{t(visible.length === 1 ? "reviewsUi.reviewOne" : "reviewsUi.reviewMany", { count: visible.length })}</small></div><div>{distribution.map((item) => <div key={item.rating}><span>{item.rating} ★</span><i><b style={{ width: visible.length ? `${item.count / visible.length * 100}%` : "0%" }}/></i><small>{item.count}</small></div>)}</div></div>}
    {visible.length ? <div className="review-list-component">{shown.map((review) => <article key={review.id}><div>{!hideAuthor && <strong>{review.customerName}</strong>}<span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>{review.text && <p>{review.text}</p>}{review.photos?.length > 0 && <div className="review-photo-grid">{review.photos.map((photo) => <ReviewPhoto photo={photo} onClick={setPreview} key={photo.id}/>)}</div>}{review.merchantReply && <div className="review-seller-reply"><strong>{t("reviewsUi.merchantReply")}</strong><p>{review.merchantReply.text}</p></div>}</article>)}</div> : <div className="review-empty"><strong>{t("reviewsUi.noReviews")}</strong><p>{t("reviewsUi.emptyHint")}</p></div>}
    {preview && <div className="review-photo-modal" role="dialog" aria-modal="true"><button type="button" aria-label={t("reviewsUi.closePreview")} onClick={() => setPreview(null)}/><section><button type="button" onClick={() => setPreview(null)}>×</button><img src={preview.source || preview.url} alt={t("reviewsUi.largePhoto")}/></section></div>}
  </div>;
}

export default ReviewList;
