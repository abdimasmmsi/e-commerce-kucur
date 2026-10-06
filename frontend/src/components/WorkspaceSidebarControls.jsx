import { useEffect, useRef, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../utils/useWorkspaceSidebar";

const copyByLanguage = {
  id: { collapse: "Ciutkan menu", expand: "Lebarkan menu", resize: "Ubah lebar menu (tarik, atau pakai panah kiri/kanan; ketuk dua kali untuk ukuran awal)" },
  en: { collapse: "Collapse menu", expand: "Expand menu", resize: "Resize menu (drag, or use the left/right arrows; double-click to reset)" },
};

// Tombol ciutkan di dalam sidebar. Hanya tampil di layar lebar (lihat refine.css).
export default function WorkspaceSidebarControls({ sidebar }) {
  const { language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const { collapsed, toggleCollapsed } = sidebar;
  const toggleRef = useRef(null);

  // Saat diciutkan hanya ikon yang tampil, jadi nama menu dipasang sebagai tooltip (title).
  useEffect(() => {
    const aside = toggleRef.current?.closest("aside");
    if (!aside) return undefined;
    const links = [...aside.querySelectorAll("nav a")];
    links.forEach((link) => { if (collapsed) link.setAttribute("title", link.textContent.trim()); else link.removeAttribute("title"); });
    return () => links.forEach((link) => link.removeAttribute("title"));
  }, [collapsed]);

  return <button ref={toggleRef} className="workspace-sidebar-toggle" type="button" data-no-busy aria-expanded={!collapsed} aria-label={collapsed ? copy.expand : copy.collapse} title={collapsed ? copy.expand : copy.collapse} onClick={toggleCollapsed}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>{collapsed ? <path d="m13 10 2 2-2 2"/> : <path d="m16 10-2 2 2 2"/>}</svg>
  </button>;
}

// Pegangan tarik di antara sidebar dan konten (di luar sidebar, supaya tidak tertutup scrollbar sidebar).
export function WorkspaceSidebarResizer({ sidebar }) {
  const { language } = usePreferences();
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const { collapsed, width, setWidth } = sidebar;
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  // Listener dipasang langsung saat pegangan ditekan (bukan lewat effect) supaya gerakan cepat tidak terlewat.
  const stopRef = useRef(null);
  useEffect(() => () => stopRef.current?.(), []);
  const startDrag = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { x: event.clientX, width: collapsed ? 72 : width };
    const move = (moveEvent) => { if (drag.current) setWidth(drag.current.width + moveEvent.clientX - drag.current.x); };
    const stop = () => {
      drag.current = null; stopRef.current = null; setDragging(false);
      document.body.classList.remove("workspace-sidebar-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    stopRef.current = stop;
    document.body.classList.add("workspace-sidebar-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    setDragging(true);
  };
  const onKey = (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setWidth(width - 16); }
    if (event.key === "ArrowRight") { event.preventDefault(); setWidth(width + 16); }
    if (event.key === "Home") { event.preventDefault(); setWidth(SIDEBAR_DEFAULT_WIDTH); }
  };
  return <div className="workspace-sidebar-resizer-slot">
    <div className={`workspace-sidebar-resizer${dragging ? " is-dragging" : ""}`} role="separator" aria-orientation="vertical" aria-label={copy.resize} title={copy.resize} aria-valuemin={SIDEBAR_MIN_WIDTH} aria-valuemax={SIDEBAR_MAX_WIDTH} aria-valuenow={collapsed ? 72 : width} tabIndex={0} onPointerDown={startDrag} onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)} onKeyDown={onKey}/>
  </div>;
}
