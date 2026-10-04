export default function StatusTimeline({ currentIndex = -1, exception = false, label, steps }) {
  return <ol className="grid min-w-0 gap-3 sm:grid-flow-col sm:auto-cols-fr sm:gap-2" aria-label={label}>
    {steps.map((step, index) => {
      const completed = !exception && index < currentIndex;
      const active = index === currentIndex;
      return <li className="relative grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-1 sm:justify-items-center sm:text-center" aria-current={active ? "step" : undefined} key={step.key ?? step.label}>
        {index > 0 && <i className={`absolute left-[13px] top-[-14px] h-4 w-0.5 sm:left-[-50%] sm:top-[13px] sm:h-0.5 sm:w-full ${completed || active ? "bg-[var(--kucur-green)]" : "bg-[var(--kucur-border-strong)]"}`} aria-hidden="true" />}
        <span className={`relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-bold ${exception && active ? "border-rose-500 bg-rose-500 text-white" : completed ? "border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-forest-dark)]" : active ? "border-[var(--kucur-green)] bg-[var(--kucur-surface)] text-[var(--kucur-green-ink)] ring-4 ring-[var(--kucur-green-soft)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-muted)]"}`}>{completed ? "✓" : index + 1}</span>
        <span className={`min-w-0 break-words text-xs leading-4 ${active ? "font-bold text-[var(--kucur-text)]" : completed ? "font-semibold text-[var(--kucur-green-ink)]" : "text-[var(--kucur-text-muted)]"}`}>{step.label}</span>
      </li>;
    })}
  </ol>;
}
