import { useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { getAverageRating, getRatingDistribution, reviewService } from "../services/reviewService";
import ReviewPhoto from "./ReviewPhoto";
import "./Reviews.css";
import "./ReviewsCanonical.css";

function ReviewList({ reviews = null, targetType = null, targetId = null, includeHidden = false, showSummary = true }) {
  const { t } = usePreferences();
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

  return <div className="review-section-component">
    {error && <p role="alert">{error}</p>}
    {showSummary && <div className="review-summary"><div><strong>{average ?? "—"}</strong><span>{average ? `${average} / 5` : t("reviewsUi.noReviews")}</span><small>{t(visible.length === 1 ? "reviewsUi.reviewOne" : "reviewsUi.reviewMany", { count: visible.length })}</small></div><div>{distribution.map((item) => <div key={item.rating}><span>{item.rating} ★</span><i><b style={{ width: visible.length ? `${item.count / visible.length * 100}%` : "0%" }}/></i><small>{item.count}</small></div>)}</div></div>}
    {visible.length ? <div className="review-list-component">{visible.map((review) => <article key={review.id}><div><strong>{review.customerName}</strong><span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>{review.text && <p>{review.text}</p>}{review.photos?.length > 0 && <div className="review-photo-grid">{review.photos.map((photo) => <ReviewPhoto photo={photo} onClick={setPreview} key={photo.id}/>)}</div>}{review.merchantReply && <div className="review-seller-reply"><strong>{t("reviewsUi.merchantReply")}</strong><p>{review.merchantReply.text}</p></div>}</article>)}</div> : <div className="review-empty"><strong>{t("reviewsUi.noReviews")}</strong><p>{t("reviewsUi.emptyHint")}</p></div>}
    {preview && <div className="review-photo-modal" role="dialog" aria-modal="true"><button type="button" aria-label={t("reviewsUi.closePreview")} onClick={() => setPreview(null)}/><section><button type="button" onClick={() => setPreview(null)}>×</button><img src={preview.source || preview.url} alt={t("reviewsUi.largePhoto")}/></section></div>}
  </div>;
}

export default ReviewList;
