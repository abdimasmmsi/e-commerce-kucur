export const UNCOMPLETED_STATUS_FILTER = "uncompleted";

const normalizeStatus = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");

export function matchesStatusFilter(value, filter, terminalStatuses = ["completed", "cancelled"]) {
  const normalizedFilter = normalizeStatus(filter);
  if (!normalizedFilter || normalizedFilter === "all") return true;
  const normalizedValue = normalizeStatus(value);
  if (normalizedFilter === UNCOMPLETED_STATUS_FILTER) {
    const terminal = new Set(terminalStatuses.map(normalizeStatus));
    return !terminal.has(normalizedValue);
  }
  return normalizedValue === normalizedFilter;
}
