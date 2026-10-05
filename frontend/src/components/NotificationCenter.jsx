import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";
import { localizeNotificationContent } from "../utils/notificationContent";
import { shortenOrderCodes } from "../utils/orderCode";
import PageHeader from "./ui/PageHeader";
import Button from "./ui/Button";
import LoadingPanel from "./ui/LoadingPanel";
import EmptyState from "./ui/EmptyState";
import "./NotificationCenter.css";

// Daftar notifikasi: dua tab (Semua / Belum dibaca), seluruh kartu bisa diketuk untuk membuka tujuan.
function NotificationCenter() {
  const { activeRole } = useAuth();
  const { notifications, unreadCount, isRead, markAllRead, markRead, loadMore, hasMore, loading, error } = useNotifications();
  const [status, setStatus] = useState("all");
  const { formatDate, language, t } = usePreferences();
  const localizedContent = useCallback((item) => { const content = localizeNotificationContent(item, t, language); return { title: shortenOrderCodes(content.title), message: shortenOrderCodes(content.message) }; }, [language, t]);
  const rows = useMemo(() => notifications
    .filter((item) => status === "all" || !isRead(item))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [isRead, notifications, status]);
  const title = <span className="unified-notification-title-copy">{t("notification.title")}{unreadCount > 0 && <span>{unreadCount}</span>}</span>;
  const tabs = [["all", t("notificationCenter.all")], ["unread", `${t("notificationCenter.unread")}${unreadCount ? ` (${unreadCount})` : ""}`]];

  return <div className="page-container unified-notification-page"><PageHeader eyebrow={t(activeRole === "admin" ? "workspace.admin" : "account.eyebrow")} title={title} description={t("notificationCenter.subtitle")} actions={<Button variant="secondary" onClick={markAllRead} disabled={!unreadCount}>{t("notificationCenter.markAllRead")}</Button>} />
    {error && <p className="unified-notification-message" role="alert">{t("common.loadFailed")}</p>}
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface-muted)] p-1 sm:max-w-sm" role="tablist" aria-label={t("notificationCenter.status")}>
      {tabs.map(([key, label]) => <button className={`min-h-11 rounded-lg px-2 text-sm font-bold ${status === key ? "bg-[var(--kucur-surface)] text-[var(--kucur-text)] shadow-sm" : "text-[var(--kucur-text-muted)]"}`} type="button" role="tab" aria-selected={status === key} key={key} onClick={() => setStatus(key)}>{label}</button>)}
    </div>
    <div className="grid gap-2">{rows.map((item) => {
      const read = isRead(item);
      const content = localizedContent(item);
      return <article className={`unified-notification-card relative grid grid-cols-[12px_minmax(0,1fr)] gap-3 rounded-2xl border p-4 transition ${read ? "read border-[var(--kucur-border)] bg-[var(--kucur-surface)]" : "unread border-[color-mix(in_srgb,var(--kucur-green)_45%,var(--kucur-border))] bg-[color-mix(in_srgb,var(--kucur-green-soft)_55%,var(--kucur-surface))]"} has-[a:focus-visible]:outline has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-[var(--kucur-green)]`} key={item.id}>
        <span className={`mt-1.5 size-2.5 rounded-full ${read ? "bg-transparent" : "bg-[var(--kucur-green)]"}`} aria-hidden="true" />
        <div className="grid min-w-0 gap-1">
          <h2 className="text-base font-bold text-[var(--kucur-text)]">{item.link ? <Link className="outline-none after:absolute after:inset-0" to={item.link} onClick={() => markRead(item.id)}>{content.title}</Link> : content.title}</h2>
          <p className="break-words text-[15px] leading-6 text-[var(--kucur-text-muted)]">{content.message}</p>
          <time className="text-[13px] text-[var(--kucur-text-muted)]" dateTime={item.createdAt}>{formatDate(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time>
          {!item.link && !read && <button className="relative mt-1 w-fit min-h-10 rounded-lg border border-[var(--kucur-border-strong)] px-3 text-sm font-bold" type="button" onClick={() => markRead(item.id)}>{t("notificationCenter.markRead")}</button>}
        </div>
      </article>;
    })}</div>
    {loading && !notifications.length && <LoadingPanel label={t("notificationCenter.loading")} rows={4} />}
    {!loading && !rows.length && <EmptyState title={t("notificationCenter.empty")} description={t(status === "unread" ? "notificationCenter.emptyUnread" : "notificationCenter.emptyHint")} />}
    {hasMore && <div className="mt-4"><Button variant="secondary" onClick={loadMore} disabled={loading}>{t(loading ? "notificationCenter.loading" : "notificationCenter.loadMore")}</Button></div>}
  </div>;
}

export default NotificationCenter;
