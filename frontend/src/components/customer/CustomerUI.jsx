import { Link } from "react-router-dom";
import PageContainer from "../ui/PageContainer";

export function CustomerPage({ children, className = "" }) {
  return <PageContainer className={className}>{children}</PageContainer>;
}

export function CustomerPageHeader({ eyebrow, title, description, actions }) {
  return <header className="flex min-w-0 flex-col gap-4 border-b border-[var(--kucur-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0 max-w-3xl">
      {eyebrow && <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-kucur-clay">{eyebrow}</span>}
      <h1 className="text-balance text-3xl font-black tracking-[-0.035em] text-[var(--kucur-text)] sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--kucur-text-muted)] sm:text-base">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function CustomerSection({ title, description, action, children, className = "" }) {
  return <section className={`min-w-0 ${className}`}>
    {(title || action) && <div className="mb-4 flex min-w-0 items-end justify-between gap-4 border-b border-[var(--kucur-border)] pb-4 sm:mb-5">
      <div className="min-w-0"><h2 className="text-xl font-extrabold tracking-[-0.025em] text-[var(--kucur-text)] sm:text-2xl">{title}</h2>{description && <p className="mt-1 text-sm text-[var(--kucur-text-muted)]">{description}</p>}</div>
      {action}
    </div>}
    {children}
  </section>;
}

export function CustomerPanel({ children, className = "", as: Tag = "section" }) {
  return <Tag className={`min-w-0 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] shadow-[0_8px_30px_rgba(30,48,34,0.05)] ${className}`}>{children}</Tag>;
}

export function CustomerLoading({ label, count = 4 }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" role="status" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <div className="animate-pulse overflow-hidden rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]" key={index} aria-hidden="true"><div className="aspect-square bg-[var(--kucur-surface-elevated)]"/><div className="space-y-3 p-3 sm:p-4"><i className="block h-3 w-2/5 rounded-full bg-[var(--kucur-border)]"/><i className="block h-4 w-4/5 rounded-full bg-[var(--kucur-border)]"/><i className="block h-4 w-1/2 rounded-full bg-[var(--kucur-border)]"/></div></div>)}
  </div>;
}

export function CustomerEmpty({ title, description, action }) {
  return <CustomerPanel className="grid min-h-52 place-items-center p-6 text-center sm:p-10"><div className="max-w-md"><span className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-kucur-sand text-lg font-black text-kucur-forest" aria-hidden="true">K</span><h2 className="text-lg font-extrabold text-[var(--kucur-text)]">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-[var(--kucur-text-muted)]">{description}</p>}{action && <div className="mt-5 flex justify-center">{action}</div>}</div></CustomerPanel>;
}

export function CustomerLinkButton({ to, children, secondary = false, className = "" }) {
  return <Link className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${secondary ? "border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)] hover:border-kucur-forest hover:text-kucur-forest" : "bg-kucur-forest !text-white hover:bg-kucur-forest-dark"} ${className}`} to={to}>{children}</Link>;
}
