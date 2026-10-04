import { useEffect } from "react";
import Button from "./Button";

export default function ActionDialog({
  busy = false,
  cancelLabel,
  children,
  confirmLabel,
  confirmDisabled = false,
  description,
  destructive = false,
  onCancel,
  onConfirm,
  open,
  title,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === "Escape" && !busy) onCancel?.(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel?.(); }}>
    <section className="my-auto w-full max-w-lg overflow-hidden rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] text-[var(--kucur-text)] shadow-2xl" role={destructive ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="action-dialog-title" aria-describedby={description ? "action-dialog-description" : undefined} onMouseDown={(event) => event.stopPropagation()}>
      <header className="border-b border-[var(--kucur-border)] px-5 py-4 sm:px-6"><h2 className="text-lg font-semibold text-kucur-ink" id="action-dialog-title">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-[var(--kucur-muted)]" id="action-dialog-description">{description}</p>}</header>
      {children && <div className="grid gap-4 px-5 py-4 sm:px-6">{children}</div>}
      <footer className="flex flex-col-reverse gap-2 border-t border-[var(--kucur-border)] bg-kucur-sand px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><Button variant="secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</Button><Button variant={destructive ? "danger" : "primary"} disabled={busy || confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button></footer>
    </section>
  </div>;
}
