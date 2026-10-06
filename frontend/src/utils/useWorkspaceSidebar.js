import { useCallback, useEffect, useState } from "react";

// Sidebar workspace (Admin/Lapak/Kurir) di laptop: bisa diciutkan jadi ikon saja dan lebarnya bisa ditarik.
// Disimpan per peran di browser ini (kenyamanan saja, aman bila penyimpanan diblokir). Di HP tetap laci menu biasa.
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_DEFAULT_WIDTH = 220;
const clampWidth = (value) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(Number(value) || SIDEBAR_DEFAULT_WIDTH)));
const storageKey = (role) => `kucur:sidebar:${role}`;
const readPrefs = (role) => {
  try { const saved = JSON.parse(localStorage.getItem(storageKey(role)) || "{}"); return { collapsed: saved.collapsed === true, width: clampWidth(saved.width) }; }
  catch { return { collapsed: false, width: SIDEBAR_DEFAULT_WIDTH }; }
};

export function useWorkspaceSidebar(role) {
  const [prefs, setPrefs] = useState(() => readPrefs(role));
  useEffect(() => { try { localStorage.setItem(storageKey(role), JSON.stringify(prefs)); } catch { /* penyimpanan tidak tersedia */ } }, [prefs, role]);
  const setWidth = useCallback((width) => setPrefs((current) => ({ ...current, collapsed: false, width: clampWidth(width) })), []);
  const toggleCollapsed = useCallback(() => setPrefs((current) => ({ ...current, collapsed: !current.collapsed })), []);
  return {
    collapsed: prefs.collapsed,
    width: prefs.width,
    setWidth,
    toggleCollapsed,
    sidebarProps: { "data-collapsed": prefs.collapsed ? "true" : undefined, style: { "--workspace-sidebar-width": `${prefs.width}px` } },
  };
}
