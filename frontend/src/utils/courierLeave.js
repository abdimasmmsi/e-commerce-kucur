// Status tampilan cuti kurir: "approved" dibagi jadi akan datang, sedang cuti, dan selesai.
export function leavePhase(row, now = new Date()) {
  if (row.status !== "approved") return row.status;
  if (row.endAt && new Date(row.endAt) <= now) return "done";
  return new Date(row.startAt) <= now ? "running" : "approved";
}

// Nilai input datetime-local (YYYY-MM-DDTHH:mm) dalam waktu lokal perangkat.
export function toLocalInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Pesan validasi spesifik dari backend (mis. "Tanggal mulai cuti tidak boleh sebelum waktu sekarang.").
export function leaveErrorText(error) {
  if (error?.code === "VALIDATION_ERROR" && error.details && typeof error.details === "object") return Object.values(error.details).find((value) => typeof value === "string") || error.message;
  return error?.message;
}
