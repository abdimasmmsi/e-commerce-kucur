// Tanggal hari ini di zona Asia/Jakarta (YYYY-MM-DD), dipakai draf batch pengiriman.
export function jakartaToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
