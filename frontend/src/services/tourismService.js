import { getOperationalSettings } from "../data/mockOperationalSettings";
import { getStores } from "../data/mockStores";
import { createNotification } from "./notificationService";

export const TOURISM_SERVICES_STORAGE_KEY = "kucur_tourism_services";
export const TOURISM_SCHEDULES_STORAGE_KEY = "kucur_tourism_schedules";
export const TOURISM_BOOKINGS_STORAGE_KEY = "kucur_tourism_bookings";
export const TOURISM_UPDATED_EVENT = "kucur-tourism-updated";

export const TOURISM_BOOKING_RESERVING_STATUSES = ["pending-approval", "approved"];
export const TOURISM_SCHEDULE_STATUSES = ["available", "closed", "cancelled"];
export const TOURISM_SCHEDULE_BLOCKING_STATUSES = ["available", "closed"];
export const TOURISM_CUSTOMER_CANCEL_CUTOFF_DAYS = 1;

export function calculateScheduleEndTime(startTime, durationMinutes) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(startTime ?? ""));
  const rawDuration = Number(durationMinutes);
  const duration = Math.ceil(rawDuration);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || !Number.isFinite(rawDuration) || rawDuration <= 0) return { endTime: "", crossesNextDay: false, valid: false };
  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + duration;
  const minutesInDay = 24 * 60;
  const normalized = totalMinutes % minutesInDay;
  return { endTime: `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`, crossesNextDay: totalMinutes >= minutesInDay, valid: true };
}

export const scheduleBlocksOverlap = (schedule) => TOURISM_SCHEDULE_BLOCKING_STATUSES.includes(schedule?.status);

export function findOverlappingSchedule({ storeId, date, startTime, endTime, excludeScheduleId = null }) {
  return getSchedulesByStoreId(storeId).find((schedule) => String(schedule.id) !== String(excludeScheduleId)
    && schedule.date === date
    && scheduleBlocksOverlap(schedule)
    && startTime < schedule.endTime
    && endTime > schedule.startTime) ?? null;
}

const seedServices = [{
  id: "TOUR-001", storeId: "2", merchantUserId: "USR-MERCHANT-001",
  name: "Wisata Kebun Jeruk", shortDescription: "Belajar budidaya jeruk langsung bersama petani Kucur.",
  description: "Pengunjung belajar menanam, merawat, dan memanen jeruk langsung bersama petani lokal.",
  pricePerPerson: 45000, durationMinutes: 180, minimumParticipants: 1,
  location: { locationId: null, label: "Titik temu di gerbang Kebun Jeruk Kucur", latitude: null, longitude: null },
  visitorInstructions: "Gunakan alas kaki yang nyaman dan hadir 15 menit sebelum sesi dimulai.",
  images: [], status: "active", createdAt: "2026-08-02T08:00:00+07:00", updatedAt: "2026-08-02T08:00:00+07:00",
}];

const seedSchedules = [
  { id: "TSCH-001", tourismId: "TOUR-001", storeId: "2", date: "2026-08-22", startTime: "08:00", endTime: "11:00", capacity: 40, status: "available", createdAt: "2026-08-18T08:00:00+07:00", updatedAt: "2026-08-18T08:00:00+07:00", statusHistory: [] },
  { id: "TSCH-002", tourismId: "TOUR-001", storeId: "2", date: "2026-08-23", startTime: "13:00", endTime: "16:00", capacity: 30, status: "available", createdAt: "2026-08-18T08:00:00+07:00", updatedAt: "2026-08-18T08:00:00+07:00", statusHistory: [] },
];

function readList(key, seeds = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch { return []; }
  localStorage.setItem(key, JSON.stringify(seeds));
  return [...seeds];
}

function saveList(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(TOURISM_UPDATED_EVENT, { detail: { key } }));
  return rows;
}

export const getTourismServices = () => readList(TOURISM_SERVICES_STORAGE_KEY, seedServices);
export const getTourismByStoreId = (storeId) => getTourismServices().filter((item) => String(item.storeId) === String(storeId));
export const getTourismService = (tourismId, storeId) => getTourismByStoreId(storeId).find((item) => String(item.id) === String(tourismId)) ?? null;

export function createTourismInfo(values) {
  const now = new Date().toISOString();
  const tourism = { id: `TOUR-${crypto.randomUUID()}`, ...values, storeId: String(values.storeId), createdAt: now, updatedAt: now };
  saveList(TOURISM_SERVICES_STORAGE_KEY, [...getTourismServices(), tourism]);
  return tourism;
}

export function updateTourismInfo(tourismId, storeId, changes) {
  let updated = null;
  const rows = getTourismServices().map((item) => {
    if (String(item.id) !== String(tourismId) || String(item.storeId) !== String(storeId)) return item;
    updated = { ...item, ...changes, storeId: String(storeId), updatedAt: new Date().toISOString() };
    return updated;
  });
  if (updated) saveList(TOURISM_SERVICES_STORAGE_KEY, rows);
  return updated;
}

export const getTourismSchedules = () => readList(TOURISM_SCHEDULES_STORAGE_KEY, seedSchedules);
export const getSchedulesByStoreId = (storeId, tourismId) => getTourismSchedules().filter((item) => String(item.storeId) === String(storeId) && (!tourismId || String(item.tourismId) === String(tourismId)));
export const getTourismBookings = () => readList(TOURISM_BOOKINGS_STORAGE_KEY, []);
export const getTourismBookingsByStore = (storeId) => getTourismBookings().filter((booking) => String(booking.storeId) === String(storeId));
export const getCustomerTourismBookings = (customerId) => getTourismBookings().filter((booking) => String(booking.customerId) === String(customerId));
export const getTourismBooking = (bookingId) => getTourismBookings().find((booking) => String(booking.id) === String(bookingId)) ?? null;

export function getReservedCapacity(scheduleId) {
  return getTourismBookings().filter((booking) => String(booking.scheduleId) === String(scheduleId)
    && TOURISM_BOOKING_RESERVING_STATUSES.includes(booking.status))
    .reduce((sum, booking) => sum + Math.max(0, Number(booking.participantCount) || 0), 0);
}

export function getRemainingCapacity(schedule) {
  return Math.max(0, Number(schedule?.capacity || 0) - getReservedCapacity(schedule?.id));
}

export function isTourismScheduleBookable(schedule, now = new Date()) {
  if (!schedule || schedule.status !== "available") return false;
  const startAt = new Date(`${schedule.date}T${schedule.startTime}`);
  return Number.isFinite(startAt.getTime()) && startAt > now && getRemainingCapacity(schedule) > 0;
}

export function formatApprovalCountdown(deadline, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function appendBookingTransition(booking, status, actor, reason = null, timestamp = new Date().toISOString()) {
  return { ...booking, status, updatedAt: timestamp, rejectionReason: status === "rejected" ? reason : booking.rejectionReason,
    cancellationReason: status === "cancelled" ? reason : booking.cancellationReason,
    completedAt: status === "completed" ? (booking.completedAt ?? timestamp) : booking.completedAt,
    statusHistory: [...(booking.statusHistory ?? []), { from: booking.status, to: status, actorId: actor?.id ?? null, actorName: actor?.name ?? "System", actorRole: actor?.role ?? "system", reason, timestamp }] };
}

export function createTourismBooking({ tourismId, scheduleId, participantCount, customer }) {
  const tourism = getTourismServices().find((item) => String(item.id) === String(tourismId) && item.status === "active");
  if (!tourism) return { booking: null, error: "Wisata tidak tersedia untuk dipesan." };
  const schedule = getTourismSchedules().find((item) => String(item.id) === String(scheduleId) && String(item.tourismId) === String(tourismId));
  const now = new Date();
  if (!schedule || !isTourismScheduleBookable(schedule, now)) return { booking: null, error: "Jadwal tidak lagi tersedia." };
  const count = Number(participantCount);
  const remaining = getRemainingCapacity(schedule);
  if (!Number.isInteger(count) || count < Math.max(1, Number(tourism.minimumParticipants || 1))) return { booking: null, error: `Jumlah peserta minimal ${Math.max(1, Number(tourism.minimumParticipants || 1))} orang.` };
  if (count > remaining) return { booking: null, error: `Slot yang tersedia telah berubah. Saat ini tersisa ${remaining} peserta.` };
  const duplicate = getTourismBookings().find((item) => String(item.customerId) === String(customer.id)
    && String(item.scheduleId) === String(schedule.id)
    && TOURISM_BOOKING_RESERVING_STATUSES.includes(item.status));
  if (duplicate) return { booking: null, error: `Anda sudah memiliki booking aktif ${duplicate.bookingNumber} untuk jadwal ini.` };
  const store = getStores().find((item) => String(item.id) === String(tourism.storeId));
  const createdAt = now.toISOString();
  const timeoutHours = getOperationalSettings().tourismApprovalTimeoutHours;
  const id = `TB-${crypto.randomUUID()}`;
  const booking = { id, bookingNumber: `WST-${Date.now().toString(36).toUpperCase()}`, type: "educational-tourism",
    customerId: customer.id, customerName: customer.fullName, customerPhone: customer.phone,
    storeId: String(tourism.storeId), storeName: store?.name ?? tourism.name, merchantUserId: tourism.merchantUserId,
    tourismId: tourism.id, tourismName: tourism.name, scheduleId: schedule.id, scheduleDate: schedule.date,
    startTime: schedule.startTime, endTime: schedule.endTime, durationMinutes: Number(tourism.durationMinutes),
    meetingPoint: tourism.location?.label ?? "", visitorInstructions: tourism.visitorInstructions ?? "", participantCount: count,
    pricePerPerson: Number(tourism.pricePerPerson), totalAmount: Number(tourism.pricePerPerson) * count,
    status: "pending-approval", approvalDeadlineAt: new Date(now.getTime() + timeoutHours * 3600000).toISOString(),
    createdAt, updatedAt: createdAt, completedAt: null, statusHistory: [{ from: null, to: "pending-approval", actorId: customer.id, actorName: customer.fullName, actorRole: "customer", reason: null, timestamp: createdAt }] };
  saveList(TOURISM_BOOKINGS_STORAGE_KEY, [...getTourismBookings(), booking]);
  createNotification({ recipientUserId: booking.merchantUserId, recipientRole: "merchant", type: "booking", title: "Booking wisata baru", message: "Booking wisata baru menunggu persetujuan.", link: `/merchant/stores/${booking.storeId}/tourism/bookings/${booking.id}` });
  createNotification({ recipientUserId: booking.customerId, recipientRole: "customer", type: "booking", title: "Booking wisata dibuat", message: `${booking.bookingNumber} sedang menunggu persetujuan merchant.`, link: `/tourism-bookings/${booking.id}`, id: `NTF-TOUR-CREATED-${booking.id}` });
  return { booking, error: "" };
}

export function transitionTourismBooking(bookingId, nextStatus, actor, reason = null) {
  const current = getTourismBooking(bookingId);
  if (!current) return { booking: null, error: "Booking tidak ditemukan." };
  if (actor?.role === "merchant" && String(current.merchantUserId) !== String(actor.id)) return { booking: null, error: "Anda tidak berwenang mengubah booking lapak lain." };
  const allowed = { "pending-approval": ["approved", "rejected", "cancelled"], approved: ["cancelled", "completed"] };
  if (!allowed[current.status]?.includes(nextStatus)) return { booking: null, error: "Perubahan status booking tidak valid." };
  if (nextStatus === "rejected" && !reason?.trim()) return { booking: null, error: "Alasan penolakan wajib diisi." };
  if (nextStatus === "cancelled" && !reason?.trim()) return { booking: null, error: "Alasan pembatalan wajib diisi." };
  if (nextStatus === "approved") {
    const schedule = getTourismSchedules().find((item) => String(item.id) === String(current.scheduleId));
    if (!schedule || schedule.status !== "available") return { booking: null, error: "Booking tidak dapat disetujui karena jadwal tidak lagi aktif." };
    if (getReservedCapacity(current.scheduleId) > Number(schedule.capacity)) return { booking: null, error: "Booking tidak dapat disetujui karena kapasitas jadwal telah berubah." };
  }
  if (nextStatus === "completed" && new Date(`${current.scheduleDate}T${current.endTime}`) > new Date()) return { booking: null, error: "Booking hanya dapat diselesaikan setelah kegiatan berakhir." };
  const updated = appendBookingTransition(current, nextStatus, actor, reason?.trim() || null);
  saveList(TOURISM_BOOKINGS_STORAGE_KEY, getTourismBookings().map((item) => item.id === bookingId ? updated : item));
  const notices = { approved: ["Booking wisata disetujui", "Booking wisata Anda telah disetujui."], rejected: ["Booking wisata ditolak", "Booking wisata Anda ditolak."], completed: ["Kegiatan wisata selesai", "Kegiatan wisata selesai. Anda dapat memberikan ulasan."] };
  if (notices[nextStatus]) createNotification({ recipientUserId: current.customerId, recipientRole: "customer", type: nextStatus === "completed" ? "review" : "booking", title: notices[nextStatus][0], message: notices[nextStatus][1], link: `/tourism-bookings/${current.id}` });
  return { booking: updated, error: "" };
}

export function cancelCustomerTourismBooking(bookingId, customer, reason) {
  const booking = getTourismBooking(bookingId);
  if (!booking || String(booking.customerId) !== String(customer.id)) return { booking: null, error: "Booking tidak ditemukan." };
  const cutoff = new Date(`${booking.scheduleDate}T${booking.startTime}`).getTime() - TOURISM_CUSTOMER_CANCEL_CUTOFF_DAYS * 86400000;
  if (!["pending-approval", "approved"].includes(booking.status)) return { booking: null, error: "Booking ini tidak dapat dibatalkan lagi." };
  if (Date.now() > cutoff) return { booking: null, error: "Booking hanya dapat dibatalkan paling lambat H-1." };
  const result = transitionTourismBooking(bookingId, "cancelled", { id: customer.id, name: customer.fullName, role: "customer" }, reason);
  if (result.booking) createNotification({ recipientUserId: booking.merchantUserId, recipientRole: "merchant", type: "booking", title: "Booking wisata dibatalkan", message: `${booking.bookingNumber} dibatalkan customer.`, link: `/merchant/stores/${booking.storeId}/tourism/bookings/${booking.id}` });
  if (result.booking) createNotification({ recipientUserId: booking.customerId, recipientRole: "customer", type: "booking", title: "Booking wisata dibatalkan", message: `${booking.bookingNumber} telah dibatalkan.`, link: `/tourism-bookings/${booking.id}`, id: `NTF-TOUR-CANCELLED-${booking.id}` });
  return result;
}

export function evaluateTourismApprovalTimeouts(now = Date.now()) {
  let changed = false;
  const approved = [];
  const rows = getTourismBookings().map((booking) => {
    if (booking.status !== "pending-approval" || new Date(booking.approvalDeadlineAt).getTime() > now) return booking;
    changed = true;
    const updated = appendBookingTransition(booking, "approved", { id: "system", name: "System", role: "system" }, "Batas waktu persetujuan merchant berakhir", new Date(now).toISOString());
    approved.push(updated); return updated;
  });
  if (changed) saveList(TOURISM_BOOKINGS_STORAGE_KEY, rows);
  approved.forEach((booking) => createNotification({ recipientUserId: booking.customerId, recipientRole: "customer", type: "booking", title: "Booking wisata disetujui otomatis", message: "Booking wisata Anda telah dikonfirmasi otomatis.", link: `/tourism-bookings/${booking.id}`, id: `NTF-TOUR-AUTO-${booking.id}` }));
  return rows;
}

let timeoutMonitor = null;
let timeoutMonitorSubscribers = 0;

export function subscribeTourismApprovalTimeoutMonitor() {
  timeoutMonitorSubscribers += 1;
  evaluateTourismApprovalTimeouts();
  if (!timeoutMonitor) timeoutMonitor = window.setInterval(() => evaluateTourismApprovalTimeouts(), 30000);
  return () => {
    timeoutMonitorSubscribers = Math.max(0, timeoutMonitorSubscribers - 1);
    if (!timeoutMonitorSubscribers && timeoutMonitor) {
      window.clearInterval(timeoutMonitor);
      timeoutMonitor = null;
    }
  };
}

function validateSchedule(values, existing = null) {
  const parsedDate = new Date(`${values.date}T00:00:00`);
  const normalizedDate = Number.isFinite(parsedDate.getTime())
    ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}` : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || normalizedDate !== values.date) return { error: "Tanggal jadwal tidak valid.", endTime: "" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!existing && new Date(`${values.date}T00:00:00`) < today) return { error: "Jadwal baru tidak boleh menggunakan tanggal yang sudah lewat.", endTime: "" };
  if (!values.startTime) return { error: "Waktu mulai wajib diisi.", endTime: "" };
  const tourism = getTourismService(values.tourismId, values.storeId);
  if (!tourism || !(Number(tourism.durationMinutes) > 0)) return { error: "Atur durasi kegiatan pada Informasi Wisata terlebih dahulu.", endTime: "" };
  const timing = calculateScheduleEndTime(values.startTime, tourism.durationMinutes);
  if (!timing.valid) return { error: "Waktu mulai atau durasi kegiatan tidak valid.", endTime: "" };
  if (timing.crossesNextDay) return { error: "Jadwal melewati pergantian hari. Pilih jam mulai yang lebih awal.", endTime: timing.endTime };
  if (!Number.isFinite(Number(values.capacity)) || Number(values.capacity) <= 0) return { error: "Kapasitas harus lebih besar dari 0.", endTime: timing.endTime };
  const reserved = existing ? getReservedCapacity(existing.id) : 0;
  if (Number(values.capacity) < reserved) return { error: `Kapasitas tidak dapat lebih kecil dari ${reserved} peserta yang sudah terdaftar.`, endTime: timing.endTime };
  const overlap = scheduleBlocksOverlap({ status: values.status ?? "available" })
    ? findOverlappingSchedule({ storeId: values.storeId, date: values.date, startTime: values.startTime, endTime: timing.endTime, excludeScheduleId: existing?.id })
    : null;
  if (overlap) return { error: `Jadwal bertabrakan dengan sesi ${overlap.startTime}–${overlap.endTime}. Pilih jam mulai lain.`, endTime: timing.endTime };
  return { error: "", endTime: timing.endTime };
}

export function createSchedule(values) {
  const { error, endTime } = validateSchedule(values);
  if (error) return { schedule: null, error };
  const now = new Date().toISOString();
  const schedule = { id: `TSCH-${crypto.randomUUID()}`, ...values, endTime, storeId: String(values.storeId), capacity: Number(values.capacity), status: "available", cancellationReason: null, cancelledAt: null, cancelledBy: null, createdAt: now, updatedAt: now, statusHistory: [] };
  saveList(TOURISM_SCHEDULES_STORAGE_KEY, [...getTourismSchedules(), schedule]);
  return { schedule, error: "" };
}

export function updateSchedule(scheduleId, storeId, changes, actor) {
  const existing = getSchedulesByStoreId(storeId).find((item) => String(item.id) === String(scheduleId));
  if (!existing) return { schedule: null, error: "Jadwal tidak ditemukan." };
  const next = { ...existing, ...changes };
  const changesScheduleDefinition = ["date", "startTime", "capacity", "tourismId"].some((key) => Object.hasOwn(changes, key));
  const { error, endTime } = changesScheduleDefinition ? validateSchedule(next, existing) : { error: "", endTime: existing.endTime };
  if (error) return { schedule: null, error };
  const now = new Date().toISOString();
  const statusChanged = changes.status && changes.status !== existing.status;
  const updated = { ...next, endTime, capacity: Number(next.capacity), updatedAt: now, statusHistory: statusChanged ? [...(existing.statusHistory ?? []), { from: existing.status, to: changes.status, actorId: actor?.id, actorName: actor?.name, actorRole: "merchant", reason: changes.reason ?? null, timestamp: now }] : existing.statusHistory ?? [] };
  saveList(TOURISM_SCHEDULES_STORAGE_KEY, getTourismSchedules().map((item) => item.id === scheduleId ? updated : item));
  return { schedule: updated, error: "" };
}

export function cancelSchedule(scheduleId, storeId, reason, actor) {
  if (!reason?.trim()) return { schedule: null, error: "Alasan pembatalan wajib diisi." };
  const now = new Date().toISOString();
  return updateSchedule(scheduleId, storeId, { status: "cancelled", reason: reason.trim(), cancellationReason: reason.trim(), cancelledAt: now, cancelledBy: { id: actor?.id, name: actor?.name, role: "merchant" } }, actor);
}

export function getTourismScheduleMetrics(storeId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = getSchedulesByStoreId(storeId).filter((schedule) => schedule.status === "available" && new Date(`${schedule.date}T00:00:00`) >= today);
  return { activeSchedules: upcoming.length, availableSlots: upcoming.reduce((sum, schedule) => sum + getRemainingCapacity(schedule), 0) };
}

export function getTourismBookingMetrics(storeId) {
  evaluateTourismApprovalTimeouts();
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const bookings = getTourismBookingsByStore(storeId);
  const completed = bookings.filter((booking) => booking.status === "completed");
  const todayBookings = bookings.filter((booking) => booking.scheduleDate === localToday && !["rejected","cancelled"].includes(booking.status));
  return {
    activeBookings: bookings.filter((booking) => TOURISM_BOOKING_RESERVING_STATUSES.includes(booking.status)).length,
    bookingsToday: todayBookings.length,
    waitingApproval: bookings.filter((booking) => booking.status === "pending-approval").length,
    visitorsToday: todayBookings.reduce((sum, booking) => sum + Number(booking.participantCount || 0), 0),
    approvedBookings: bookings.filter((booking) => booking.status === "approved").length,
    completedBookings: completed.length,
    scheduledParticipants: bookings.filter((booking) => TOURISM_BOOKING_RESERVING_STATUSES.includes(booking.status)).reduce((sum, booking) => sum + Number(booking.participantCount || 0), 0),
    revenue: completed.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0),
  };
}
