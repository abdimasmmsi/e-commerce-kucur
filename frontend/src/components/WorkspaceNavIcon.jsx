const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  batches: <><path d="M4 6h16v13H4z"/><path d="M8 6V3h8v3M8 11h8M8 15h5"/></>,
  assignments: <><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  delivery: <><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
  history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M4 4l2 2"/></>,
  availability: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/></>,
  stores: <><path d="M3 10h18"/><path d="m5 10 1-6h12l1 6"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.4.5 3.7 2.5 4 6"/></>,
  transactions: <><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21"/></>,
  reports: <><path d="M6 3h9l3 3v15H6V3Z"/><path d="M9 11h6M9 15h6M14 3v4h4"/></>,
  reviews: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  analytics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  finance: <><path d="M4 6h16v14H4z"/><path d="M4 10h16M8 15h3"/></>,
  chat: <path d="M4 5h16v11H9l-5 4V5Z"/>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/></>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 20h4"/></>,
  bug: <><path d="M8 9h8v7a4 4 0 0 1-8 0V9Z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M4 12h4m8 0h4M5 18l3-2m8 0 3 2"/></>,
};

export default function WorkspaceNavIcon({ type }) {
  return <svg className="workspace-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] ?? paths.dashboard}</svg>;
}
