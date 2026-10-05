import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import { isValidNotificationTarget } from "../services/notificationService";
import { localizeNotificationContent } from "../utils/notificationContent";
import { shortenOrderCodes } from "../utils/orderCode";

// Waktu relatif dengan bentuk jamak yang benar per bahasa ("1 hari lalu", "1 day ago", "2 days ago").
const relativeTime = (value, locale, t) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t("notification.justNow");
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return format.format(-days, "day");
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });
};

// HP: lembar penuh di bawah header dengan latar gelap; layar lebar: panel di bawah tombol lonceng.
function NotificationPopover({ notifications, unreadCount, isRead, markAllRead, onNotificationClick, onClose }) {
  const { activeRole } = useAuth();
  const { language, locale, t } = usePreferences();
  const copy = language === "id" ? { all: "Lihat semua notifikasi", unread: "{count} belum dibaca" } : { all: "See all notifications", unread: "{count} unread" };
  const allPath = activeRole === "admin" ? "/admin/notifications" : activeRole === "customer" ? "/notifications" : "";
  useEffect(() => {
    if (!window.matchMedia("(max-width: 639px)").matches) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // HP: dirender ke body agar posisi fixed tidak terkunci oleh pembungkus header.
  const [isPhone] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const panel = <>
    <button className="fixed inset-0 top-[64px] z-[89] bg-black/40 sm:hidden" type="button" aria-label={t("common.close")} onClick={onClose} />
    <section className="fixed inset-x-0 bottom-0 top-[64px] z-[90] grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-2xl bg-[var(--kucur-surface)] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+10px)] sm:max-h-[min(620px,calc(100dvh-90px))] sm:w-[min(400px,calc(100vw-32px))] sm:rounded-2xl sm:border sm:border-[var(--kucur-border)]" aria-label={t("notification.title")} role="dialog" data-notification-panel>
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--kucur-border)] px-4 py-3">
        <div className="min-w-0"><h2 className="text-lg font-extrabold text-[var(--kucur-text)]">{t("notification.title")}</h2>{unreadCount > 0 && <p className="text-sm text-[var(--kucur-text-muted)]">{copy.unread.replace("{count}", unreadCount)}</p>}</div>
        <div className="flex shrink-0 items-center gap-1">
          {unreadCount > 0 && <button className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--kucur-green-ink)] hover:bg-[var(--kucur-green-soft)]" type="button" onClick={markAllRead}>{t("notification.markAll")}</button>}
          <button className="grid size-11 place-items-center rounded-xl text-[var(--kucur-text-muted)] hover:bg-[var(--kucur-surface-muted)]" type="button" onClick={onClose} aria-label={t("common.close")}><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {notifications.length ? notifications.map((notification) => {
          const read = isRead(notification);
          const navigable = isValidNotificationTarget(notification.link);
          const content = localizeNotificationContent(notification, t, language);
          return <button className={`grid w-full min-w-0 grid-cols-[10px_minmax(0,1fr)] gap-3 border-b border-[var(--kucur-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--kucur-surface-muted)] ${read ? "" : "bg-[color-mix(in_srgb,var(--kucur-green-soft)_45%,var(--kucur-surface))]"}`} type="button" key={notification.id} onClick={() => onNotificationClick(notification, navigable)}>
            <span className={`mt-1.5 size-2.5 rounded-full ${read ? "bg-transparent" : "bg-[var(--kucur-green)]"}`} aria-hidden="true" />
            <span className="grid min-w-0 gap-0.5">
              <span className="flex min-w-0 items-baseline justify-between gap-3"><strong className={`min-w-0 truncate text-[15px] ${read ? "font-semibold" : "font-bold"} text-[var(--kucur-text)]`}>{shortenOrderCodes(content.title)}</strong><time className="shrink-0 text-xs text-[var(--kucur-text-muted)]" dateTime={notification.createdAt}>{relativeTime(notification.createdAt, locale, t)}</time></span>
              <span className="line-clamp-2 text-sm leading-5 text-[var(--kucur-text-muted)]">{shortenOrderCodes(content.message)}</span>
            </span>
          </button>;
        }) : <div className="grid place-items-center gap-1 p-8 text-center"><strong className="text-[15px]">{t("notification.empty")}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{t("notification.emptyHint")}</span></div>}
      </div>
      {allPath && <footer className="border-t border-[var(--kucur-border)] p-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3"><Link className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] text-sm font-bold" to={allPath} onClick={onClose}>{copy.all}</Link></footer>}
    </section>
  </>;
  return isPhone ? createPortal(panel, document.body) : panel;
}
export default NotificationPopover;
