import { useEffect, useId, useRef, useState } from "react";
import { compactNumber, niceTicks } from "../../utils/analytics";

// Grafik analitik admin (SVG buatan sendiri, tanpa library). Aturan visual:
// batang <= 24px dengan ujung membulat 4px, garis 2px, garis bantu tipis, angka sumbu dibulatkan,
// tooltip saat hover/sentuh/fokus keyboard (panah kiri/kanan), dan semua angka juga ada di tampilan Tabel.

// Lebar elemen (ResizeObserver) supaya teks sumbu tidak ikut melar seperti pada viewBox "none".
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Tooltip({ point, left, top, width }) {
  if (!point) return null;
  const clamped = Math.min(Math.max(left, 8), Math.max(width - 8, 8));
  const alignRight = clamped > width * 0.6;
  return <div className="pointer-events-none absolute z-10 grid gap-0.5 rounded-lg border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-2.5 py-1.5 text-left shadow-[var(--shadow-lift)]" style={{ left: clamped, top, transform: `translate(${alignRight ? "calc(-100% - 10px)" : "10px"}, -50%)` }} role="presentation">
    <strong className="whitespace-nowrap text-sm font-extrabold text-[var(--kucur-text)]">{point.formatted}</strong>
    <span className="whitespace-nowrap text-xs text-[var(--kucur-text-muted)]">{point.label}</span>
  </div>;
}

// Kerangka bersama grafik waktu (batang atau garis): sumbu Y, garis bantu, label X, interaksi.
function TimeChart({ rows, format, language, label, kind }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const descriptionId = useId();
  const height = 200;
  const pad = { top: 12, right: kind === "line" ? 56 : 12, bottom: 26, left: 52 };
  const max = Math.max(...rows.map((row) => row.value), 0);
  const ticks = niceTicks(max);
  const top = ticks.at(-1) || 1;
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;
  const band = plotWidth / Math.max(rows.length, 1);
  const x = (index) => pad.left + band * index + band / 2;
  const y = (value) => pad.top + plotHeight - (value / top) * plotHeight;
  const barWidth = Math.max(Math.min(24, band * 0.68), 2);
  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(Math.floor(plotWidth / 72), 1)));
  const last = rows.length - 1;
  const peak = rows.reduce((best, row, index) => (row.value > (rows[best]?.value ?? -1) ? index : best), 0);
  const point = active === null ? null : { ...rows[active], formatted: format(rows[active].value) };

  const pick = (clientX) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const index = Math.floor((clientX - box.left - pad.left) / band);
    setActive(Math.min(Math.max(index, 0), last));
  };
  const onKey = (event) => {
    if (!rows.length) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((value) => (value === null ? 0 : Math.min(value + 1, last))); }
    if (event.key === "ArrowLeft") { event.preventDefault(); setActive((value) => (value === null ? last : Math.max(value - 1, 0))); }
    if (event.key === "Escape") setActive(null);
  };
  const linePath = rows.map((row, index) => `${index ? "L" : "M"}${x(index)},${y(row.value)}`).join(" ");
  const areaPath = rows.length ? `${linePath} L${x(last)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const barPath = (index, value) => {
    const height0 = y(0) - y(value);
    if (height0 <= 0) return "";
    const r = Math.min(4, height0, barWidth / 2);
    const left = x(index) - barWidth / 2; const right = left + barWidth; const base = y(0); const tip = y(value);
    return `M${left},${base} L${left},${tip + r} Q${left},${tip} ${left + r},${tip} L${right - r},${tip} Q${right},${tip} ${right},${tip + r} L${right},${base} Z`;
  };

  return <div className="relative" ref={ref}>
    <p className="sr-only" id={descriptionId}>{label}. {language === "en" ? "Use the left and right arrow keys to read each value." : "Pakai tombol panah kiri dan kanan untuk membaca tiap nilai."}</p>
    {width > 0 && <svg className="block touch-pan-y outline-none focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kucur-green)]" width={width} height={height} style={{ width, height }} role="img" aria-label={label} aria-describedby={descriptionId} tabIndex={0}
      onPointerMove={(event) => pick(event.clientX)} onPointerDown={(event) => pick(event.clientX)} onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive(null); }} onKeyDown={onKey} onBlur={() => setActive(null)}>
      {ticks.map((tick) => <g key={tick}>
        <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
        <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[var(--kucur-text-muted)] text-[11px] tabular-nums">{compactNumber(tick, language)}</text>
      </g>)}
      {kind === "bar" && rows.map((row, index) => <path key={row.key} d={barPath(index, row.value)} fill="var(--chart-1)" opacity={active === null || active === index ? 1 : 0.45} />)}
      {kind === "line" && <>
        <path d={areaPath} fill="var(--chart-1)" opacity="0.1" />
        <path d={linePath} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={y(0)} stroke="var(--chart-axis)" strokeWidth="1" />}
        {rows.length > 0 && <circle cx={x(active ?? last)} cy={y(rows[active ?? last].value)} r="4.5" fill="var(--chart-1)" stroke="var(--kucur-surface)" strokeWidth="2" />}
        {rows.length > 0 && active === null && <text x={x(last) + 8} y={y(rows[last].value)} dy="0.32em" className="fill-[var(--kucur-text)] text-[12px] font-bold">{compactNumber(rows[last].value, language)}</text>}
      </>}
      {kind === "bar" && rows.length > 0 && rows[peak].value > 0 && active === null && <text x={x(peak)} y={y(rows[peak].value) - 6} textAnchor="middle" className="fill-[var(--kucur-text)] text-[11px] font-bold">{compactNumber(rows[peak].value, language)}</text>}
      {rows.map((row, index) => (index % labelEvery === 0 || index === last) && (index === last || last - index >= labelEvery * 0.6) && <text key={row.key} x={x(index)} y={height - 8} textAnchor="middle" className={`text-[11px] ${index === active ? "fill-[var(--kucur-text)] font-bold" : "fill-[var(--kucur-text-muted)]"}`}>{row.label}</text>)}
    </svg>}
    {point && <Tooltip point={point} left={x(active)} top={Math.max(y(point.value), pad.top + 18)} width={width} />}
  </div>;
}

export const ColumnChart = (props) => <TimeChart {...props} kind="bar" />;
export const LineChart = (props) => <TimeChart {...props} kind="line" />;

// Tren mini di kartu angka: garis 2px warna redup, titik terakhir warna utama.
export function Sparkline({ values = [], label }) {
  if (values.length < 2) return null;
  const max = Math.max(...values); const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 26 - ((value - min) / span) * 22]);
  const [lastX, lastY] = points.at(-1);
  // Titik akhir digambar sebagai elemen HTML supaya tetap bulat walau SVG direntangkan.
  return <div className="relative h-8 w-full" role="img" aria-label={label}>
    <svg className="absolute inset-0 overflow-visible" style={{ width: "100%", height: "100%" }} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.map(([px, py]) => `${px},${py}`).join(" ")} fill="none" stroke="var(--chart-muted)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-1)] ring-2 ring-[var(--kucur-surface)]" style={{ left: `${lastX}%`, top: `${(lastY / 30) * 100}%` }} />
  </div>;
}
