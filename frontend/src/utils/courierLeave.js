// Status tampilan cuti kurir: "approved" dibagi jadi akan datang, sedang cuti, dan selesai.
export function leavePhase(row, now = new Date()) {
  if (row.status !== "approved") return row.status;
  if (row.endAt && new Date(row.endAt) <= now) return "done";
  return new Date(row.startAt) <= now ? "running" : "approved";
}
