// Label kecil untuk halaman Monitoring Keuangan Admin (status tagihan & status lapak), mengikuti warna StatusBadge.
const TONES = {
  danger: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  warning: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
};

export function FinanceBadge({ tone = "", children }) {
  return <span className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${TONES[tone] || "bg-[var(--kucur-surface-muted)] text-[var(--kucur-text)] ring-[var(--kucur-border)]"}`}>{children}</span>;
}

export function StoreFinanceStatus({ status = "", label }) {
  const tone = status === "active" ? "success" : status.startsWith("suspended") ? "danger" : status === "pending_initial_payment" ? "warning" : "";
  return <FinanceBadge tone={tone}>{label}</FinanceBadge>;
}
