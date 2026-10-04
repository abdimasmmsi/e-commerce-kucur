import { createNotification } from "./notificationService";

export const BUG_REPORT_STORAGE_KEY = "kucur_bug_reports";
export const BUG_REPORT_UPDATED_EVENT = "kucur-bug-reports-updated";

export const bugReportStatusLabels = {
  open: "Open",
  "in-progress": "In Progress",
  resolved: "Resolved",
};

const legacyStatusMap = { new: "open", "in-review": "in-progress", closed: "resolved" };

const readStoredReports = () => {
  const stored = localStorage.getItem(BUG_REPORT_STORAGE_KEY);
  if (stored === null) return null;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeReport = (report) => {
  const { adminNote: legacyAdminNote, ...sourceReport } = report;
  const status = legacyStatusMap[report.status] ?? report.status ?? "open";
  const reporterUserId = report.reporterUserId ?? report.reporterId;
  const screenshots = Array.isArray(report.screenshots)
    ? report.screenshots
    : report.screenshot ? [report.screenshot] : [];
  return {
    ...sourceReport,
    reportNumber: report.reportNumber ?? report.id,
    reporterUserId,
    reporterRole: report.reporterRole ?? "customer",
    screenshots,
    status,
    privateNotes: Array.isArray(report.privateNotes) ? report.privateNotes : legacyAdminNote ? [{
      id: `BUG-NOTE-LEGACY-${report.id}`,
      text: legacyAdminNote,
      authorId: report.reviewedBy ?? "admin-legacy",
      authorName: "Admin",
      createdAt: report.reviewedAt ?? report.updatedAt ?? report.createdAt,
    }] : [],
    currentPath: report.currentPath ?? "/report-bug",
    activeStoreId: report.activeStoreId ?? null,
    browserUserAgent: report.browserUserAgent ?? "Unknown (legacy report)",
    resolvedAt: report.resolvedAt ?? null,
    messages: Array.isArray(report.messages) ? report.messages : [],
    readBy: Array.isArray(report.readBy) ? report.readBy : [reporterUserId].filter(Boolean),
    statusHistory: (report.statusHistory ?? []).map((entry) => ({ ...entry, status: legacyStatusMap[entry.status] ?? entry.status })),
  };
};

export function getBugReports() {
  const stored = readStoredReports();
  if (stored === null) {
    localStorage.setItem(BUG_REPORT_STORAGE_KEY, "[]");
    return [];
  }
  const normalized = stored.map(normalizeReport);
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) localStorage.setItem(BUG_REPORT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveBugReports(reports) {
  localStorage.setItem(BUG_REPORT_STORAGE_KEY, JSON.stringify(reports));
  window.dispatchEvent(new CustomEvent(BUG_REPORT_UPDATED_EVENT));
  return reports;
}

const createReportNumber = (reports, date = new Date()) => {
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `BUG-${datePart}-`;
  const sequence = reports.filter((report) => report.reportNumber?.startsWith(prefix)).length + 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
};

export function createBugReport({ user, role, subject, description, screenshots = [], currentPath, activeStoreId, browserUserAgent }) {
  const reports = getBugReports();
  const timestamp = new Date().toISOString();
  const reportNumber = createReportNumber(reports);
  const report = {
    id: `BUG-ID-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    reportNumber,
    reporterUserId: user.id,
    reporterName: user.fullName,
    reporterEmail: user.email,
    reporterRole: role,
    subject: subject.trim(),
    description: description.trim(),
    screenshots,
    currentPath,
    activeStoreId: activeStoreId ?? null,
    browserUserAgent,
    status: "open",
    privateNotes: [],
    messages: [],
    readBy: [user.id],
    createdAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: null,
    statusHistory: [{ status: "open", actorId: user.id, actorName: user.fullName, actorRole: role, timestamp }],
  };
  saveBugReports([report, ...reports]);
  createNotification({
    recipientRole: "admin",
    type: "bug_report",
    title: `Laporan bug baru · ${role}`,
    message: `${user.fullName}: ${report.subject}`,
    link: `/admin/bug-reports/${report.id}`,
    id: `NTF-BUG-CREATED-${report.id}`,
  });
  return report;
}

export function updateBugReportStatus({ reportId, status, privateNote, admin }) {
  if (!admin?.roles?.includes("admin")) return null;
  if (!Object.hasOwn(bugReportStatusLabels, status)) return null;
  const timestamp = new Date().toISOString();
  let updatedReport = null;
  let statusChanged = false;
  const reports = getBugReports().map((report) => {
    if (String(report.id) !== String(reportId)) return report;
    const note = privateNote?.trim();
    const hasStatusChange = status !== report.status;
    statusChanged = hasStatusChange;
    updatedReport = {
      ...report,
      status,
      privateNotes: note ? [...report.privateNotes, {
        id: `BUG-NOTE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: note,
        authorId: admin.id,
        authorName: admin.fullName,
        createdAt: timestamp,
      }] : report.privateNotes,
      reviewedBy: admin.id,
      reviewedAt: timestamp,
      resolvedAt: status === "resolved" ? (report.resolvedAt ?? timestamp) : null,
      updatedAt: timestamp,
      readBy: hasStatusChange ? [admin.id] : report.readBy,
      statusHistory: status === report.status ? report.statusHistory : [...report.statusHistory, {
        status,
        actorId: admin.id,
        actorName: admin.fullName,
        actorRole: "admin",
        timestamp,
      }],
    };
    return updatedReport;
  });
  if (updatedReport) {
    saveBugReports(reports);
    if (statusChanged) createNotification({
      recipientUserId: updatedReport.reporterUserId,
      recipientRole: updatedReport.reporterRole,
      type: "bug_report",
      title: `Status laporan ${updatedReport.reportNumber} diperbarui`,
      message: `${updatedReport.subject} sekarang berstatus ${bugReportStatusLabels[status]}.`,
      link: `/my-bug-reports/${updatedReport.id}`,
      id: `NTF-BUG-STATUS-${updatedReport.id}-${status}`,
    });
  }
  return updatedReport;
}

export function addBugReportMessage({ reportId, sender, text }) {
  const body = text?.trim();
  if (!body) return null;
  const timestamp = new Date().toISOString();
  let createdMessage = null;
  let targetReport = null;
  const reports = getBugReports().map((report) => {
    if (String(report.id) !== String(reportId) || report.status === "resolved") return report;
    const isAdmin = sender.role === "admin" && sender.roles?.includes("admin");
    if (!isAdmin && String(report.reporterUserId) !== String(sender.id)) return report;
    targetReport = report;
    createdMessage = {
      id: `BUG-MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      text: body,
      createdAt: timestamp,
      readBy: [sender.id],
    };
    return { ...report, messages: [...report.messages, createdMessage], readBy: [sender.id], updatedAt: timestamp };
  });
  if (createdMessage) {
    saveBugReports(reports);
    const fromAdmin = sender.role === "admin" && sender.roles?.includes("admin");
    createNotification({
      recipientUserId: fromAdmin ? targetReport.reporterUserId : null,
      recipientRole: fromAdmin ? targetReport.reporterRole : "admin",
      type: "bug_report",
      title: `Balasan laporan ${targetReport.reportNumber}`,
      message: `${sender.name} mengirim klarifikasi baru.`,
      link: fromAdmin ? `/my-bug-reports/${targetReport.id}` : `/admin/bug-reports/${targetReport.id}`,
      id: `NTF-BUG-MESSAGE-${createdMessage.id}`,
    });
  }
  return createdMessage;
}

export function markBugReportRead(reportId, userId) {
  let changed = false;
  const reports = getBugReports().map((report) => {
    if (String(report.id) !== String(reportId)) return report;
    const reportReadBy = report.readBy ?? [];
    const messages = report.messages.map((message) => {
      const readBy = message.readBy ?? [];
      if (readBy.includes(userId)) return message;
      changed = true;
      return { ...message, readBy: [...readBy, userId] };
    });
    if (!reportReadBy.includes(userId)) changed = true;
    return { ...report, messages, readBy: reportReadBy.includes(userId) ? reportReadBy : [...reportReadBy, userId] };
  });
  if (changed) saveBugReports(reports);
  return changed;
}

export function getBugReportUnreadCount(userId, { admin = false } = {}) {
  return getBugReports().filter((report) => admin || report.reporterUserId === userId).filter((report) => !(report.readBy ?? []).includes(userId)).length;
}

export function getUserBugReports(userId) {
  return getBugReports().filter((report) => report.reporterUserId === userId);
}

export function getBugReportById(reportId) {
  return getBugReports().find((report) => String(report.id) === String(reportId)) ?? null;
}

export const getBugReport = getBugReportById;
