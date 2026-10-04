import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChronologyOrderControl from "./ChronologyOrderControl";
import { useNotifications } from "../context/NotificationContext";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";
import { localizeNotificationContent } from "../utils/notificationContent";
import PageHeader from "./ui/PageHeader";
import Button from "./ui/Button";
import LoadingPanel from "./ui/LoadingPanel";
import EmptyState from "./ui/EmptyState";
import "./NotificationCenter.css";

function NotificationCenter() {
  const { activeRole } = useAuth();
  const { notifications, unreadCount, isRead, markAllRead, markRead, loadMore, hasMore, loading, error } = useNotifications();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("desc");
  const { formatDate, notificationTypeLabel, t } = usePreferences();
  const typeLabel = (value) => {
    const legacyKey = `notificationCenter.types.${value}`;
    const legacyLabel = t(legacyKey);
    return legacyLabel === legacyKey ? notificationTypeLabel(value) : legacyLabel;
  };
  const localizedContent = useCallback((item) => localizeNotificationContent(item, t), [t]);
  const types = useMemo(() => [...new Set(notifications.map((item) => item.type))], [notifications]);
  const rows = useMemo(() => notifications.filter((item) => status === "all" || (status === "read" ? isRead(item) : !isRead(item))).filter((item) => type === "all" || item.type === type).filter((item) => {
    const query = search.trim().toLowerCase();
    const content = localizedContent(item);
    return !query || content.title.toLowerCase().includes(query) || content.message.toLowerCase().includes(query);
  }).sort((a, b) => {
    const difference = new Date(a.createdAt) - new Date(b.createdAt);
    return order === "asc" ? difference : -difference;
  }), [isRead, localizedContent, notifications, order, search, status, type]);
  const title = <span className="unified-notification-title-copy">{t("notification.title")}{unreadCount > 0 && <span>{unreadCount}</span>}</span>;
  return <div className="page-container unified-notification-page"><PageHeader eyebrow={t(activeRole === "admin" ? "workspace.admin" : "account.eyebrow")} title={title} description={t("notificationCenter.subtitle")} actions={<Button variant="secondary" onClick={markAllRead} disabled={!unreadCount}>{t("notificationCenter.markAllRead")}</Button>} />
    {error && <p className="unified-notification-message" role="alert">{t("common.loadFailed")}</p>}
    <section className="card unified-notification-toolbar"><label><span>{t("notificationCenter.search")}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("notificationCenter.searchPlaceholder")} /></label><label><span>{t("notificationCenter.status")}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("notificationCenter.all")}</option><option value="unread">{t("notificationCenter.unread")}</option><option value="read">{t("notificationCenter.read")}</option></select></label><label><span>{t("notificationCenter.type")}</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">{t("notificationCenter.allTypes")}</option>{types.map((value) => <option value={value} key={value}>{typeLabel(value)}</option>)}</select></label><ChronologyOrderControl value={order} onChange={setOrder} /></section>
    <div className="unified-notification-list">{rows.map((item) => {
      const read = isRead(item);
      const content = localizedContent(item);
      return <article className={`card unified-notification-card ${read ? "read" : "unread"}`} key={item.id}><span className="unified-notification-dot" /><div className="unified-notification-copy"><div><span>{typeLabel(item.type)}</span><time>{formatDate(item.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time></div><h2>{content.title}</h2><p>{content.message}</p><div className="unified-notification-card-actions">{item.link && <Link to={item.link} onClick={() => markRead(item.id)}>{t("notificationCenter.openDetail")}</Link>}{!read && <button type="button" onClick={() => markRead(item.id)}>{t("notificationCenter.markRead")}</button>}</div></div></article>;
    })}</div>
    {loading && !notifications.length && <LoadingPanel label={t("notificationCenter.loading")} rows={4} />}
    {!loading && !rows.length && <EmptyState title={t("notificationCenter.empty")} description={t("notificationCenter.emptyHint")} />}
    {hasMore && <Button variant="secondary" onClick={loadMore} disabled={loading}>{t(loading ? "notificationCenter.loading" : "notificationCenter.loadMore")}</Button>}
  </div>;
}

export default NotificationCenter;
