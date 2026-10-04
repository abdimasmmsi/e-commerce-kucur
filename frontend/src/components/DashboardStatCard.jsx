import { Link } from "react-router-dom";
import "./DashboardStatCard.css";

function DashboardStatCard({ label, value, detail, to, className = "" }) {
  const classes = ["dashboard-stat-card", to ? "is-clickable" : "", className]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      {to && <span className="dashboard-stat-card__arrow" aria-hidden="true">→</span>}
    </>
  );

  return to ? (
    <Link className={classes} to={to} aria-label={`${label}: ${value}. Buka detail`}>
      {content}
    </Link>
  ) : (
    <article className={classes}>{content}</article>
  );
}

export default DashboardStatCard;
