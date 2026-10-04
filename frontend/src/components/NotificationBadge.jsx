import { useNotifications } from "../context/NotificationContext";
import "./NotificationBadge.css";

function NotificationBadge() {
  const { unreadCount } = useNotifications();
  if (!unreadCount) return null;
  return <span className="notification-count-badge" aria-label={`${unreadCount} notifikasi belum dibaca`}>{unreadCount > 99 ? "99+" : unreadCount}</span>;
}

export default NotificationBadge;
