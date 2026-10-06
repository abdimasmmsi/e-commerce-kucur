import { subscribePending } from "./loadingBus";

// Spinner otomatis di tombol yang barusan diketuk bila ketukan itu memicu permintaan ke server.
// Tombol diberi aria-busy + kelas .kucur-busy sampai semua permintaan selesai (minimal 250 ms supaya tidak berkedip).
// Tombol navigasi/menu (notifikasi, profil, tab bawah) dan elemen ber-data-no-busy dikecualikan.
const SKIP = ".notification-button, .profile-menu-trigger, .customer-bottom-nav, [data-no-busy], [role='tab'], .faq-bot-launcher";
export function installActionBusy() {
  let last = null;
  let busy = null;
  let busySince = 0;
  const clear = () => { if (!busy) return; busy.removeAttribute("aria-busy"); busy.classList.remove("kucur-busy"); busy = null; };
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    last = button && !button.disabled && !button.closest(SKIP) ? { element: button, at: Date.now() } : null;
  }, true);
  subscribePending((pending) => {
    if (pending > 0 && !busy && last && Date.now() - last.at < 500 && last.element.isConnected) {
      busy = last.element; busySince = Date.now(); last = null;
      busy.setAttribute("aria-busy", "true"); busy.classList.add("kucur-busy");
    } else if (pending === 0 && busy) {
      const element = busy;
      window.setTimeout(() => { if (busy === element) clear(); }, Math.max(0, 250 - (Date.now() - busySince)));
    }
  });
}
