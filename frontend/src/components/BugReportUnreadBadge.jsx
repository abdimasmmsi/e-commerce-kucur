import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BUG_REPORT_STORAGE_KEY, BUG_REPORT_UPDATED_EVENT, getBugReportUnreadCount } from "../services/mockBugReportService";
import "./BugReportUnreadBadge.css";

function BugReportUnreadBadge({ adminMode = false }) {
  const { user } = useAuth();
  const [count, setCount] = useState(() => getBugReportUnreadCount(user.id, { admin: adminMode }));
  useEffect(() => {
    const refresh = () => setCount(getBugReportUnreadCount(user.id, { admin: adminMode }));
    const storage = (event) => { if (event.key === BUG_REPORT_STORAGE_KEY) refresh(); };
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(BUG_REPORT_UPDATED_EVENT, refresh); window.removeEventListener("storage", storage); };
  }, [adminMode, user.id]);
  if (!count) return null;
  return <span className="bug-report-unread-badge" aria-label={`${count} pembaruan laporan bug belum dibaca`}>{count > 99 ? "99+" : count}</span>;
}

export default BugReportUnreadBadge;
