export default function DetailSection({ actions, children, className = "", description, title }) {
  return <section className={`min-w-0 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5 ${className}`}>
    {(title || actions) && <header className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0">{title && <h2 className="text-base font-semibold text-kucur-ink sm:text-lg">{title}</h2>}{description && <p className="mt-1 text-sm text-[var(--kucur-muted)]">{description}</p>}</div>{actions}</header>}
    {children}
  </section>;
}
