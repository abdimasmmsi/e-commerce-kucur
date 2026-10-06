import { formatMetric } from "../../utils/analytics";

// Satu widget laporan. Warna seri mengikuti token Kucur; bentuk dibedakan juga dengan label/angka (bukan warna saja).
const SHARE_COLORS = ["#23803a", "#3d6fb4", "#e3a21a", "#b4483d", "#6b4a8a", "#2f8f8a", "#8a6a3b", "#57615a"];

export default function AnalyticsWidget({ widget, title, result, format, language, emptyLabel }) {
  const value = (amount) => formatMetric(widget.metric, amount, format);
  const rows = result.rows ?? [];
  const max = Math.max(...rows.map((row) => row.value), 0);
  const empty = widget.view !== "kpi" && (!rows.length || rows.every((row) => !row.value));

  if (widget.view === "kpi") {
    const change = result.previous ? ((result.total - result.previous) / result.previous) * 100 : null;
    const lowerIsBetter = ["cancelRate", "cancelledOrders", "failedDeliveries"].includes(widget.metric);
    const good = change === null ? null : lowerIsBetter ? change <= 0 : change >= 0;
    return <section className="analytics-widget grid content-start gap-1 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--kucur-text-muted)]">{title}</h3>
      <strong className="text-2xl font-extrabold tracking-[-0.02em] tabular-nums">{value(result.total)}</strong>
      {change !== null && Number.isFinite(change) && <span className={`text-[13px] font-bold ${good ? "text-[var(--kucur-green-ink)]" : "text-rose-700 dark:text-rose-300"}`}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toLocaleString(language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 })}% {language === "en" ? "vs previous period" : "dari periode lalu"}</span>}
    </section>;
  }

  return <section className="analytics-widget grid min-w-0 content-start gap-3 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4">
    <h3 className="text-base font-extrabold">{title}</h3>
    {empty ? <p className="rounded-lg border border-dashed border-[var(--kucur-border-strong)] p-5 text-center text-sm text-[var(--kucur-text-muted)]">{emptyLabel}</p> : <>
      {widget.view === "bar" && <div>
        <div className="flex h-44 items-end gap-[3px] border-b border-[var(--kucur-border)]" role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${value(row.value)}`).join(", ")}`}>
          {rows.map((row, index) => <span className="flex-1 rounded-t-[3px]" key={row.key} title={`${row.label}: ${value(row.value)}`} style={{ height: `${max ? Math.max((row.value / max) * 100, row.value ? 2 : 0) : 0}%`, background: index === rows.length - 1 ? "var(--kucur-green)" : "color-mix(in srgb, var(--kucur-green) 45%, var(--kucur-surface))" }} />)}
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-xs text-[var(--kucur-text-muted)]"><span>{rows[0]?.label}</span>{rows.length > 2 && <span>{rows[Math.floor(rows.length / 2)]?.label}</span>}<span>{rows[rows.length - 1]?.label}</span></div>
      </div>}
      {widget.view === "line" && <div>
        <svg className="h-44 w-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${value(row.value)}`).join(", ")}`}>
          <polyline fill="none" stroke="var(--kucur-green)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" points={rows.map((row, index) => `${rows.length > 1 ? (index / (rows.length - 1)) * 100 : 50},${40 - (max ? (row.value / max) * 36 : 0)}`).join(" ")} />
          {rows.map((row, index) => <circle cx={rows.length > 1 ? (index / (rows.length - 1)) * 100 : 50} cy={40 - (max ? (row.value / max) * 36 : 0)} r="1.1" fill="var(--kucur-green)" key={row.key}><title>{`${row.label}: ${value(row.value)}`}</title></circle>)}
        </svg>
        <div className="mt-1.5 flex justify-between gap-2 text-xs text-[var(--kucur-text-muted)]"><span>{rows[0]?.label}</span><span>{rows[rows.length - 1]?.label}</span></div>
      </div>}
      {widget.view === "hbar" && <ul className="grid gap-2.5">{rows.map((row) => <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2.5 text-sm" key={row.key}><span className="truncate font-semibold" title={row.label}>{row.label}</span><span className="h-3 overflow-hidden rounded-full bg-[var(--kucur-surface-muted)]"><span className="block h-3 rounded-full bg-[var(--kucur-green)]" style={{ width: `${max ? (row.value / max) * 100 : 0}%` }} /></span><span className="text-right font-bold tabular-nums">{value(row.value)}</span></li>)}</ul>}
      {widget.view === "table" && <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{rows.map((row) => <tr className="border-t border-[var(--kucur-border)] first:border-t-0" key={row.key}><td className="py-2 pr-3 font-semibold">{row.label}</td><td className="py-2 text-right tabular-nums">{value(row.value)}</td></tr>)}</tbody></table></div>}
      {widget.view === "share" && (() => { const sum = rows.reduce((total, row) => total + row.value, 0) || 1; return <div className="grid gap-3">
        <div className="flex h-5 overflow-hidden rounded-md" role="img" aria-label={rows.map((row) => `${row.label} ${Math.round((row.value / sum) * 100)}%`).join(", ")}>{rows.map((row, index) => <span key={row.key} style={{ width: `${(row.value / sum) * 100}%`, background: SHARE_COLORS[index % SHARE_COLORS.length] }} />)}</div>
        <ul className="grid gap-2 sm:grid-cols-2">{rows.map((row, index) => <li className="flex items-center gap-2 text-sm" key={row.key}><span className="size-3 shrink-0 rounded-sm" style={{ background: SHARE_COLORS[index % SHARE_COLORS.length] }} /><span className="min-w-0 flex-1 truncate">{row.label}</span><strong className="tabular-nums">{value(row.value)}</strong><span className="w-10 text-right text-[var(--kucur-text-muted)]">{Math.round((row.value / sum) * 100)}%</span></li>)}</ul>
      </div>; })()}
    </>}
  </section>;
}
