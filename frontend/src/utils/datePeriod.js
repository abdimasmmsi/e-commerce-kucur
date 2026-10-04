export const DATE_PERIODS = [
  ["today", "Hari Ini"],
  ["7d", "7 Hari"],
  ["1m", "1 Bulan"],
  ["1y", "1 Tahun"],
  ["custom", "Custom"],
];

export const isValidPeriod = (value) => DATE_PERIODS.some(([period]) => period === value);

export function toLocalDateInput(date) {
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

export function getPeriodRange(period = "today", start = "", end = "", now = new Date()) {
  const rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  if (period === "7d") rangeStart.setDate(rangeStart.getDate() - 6);
  if (period === "1m") rangeStart.setMonth(rangeStart.getMonth() - 1);
  if (period === "1y") rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  if (period === "custom") {
    if (!start || !end || start > end) return null;
    const customStart = new Date(`${start}T00:00:00`);
    const customEnd = new Date(`${end}T23:59:59.999`);
    return { from: customStart, to: customEnd };
  }
  return { from: rangeStart, to: rangeEnd };
}

export function filterByPeriod(items, dateSelector, period, start, end) {
  const range = getPeriodRange(period, start, end);
  if (!range) return [];
  return items.filter((item) => {
    const date = new Date(dateSelector(item));
    return Number.isFinite(date.getTime()) && date >= range.from && date <= range.to;
  });
}

export function periodQuery(period, start, end) {
  const params = new URLSearchParams({ period });
  if (period === "custom" && start && end && start <= end) {
    params.set("start", start);
    params.set("end", end);
  }
  return params;
}
