import { usePreferences } from "../context/PreferencesContext";
import { isValidNotificationTarget } from "../services/notificationService";
import { localizeNotificationContent } from "../utils/notificationContent";

const relativeTime = (value, locale, t) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t("notification.justNow");
  if (minutes < 60) return t("notification.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notification.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("notification.daysAgo", { count: days });
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};

function NotificationPopover({ notifications, unreadCount, isRead, markAllRead, onNotificationClick, onClose }) {
  const { locale, notificationTypeLabel, t } = usePreferences();
  return <section className="fixed inset-x-2 top-[72px] z-[90] grid max-h-[calc(100dvh-80px)] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[min(390px,calc(100vw-32px))] sm:max-h-[min(620px,calc(100dvh-90px))]" aria-label={t("notification.title")} role="dialog">
    <header className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--kucur-border)] px-4 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-[var(--kucur-text)]">{t("notification.title")}</h2>{unreadCount > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{unreadCount} {t("notification.new")}</span>}</div><p className="mt-0.5 text-xs text-[var(--kucur-text-muted)]">{t("notification.subtitle")}</p></div><div className="flex shrink-0 items-center gap-1"><button className="rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-400" type="button" onClick={markAllRead} disabled={!unreadCount}>{t("notification.markAll")}</button><button className="grid h-8 w-8 place-items-center rounded-lg text-lg text-[var(--kucur-text-muted)] hover:bg-[var(--kucur-hover)]" type="button" onClick={onClose} aria-label={t("common.close")}>×</button></div></header>
    <div className="min-h-0 overflow-y-auto overscroll-contain p-2">{notifications.map((notification) => { const read = isRead(notification); const navigable = isValidNotificationTarget(notification.link); const content = localizeNotificationContent(notification, t); return <button className={`mb-1 grid w-full min-w-0 grid-cols-[8px_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3 text-left transition last:mb-0 ${read ? "bg-[var(--kucur-surface)] hover:bg-[var(--kucur-surface-elevated)]" : "bg-emerald-50/70 hover:bg-emerald-50"} ${navigable ? "cursor-pointer" : "cursor-default"}`} type="button" key={notification.id} onClick={() => onNotificationClick(notification, navigable)}><span className={`mt-1.5 h-2 w-2 rounded-full ${read ? "bg-slate-300" : "bg-emerald-600"}`} aria-hidden="true"/><span className="grid min-w-0 gap-1"><span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="text-[11px] font-semibold text-emerald-700">{notificationTypeLabel(notification.type)}</span><time className="text-[11px] text-[var(--kucur-text-muted)]" dateTime={notification.createdAt}>{relativeTime(notification.createdAt, locale, t)}</time></span><strong className={`break-words text-sm ${read ? "font-semibold text-[var(--kucur-text)]" : "font-bold text-[var(--kucur-text)]"}`}>{content.title}</strong><span className="break-words text-xs leading-5 text-[var(--kucur-text-muted)]">{content.message}</span>{navigable && <span className="mt-0.5 text-xs font-bold text-emerald-700">{t("notification.openDetail")}</span>}</span></button>; })}{!notifications.length && <div className="grid justify-items-center gap-1 px-4 py-10 text-center"><strong className="text-sm text-[var(--kucur-text)]">{t("notification.empty")}</strong><span className="text-xs text-[var(--kucur-text-muted)]">{t("notification.emptyHint")}</span></div>}</div>
  </section>;
}
export default NotificationPopover;
