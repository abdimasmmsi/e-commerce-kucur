import { useEffect, useId, useRef, useState } from "react";
import { compactNumber, niceTicks } from "../../utils/analytics";

// Grafik analitik admin (SVG buatan sendiri, tanpa library). Aturan visual:
// batang <= 24px dengan ujung membulat 4px, garis 2px, garis bantu tipis, angka sumbu dibulatkan,
// tooltip saat hover/sentuh/fokus keyboard (panah kiri/kanan), dan semua angka juga ada di tampilan Tabel.

// Lebar elemen (ResizeObserver) supaya teks sumbu tidak ikut melar seperti pada viewBox "none".
function useBox() {
  const ref = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, box];
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

// Kurva halus monoton (Fritsch–Carlson): mulus seperti grafik aplikasi keuangan, tapi tidak pernah melewati nilai data.
function smoothPath(points) {
  const n = points.length;
  if (!n) return "";
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx = []; const slope = [];
  for (let i = 0; i < n - 1; i += 1) { dx[i] = points[i + 1][0] - points[i][0]; slope[i] = (points[i + 1][1] - points[i][1]) / (dx[i] || 1); }
  const tangent = new Array(n);
  tangent[0] = slope[0]; tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
    const a = tangent[i] / slope[i]; const b = tangent[i + 1] / slope[i]; const sum = a * a + b * b;
    if (sum > 9) { const tau = 3 / Math.sqrt(sum); tangent[i] = tau * a * slope[i]; tangent[i + 1] = tau * b * slope[i]; }
  }
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]; const [x1, y1] = points[i + 1];
    path += ` C${x0 + dx[i] / 3},${y0 + (tangent[i] * dx[i]) / 3} ${x1 - dx[i] / 3},${y1 - (tangent[i + 1] * dx[i]) / 3} ${x1},${y1}`;
  }
  return path;
}

// Kerangka bersama grafik waktu (batang atau garis): sumbu Y, garis bantu, label X, nilai, interaksi.
// Nilai tampil tanpa hover: semua batang/titik diberi angka kalau muat, kalau tidak hanya tertinggi & terakhir.
// Periode tanpa data (null, mis. rata-rata rating di minggu tanpa ulasan) tidak digambar sebagai 0.
function TimeChart({ rows, format, short, language, label, kind, maxHint, seriesLabel, height: heightProp = 220 }) {
  let height = heightProp;
  const [ref, box] = useBox();
  const { width } = box;
  // Tinggi grafik = tinggi minimal pilihan widget, atau lebih bila kartu diregangkan mengikuti widget di sebelahnya.
  const minHeight = heightProp;
  height = Math.max(minHeight, box.height);
  const [active, setActive] = useState(null);
  const descriptionId = useId();
  const gradientId = `${useId().replace(/:/g, "")}-fill`;
  const pad = { top: 22, right: kind === "line" ? 20 : 12, bottom: 26, left: 52 };
  const values = rows.map((row) => row.value);
  const present = values.filter((value) => value !== null && value !== undefined);
  const max = Math.max(...present, 0);
  const ticks = maxHint && max <= maxHint ? niceTicks(maxHint, maxHint <= 5 ? 5 : 4).filter((tick) => tick <= maxHint) : niceTicks(max);
  const top = ticks.at(-1) || 1;
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;
  const band = plotWidth / Math.max(rows.length, 1);
  const x = (index) => pad.left + band * index + band / 2;
  const y = (value) => pad.top + plotHeight - (value / top) * plotHeight;
  const barWidth = Math.max(Math.min(24, band * 0.68), 2);
  // Jarak label sumbu X mengikuti panjang teks label (perkiraan 6,2px per huruf) supaya tidak bertumpuk.
  const labelWidth = Math.max(...rows.map((row) => String(row.label).length), 4) * 6.2 + 14;
  const labelEvery = Math.max(1, Math.ceil(labelWidth / Math.max(band, 1)));
  const last = rows.length - 1;
  const lastPresent = values.findLastIndex((value) => value !== null && value !== undefined);
  const peak = values.reduce((best, value, index) => (value !== null && value > (values[best] ?? -Infinity) ? index : best), lastPresent);
  // Semua nilai diberi label kalau tiap kolom cukup lebar (>= 34px); kalau tidak, hanya tertinggi & terakhir.
  const labelAll = band >= 34;
  const valueLabels = rows.map((row, index) => (row.value !== null && row.value !== undefined && row.value > 0 && (labelAll || index === peak || index === lastPresent)));
  const point = active === null || rows[active]?.value === null || rows[active]?.value === undefined ? (active === null ? null : { label: rows[active].label, formatted: "–" }) : { ...rows[active], formatted: format(rows[active].value) };

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
  // Garis terputus di periode kosong; area hanya di bawah segmen yang ada datanya.
  const segments = [];
  rows.forEach((row, index) => { if (row.value === null || row.value === undefined) return; const previous = segments.at(-1); if (previous && previous.at(-1) === index - 1) previous.push(index); else segments.push([index]); });
  const segmentPath = (segment) => smoothPath(segment.map((index) => [x(index), y(rows[index].value)]));
  const barPath = (index, value) => {
    const height0 = y(0) - y(value);
    if (!(height0 > 0)) return "";
    const r = Math.min(4, height0, barWidth / 2);
    const left = x(index) - barWidth / 2; const right = left + barWidth; const base = y(0); const tip = y(value);
    return `M${left},${base} L${left},${tip + r} Q${left},${tip} ${left + r},${tip} L${right - r},${tip} Q${right},${tip} ${right},${tip + r} L${right},${base} Z`;
  };
  const showDots = kind === "line" && band >= 20;

  return <div className="flex flex-1 flex-col">
    <div className="relative flex-1" style={{ minHeight }} ref={ref}>
    <p className="sr-only" id={descriptionId}>{label}. {language === "en" ? "Use the left and right arrow keys to read each value." : "Pakai tombol panah kiri dan kanan untuk membaca tiap nilai."}</p>
    {width > 0 && <svg className="absolute left-0 top-0 block touch-pan-y outline-none focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kucur-green)]" width={width} height={height} style={{ width, height }} role="img" aria-label={label} aria-describedby={descriptionId} tabIndex={0}
      onPointerMove={(event) => pick(event.clientX)} onPointerDown={(event) => pick(event.clientX)} onPointerLeave={(event) => { if (event.pointerType === "mouse") setActive(null); }} onKeyDown={onKey} onBlur={() => setActive(null)}>
      {ticks.map((tick) => <g key={tick}>
        <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
        <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[var(--kucur-text-muted)] text-[11px] tabular-nums">{compactNumber(tick, language)}</text>
      </g>)}
      {active !== null && <rect x={x(active) - band / 2} y={pad.top} width={band} height={plotHeight} fill="var(--kucur-surface-elevated)" opacity="0.7" />}
      {kind === "bar" && rows.map((row, index) => row.value !== null && row.value !== undefined && <path key={row.key} d={barPath(index, row.value)} fill="var(--chart-1)" />)}
      {kind === "line" && <>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" /></linearGradient></defs>
        {segments.map((segment) => segment.length > 1 && <path key={`area-${segment[0]}`} d={`${segmentPath(segment)} L${x(segment.at(-1))},${y(0)} L${x(segment[0])},${y(0)} Z`} fill={`url(#${gradientId})`} />)}
        {segments.map((segment) => <path key={`line-${segment[0]}`} d={segmentPath(segment)} fill="none" stroke="var(--chart-1)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
        {rows.map((row, index) => row.value !== null && row.value !== undefined && (showDots || index === peak || index === lastPresent || segments.some((segment) => segment.length === 1 && segment[0] === index)) && <circle key={row.key} cx={x(index)} cy={y(row.value)} r={index === active ? 6 : index === peak || index === lastPresent ? 5 : 4} fill="var(--chart-1)" stroke="var(--kucur-surface)" strokeWidth="2" />)}
      </>}
      {rows.map((row, index) => valueLabels[index] && <text key={`v-${row.key}`} x={x(index)} y={y(row.value) - 8} textAnchor="middle" className={`text-[11px] tabular-nums ${index === active ? "fill-[var(--kucur-text)] font-extrabold" : index === peak || index === lastPresent ? "fill-[var(--kucur-text)] font-bold" : "fill-[var(--kucur-text-muted)] font-semibold"}`}>{short(row.value)}</text>)}
      {rows.map((row, index) => (index % labelEvery === 0 || index === last) && (index === last || x(last) - x(index) >= labelWidth * (x(last) + labelWidth / 2 > width ? 1.5 : 1)) && <text key={row.key} x={index === last ? Math.min(x(index), width - 2) : index === 0 ? Math.max(x(index), 2) : x(index)} y={height - 8} textAnchor={index === last && x(index) + labelWidth / 2 > width ? "end" : index === 0 && x(index) - labelWidth / 2 < 0 ? "start" : "middle"} className={`text-[11px] ${index === active ? "fill-[var(--kucur-text)] font-bold" : "fill-[var(--kucur-text-muted)]"}`}>{row.label}</text>)}
    </svg>}
    {point && <Tooltip point={point} left={x(active)} top={Math.max(y(rows[active].value ?? 0), pad.top + 18)} width={width} />}
    </div>
    {seriesLabel && <div className="mt-1.5 flex items-center justify-center gap-2 text-[13px] text-[var(--kucur-text-muted)]"><span className="size-2.5 rounded-full bg-[var(--chart-1)]" aria-hidden="true" />{seriesLabel}</div>}
  </div>;
}

export const ColumnChart = (props) => <TimeChart {...props} kind="bar" />;
export const LineChart = (props) => <TimeChart {...props} kind="line" />;

// Tren mini di kartu angka: garis 2px warna redup, titik terakhir warna utama.
export function Sparkline({ values = [], label }) {
  const gradientId = `${useId().replace(/:/g, "")}-spark`;
  if (values.length < 2) return null;
  const max = Math.max(...values); const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 25 - ((value - min) / span) * 21]);
  const [lastX, lastY] = points.at(-1);
  const line = smoothPath(points);
  // Titik akhir digambar sebagai elemen HTML supaya tetap bulat walau SVG direntangkan.
  return <div className="relative h-9 w-full" role="img" aria-label={label}>
    <svg className="absolute inset-0 overflow-visible" style={{ width: "100%", height: "100%" }} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L100,30 L0,30 Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-1)] ring-2 ring-[var(--kucur-surface)]" style={{ left: `${lastX}%`, top: `${(lastY / 30) * 100}%` }} />
  </div>;
}
