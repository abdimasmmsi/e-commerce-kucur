import { usePreferences } from "../../context/PreferencesContext";
import { normalizedPage, paginationPageCount } from "../../utils/pagination";
import "./Pagination.css";

const visiblePages = (current, total) => {
  const values = new Set([1, total, current - 1, current, current + 1]);
  return [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
};

export default function Pagination({ page, pageSize, totalItems, onPageChange }) {
  const { t } = usePreferences();
  const pageCount = paginationPageCount(totalItems, pageSize);
  const current = normalizedPage(page, totalItems, pageSize);
  if (totalItems <= pageSize) return null;
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);
  const pages = visiblePages(current, pageCount);

  return <nav className="kucur-pagination" aria-label={t("pagination.navigation")}>
    <p>{t("pagination.summary", { from, to, total: totalItems })}</p>
    <div>
      <button type="button" disabled={current === 1} onClick={() => onPageChange(current - 1)} aria-label={t("pagination.previous")}>{"\u2190"}<span>{t("pagination.previous")}</span></button>
      <ol>{pages.map((value, index) => <li key={value}>{index > 0 && value - pages[index - 1] > 1 && <span aria-hidden="true">{"\u2026"}</span>}<button className={value === current ? "is-active" : ""} type="button" aria-current={value === current ? "page" : undefined} aria-label={t("pagination.page", { page: value })} onClick={() => onPageChange(value)}>{value}</button></li>)}</ol>
      <button type="button" disabled={current === pageCount} onClick={() => onPageChange(current + 1)} aria-label={t("pagination.next")}><span>{t("pagination.next")}</span>{"\u2192"}</button>
    </div>
  </nav>;
}
