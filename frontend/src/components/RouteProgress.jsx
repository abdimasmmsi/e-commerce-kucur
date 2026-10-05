import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { pendingRequests } from "../utils/loadingBus";
import "./RouteProgress.css";

// Bar loading tipis di atas layar setiap pindah halaman; selesai saat data halaman sudah dimuat (maks. 8 detik).
export default function RouteProgress() {
  const { pathname, search } = useLocation();
  const [state, setState] = useState({ phase: "idle", key: 0 });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const startedAt = Date.now();
    queueMicrotask(() => setState((current) => ({ phase: "running", key: current.key + 1 })));
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if ((elapsed >= 300 && pendingRequests() === 0) || elapsed > 8000) {
        clearInterval(timer);
        setState((current) => ({ ...current, phase: "done" }));
        setTimeout(() => setState((current) => (current.phase === "done" ? { ...current, phase: "idle" } : current)), 350);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, search]);
  if (state.phase === "idle") return null;
  return <div className={`route-progress is-${state.phase}`} key={state.key} role="progressbar" aria-label="Memuat halaman" aria-busy={state.phase === "running"}><i /></div>;
}
