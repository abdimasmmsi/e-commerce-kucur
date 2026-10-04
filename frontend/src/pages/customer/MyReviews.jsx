import { useEffect, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import ReviewList from "../../components/ReviewList";
import { usePreferences } from "../../context/PreferencesContext";
import { reviewService } from "../../services/reviewService";
import "./CustomerMarketplace.css";

function MyReviews() {
  const { t } = usePreferences();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    reviewService.mine().then((items) => setRows(items.filter((row) => row.targetType === "product"))).catch(() => setError(t("myReviews.loadFailed")));
  }, [t]);
  return <div className="page-container customer-page my-reviews-page">
    <PageHeader eyebrow={t("account.eyebrow")} title={t("myReviews.title")} description={t("myReviews.subtitle")} />
    {error && <p role="alert">{error}</p>}
    <div className="review-management-grid">{rows.map((row) => <article className="card" key={row.id}>
      <h2 className="text-base font-bold">{row.transactionContext?.targetName}</h2>
      {row.isHidden && <p className="customer-warning">{t("myReviews.hidden", { reason: row.moderationReason })}</p>}
      <ReviewList reviews={[row]} includeHidden showSummary={false} />
    </article>)}</div>
    {!rows.length && !error && <section className="card customer-empty-state"><h2>{t("myReviews.empty")}</h2><p>{t("myReviews.emptyHint")}</p></section>}
  </div>;
}

export default MyReviews;
