import { useEffect } from "react";
import "./BugScreenshotModal.css";

function BugScreenshotModal({ screenshot, onClose }) {
  useEffect(() => {
    if (!screenshot) return undefined;
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, screenshot]);
  if (!screenshot) return null;
  return <div className="bug-screenshot-modal" role="dialog" aria-modal="true" aria-label="Preview screenshot"><button className="bug-screenshot-backdrop" type="button" onClick={onClose} aria-label="Tutup preview" /><section><header><strong>{screenshot.name}</strong><button type="button" onClick={onClose} aria-label="Tutup preview">×</button></header><img src={screenshot.dataUrl} alt={screenshot.name} /></section></div>;
}

export default BugScreenshotModal;
