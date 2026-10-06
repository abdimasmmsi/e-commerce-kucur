import { useState } from "react";
import { ColumnChart, LineChart, Sparkline } from "./AnalyticsCharts";
import { AVERAGE_METRICS, METRICS, formatMetric, shortMetric } from "../../utils/analytics";

// Satu widget laporan Analitik. Warna seri dari token --chart-* (refine.css, divalidasi buta warna);
// identitas tidak hanya dari warna: selalu ada label, nilai, dan tampilan Tabel.
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const LOWER_IS_BETTER = ["cancelRate", "cancelledOrders", "failedDeliveries"];
const copyByLanguage = {
  id: { vsPrevious: "dari periode lalu", noPrevious: "Belum ada pembanding", same: "Sama dengan periode lalu", table: "Tabel", chart: "Grafik", showTable: "Tampilkan tabel", showChart: "Tampilkan grafik", total: "Total", share: "Porsi", item: "Nama", value: "Nilai", trend: "Tren dalam periode", average: "Rata-rata", highest: "Tertinggi", lowest: "Terendah", latest: "Terakhir", perBucket: { day: "Rata-rata per hari", week: "Rata-rata per minggu", month: "Rata-rata per bulan" }, regrouped: { week: "Ditampilkan per minggu supaya mudah dibaca.", month: "Ditampilkan per bulan supaya mudah dibaca." } },
  en: { vsPrevious: "vs previous period", noPrevious: "No comparison yet", same: "Same as previous period", table: "Table", chart: "Chart", showTable: "Show table", showChart: "Show chart", total: "Total", share: "Share", item: "Name", value: "Value", trend: "Trend in period", average: "Average", highest: "Highest", lowest: "Lowest", latest: "Latest", perBucket: { day: "Average per day", week: "Average per week", month: "Average per month" }, regrouped: { week: "Shown per week so it stays readable.", month: "Shown per month so it stays readable." } },
};

function Delta({ widget, result, copy, language }) {
  if (!result.previous) return <span className="text-[13px] text-[var(--kucur-text-muted)]">{copy.noPrevious}</span>;
  const change = ((result.total - result.previous) / result.previous) * 100;
  if (!Number.isFinite(change)) return null;
  if (Math.abs(change) < 0.05) return <span className="text-[13px] text-[var(--kucur-text-muted)]">{copy.same}</span>;
  const good = LOWER_IS_BETTER.includes(widget.metric) ? change < 0 : change > 0;
  const text = `${Math.abs(change).toLocaleString(language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 })}%`;
  return <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${good ? "bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200"}`}>
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{change > 0 ? <path d="M7 17 17 7M9 7h8v8"/> : <path d="M7 7l10 10M17 9v8H9"/>}</svg>{text}
    </span>
    <span className="text-[var(--kucur-text-muted)]">{copy.vsPrevious}</span>
  </span>;
}

function DataTable({ rows, value, copy, showShare }) {
  const sum = rows.reduce((total, row) => total + (row.value ?? 0), 0) || 1;
  return <div className="max-h-80 overflow-auto rounded-lg border border-[var(--kucur-border)]">
    <table className="w-full text-[13px] sm:text-sm">
      <thead className="sticky top-0 bg-[var(--kucur-surface-elevated)] text-left text-xs text-[var(--kucur-text-muted)]"><tr><th className="px-2.5 py-2 sm:px-3 font-semibold" scope="col">{copy.item}</th><th className="px-2.5 py-2 sm:px-3 text-right font-semibold" scope="col">{copy.value}</th>{showShare && <th className="w-16 px-2.5 py-2 sm:px-3 text-right font-semibold" scope="col">{copy.share}</th>}</tr></thead>
      <tbody>{rows.map((row) => <tr className="border-t border-[var(--kucur-border)]" key={row.key}>
        <td className="px-2.5 py-2 font-semibold [overflow-wrap:anywhere] sm:px-3">{row.label}</td>
        <td className="whitespace-nowrap px-2.5 py-2 text-right tabular-nums sm:px-3">{value(row.value)}</td>
        {showShare && <td className="px-2.5 py-2 sm:px-3 text-right tabular-nums text-[var(--kucur-text-muted)]">{row.value === null ? "–" : `${Math.round((row.value / sum) * 100)}%`}</td>}
      </tr>)}</tbody>
    </table>
  </div>;
}

// Batang horizontal: label kiri, batang (maks. 12px, ujung membulat), nilai di ujung batang.
function HorizontalBars({ rows, value }) {
  const max = Math.max(...rows.map((row) => row.value), 0) || 1;
  return <ol className="grid gap-1">{rows.map((row, index) => <li className="group grid grid-cols-[1.25rem_minmax(0,9rem)_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-[var(--kucur-surface-elevated)] sm:grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)]" key={row.key} title={`${row.label}: ${value(row.value)}`}>
    <span className="text-right text-xs font-bold tabular-nums text-[var(--kucur-text-muted)]">{index + 1}</span>
    <span className="truncate font-semibold">{row.label}</span>
    <span className="flex min-w-0 items-center gap-2"><span className="h-3 min-w-[3px] rounded-r-[4px] bg-[var(--chart-1)] transition-[width] duration-300" style={{ width: `${(row.value / max) * 100}%` }}/><span className="shrink-0 text-[13px] font-bold tabular-nums">{value(row.value)}</span></span>
  </li>)}</ol>;
}

// Batang tumpuk 100%: maks. 6 warna tetap urutannya + "Lainnya" abu; jarak 2px antarsegmen.
function ShareBar({ rows, value, language }) {
  const sum = rows.reduce((total, row) => total + row.value, 0) || 1;
  const [active, setActive] = useState(null);
  const color = (row, index) => (row.other ? "var(--chart-other)" : SERIES[index % SERIES.length]);
  const percent = (row) => `${(Math.round((row.value / sum) * 1000) / 10).toLocaleString(language === "en" ? "en-US" : "id-ID")}%`;
  return <div className="grid gap-3">
    <div className="flex h-6 gap-[2px] overflow-hidden rounded-md bg-[var(--kucur-surface)]" role="img" aria-label={rows.map((row) => `${row.label} ${percent(row)}`).join(", ")}>
      {rows.filter((row) => row.value > 0).map((row, index) => <span className="h-full min-w-[3px] transition-opacity first:rounded-l-md last:rounded-r-md" key={row.key} title={`${row.label}: ${value(row.value)} (${percent(row)})`} style={{ flexGrow: row.value, flexBasis: 0, background: color(row, rows.indexOf(row)), opacity: active === null || active === row.key ? 1 : 0.35 }} onPointerEnter={() => setActive(row.key)} onPointerLeave={() => setActive(null)} data-index={index}/>)}
    </div>
    <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{rows.map((row, index) => <li className={`flex min-h-9 items-center gap-2.5 rounded-lg px-1.5 text-sm ${active === row.key ? "bg-[var(--kucur-surface-elevated)]" : ""}`} key={row.key} onPointerEnter={() => setActive(row.key)} onPointerLeave={() => setActive(null)}>
      <span className="size-3 shrink-0 rounded-[3px]" style={{ background: color(row, index) }} aria-hidden="true"/>
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      <strong className="tabular-nums">{value(row.value)}</strong>
      <span className="w-12 text-right tabular-nums text-[var(--kucur-text-muted)]">{percent(row)}</span>
    </li>)}</ul>
  </div>;
}

export default function AnalyticsWidget({ widget, title, result, format, language, emptyLabel }) {
  const copy = copyByLanguage[language] ?? copyByLanguage.id;
  const [asTable, setAsTable] = useState(false);
  const value = (amount) => formatMetric(widget.metric, amount, format);
  const rows = result.rows ?? [];
  const card = "analytics-widget grid min-w-0 content-start rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]";

  if (widget.view === "kpi") {
    return <section className={`${card} gap-1.5 p-4`}>
      <h3 className="text-sm font-semibold text-[var(--kucur-text-muted)]">{title}</h3>
      <strong className="break-words text-[clamp(19px,5.2vw,28px)] font-extrabold leading-tight tracking-[-0.02em]">{value(result.total)}</strong>
      <Delta widget={widget} result={result} copy={copy} language={language}/>
      {(result.trend?.length ?? 0) > 1 && <div className="mt-1"><Sparkline values={result.trend} label={`${copy.trend}: ${title}`}/></div>}
    </section>;
  }

  const empty = !rows.length || rows.every((row) => !row.value);
  const chartView = widget.view !== "table";
  const label = `${title}: ${rows.map((row) => `${row.label} ${value(row.value)}`).join(", ")}`;
  const isAverage = AVERAGE_METRICS.has(widget.metric);
  const total = isAverage ? result.total : rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const short = (amount) => shortMetric(widget.metric, amount, language);
  const maxHint = METRICS[widget.metric]?.rating ? 5 : METRICS[widget.metric]?.percent ? 100 : null;
  // Ringkasan di bawah grafik waktu: angka penting terbaca tanpa hover.
  const timeSummary = (() => {
    if (!result.timeGroup || empty) return [];
    const withValue = rows.filter((row) => row.value !== null && row.value !== undefined);
    if (!withValue.length) return [];
    const highest = withValue.reduce((best, row) => (row.value > best.value ? row : best));
    const lowest = withValue.reduce((best, row) => (row.value < best.value ? row : best));
    const latest = withValue.at(-1);
    return [
      { label: copy.highest, value: value(highest.value), note: highest.label },
      isAverage ? { label: copy.lowest, value: value(lowest.value), note: lowest.label } : { label: copy.perBucket[result.timeGroup], value: value(total / Math.max(rows.length, 1)) },
      { label: copy.latest, value: value(latest.value), note: latest.label },
    ];
  })();
  return <section className={`${card} gap-3 p-4 sm:p-5`}>
    <header className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-base font-extrabold leading-snug">{title}</h3>{!empty && <p className="mt-0.5 text-[13px] text-[var(--kucur-text-muted)]">{isAverage ? copy.average : copy.total}: <strong className="font-bold text-[var(--kucur-text)]">{value(total)}</strong></p>}</div>
      {chartView && !empty && <button className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--kucur-border)] px-2.5 text-xs font-bold text-[var(--kucur-text-muted)] hover:border-[var(--kucur-green)] hover:text-[var(--kucur-text)]" type="button" data-no-busy aria-pressed={asTable} aria-label={asTable ? copy.showChart : copy.showTable} onClick={() => setAsTable((current) => !current)}>
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{asTable ? <path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/> : <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></>}</svg>{asTable ? copy.chart : copy.table}
      </button>}
    </header>
    {empty ? <p className="rounded-xl border border-dashed border-[var(--kucur-border-strong)] p-6 text-center text-sm text-[var(--kucur-text-muted)]">{emptyLabel}</p>
      : asTable || widget.view === "table" ? <DataTable rows={rows} value={value} copy={copy} showShare={widget.view === "share" || !["avgOrder", "avgRating", "cancelRate"].includes(widget.metric)}/>
      : widget.view === "bar" ? <ColumnChart rows={rows} format={value} short={short} maxHint={maxHint} language={language} label={label}/>
      : widget.view === "line" ? <LineChart rows={rows} format={value} short={short} maxHint={maxHint} language={language} label={label}/>
      : widget.view === "share" ? <ShareBar rows={rows} value={value} language={language}/>
      : <HorizontalBars rows={rows} value={value}/>}
    {!empty && !asTable && timeSummary.length > 0 && widget.view !== "table" && <dl className="grid grid-cols-3 gap-2 border-t border-[var(--kucur-border)] pt-3">{timeSummary.map((item) => <div className="min-w-0" key={item.label}><dt className="truncate text-xs text-[var(--kucur-text-muted)]">{item.label}</dt><dd className="m-0 truncate text-sm font-extrabold sm:text-[15px]">{item.value}</dd>{item.note && <dd className="m-0 truncate text-xs text-[var(--kucur-text-muted)]">{item.note}</dd>}</div>)}</dl>}
    {!empty && result.regrouped && <p className="text-xs text-[var(--kucur-text-muted)]">{copy.regrouped[result.timeGroup]}</p>}
  </section>;
}
