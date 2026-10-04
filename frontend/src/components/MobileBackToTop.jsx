import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePreferences } from "../context/PreferencesContext";
import "./MobileBackToTop.css";

function MobileBackToTop() {
  const { t } = usePreferences();
  const [visible, setVisible] = useState(false);
  // Halaman dengan bar aksi bawah (beli, keranjang, checkout) tidak memakai tombol ini agar tidak menutupi aksi utama.
  const hasActionBar = /^\/(products\/[^/]+|cart|checkout)\/?$/.test(useLocation().pathname);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = Math.max(360, window.innerHeight * 0.65);
      setVisible(window.scrollY > threshold);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = () => window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });

  if (hasActionBar) return null;
  return <button className={`mobile-back-to-top${visible ? " is-visible" : ""}`} type="button" onClick={scrollToTop} aria-label={t("common.backToTop")} title={t("common.backToTop")}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 11 6-6 6 6M12 5v14" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </button>;
}

export default MobileBackToTop;
