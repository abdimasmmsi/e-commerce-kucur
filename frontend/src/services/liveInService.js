import { getStores, isStoreType, normalizeStoreStatus } from "../data/mockStores";
import { createNotification } from "./notificationService";
import { normalizeLocation } from "../utils/location";

export const LIVEIN_SERVICES_KEY = "kucur_livein_services";
export const LIVEIN_ROOMS_KEY = "kucur_livein_rooms";
export const LIVEIN_BOOKINGS_KEY = "kucur_livein_bookings";
export const LIVEIN_UPDATED_EVENT = "kucur-livein-updated";
export const LIVEIN_BLOCKING_STATUSES = ["pending", "approved", "checked-in"];
export const LIVEIN_CUSTOMER_CANCEL_CUTOFF_DAYS = 3;
export const LIVEIN_TERMINAL_STATUSES = ["rejected", "cancelled", "completed", "no-show"];
const bookingLocks = new Set();

const read = (key) => {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const save = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(LIVEIN_UPDATED_EVENT));
  return value;
};
const now = () => new Date().toISOString();
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateParts = (value) => String(value ?? "").split("-").map(Number);
const dayNumber = (value) => {
  const [year, month, day] = dateParts(value);
  return year && month && day ? Math.floor(Date.UTC(year, month - 1, day) / 86400000) : Number.NaN;
};

function ensureSeed() {
  const stores = getStores().filter((store) => isStoreType(store, "live-in"));
  let services = read(LIVEIN_SERVICES_KEY);
  let rooms = read(LIVEIN_ROOMS_KEY);
  let changed = false;
  services = services.map((service) => {
    const ownerStore = stores.find((store) => String(store.id) === String(service.storeId));
    const normalizedStatus = normalizeStoreStatus(service.status ?? "active");
    const canonicalMerchantUserId = ownerStore?.merchantUserId ?? service.merchantUserId ?? null;
    const canonicalLocation = normalizeLocation(service.location, { label: ownerStore?.name ?? service.name, address: ownerStore?.address });
    const needsMigration = String(service.merchantUserId ?? "") !== String(canonicalMerchantUserId ?? "")
      || normalizedStatus !== service.status
      || !Array.isArray(service.images)
      || !Array.isArray(service.facilities)
      || JSON.stringify(service.location) !== JSON.stringify(canonicalLocation);
    if (!needsMigration) return service;
    changed = true;
    return { ...service, merchantUserId: canonicalMerchantUserId, status: normalizedStatus, location: canonicalLocation, images: Array.isArray(service.images) ? service.images : [], facilities: Array.isArray(service.facilities) ? service.facilities : [] };
  });
  stores.forEach((store) => {
    if (!services.some((item) => String(item.storeId) === String(store.id))) {
      services.push({ id: `LIVEIN-${store.id}`, storeId: store.id, merchantUserId: store.merchantUserId, name: store.name, shortDescription: store.description, description: store.description, houseRules: "Jaga kebersihan, ketenangan, dan hormati keluarga tuan rumah.", checkInTime: "14:00", checkOutTime: "11:00", facilities: ["Wi-Fi", "Dapur bersama", "Ruang keluarga", "Area parkir"], contactName: "Budi Santoso", contactPhone: store.phone, location: normalizeLocation(store.location, { label: store.name, address: store.address, lat: store.coordinates?.lat, lng: store.coordinates?.lng }), images: [], status: "active", createdAt: store.createdAt ?? now(), updatedAt: now() });
      changed = true;
    }
    if (String(store.id) === "3" && !rooms.some((item) => String(item.storeId) === String(store.id))) {
      rooms.push(
        { id: `ROOM-${store.id}-001`, storeId: store.id, name: "Kamar Depan", description: "Kamar nyaman dekat ruang keluarga.", capacity: 2, pricePerNight: 175000, facilities: ["Kasur", "Kipas Angin", "Lemari"], images: [], status: "active", createdAt: now(), updatedAt: now() },
        { id: `ROOM-${store.id}-002`, storeId: store.id, name: "Kamar Keluarga", description: "Kamar luas untuk keluarga atau kelompok kecil.", capacity: 4, pricePerNight: 225000, facilities: ["Kasur", "Kipas Angin", "Lemari", "Kamar Mandi"], images: [], status: "active", createdAt: now(), updatedAt: now() },
      );
      changed = true;
    }
  });
  if (changed) { save(LIVEIN_SERVICES_KEY, services); save(LIVEIN_ROOMS_KEY, rooms); }
}

export function calculateNights(checkIn, checkOut) {
  const start = dayNumber(checkIn); const end = dayNumber(checkOut);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0;
}
export function bookingIntervalsOverlap(checkInA, checkOutA, checkInB, checkOutB) {
  return calculateNights(checkInA, checkOutA) > 0 && calculateNights(checkInB, checkOutB) > 0 && checkInA < checkOutB && checkOutA > checkInB;
}
export const isLiveInBlockingStatus = (status) => LIVEIN_BLOCKING_STATUSES.includes(status);
export function getLiveInByStoreId(storeId) { ensureSeed(); return read(LIVEIN_SERVICES_KEY).find((item) => String(item.storeId) === String(storeId)) ?? null; }
export function getCustomerVisibleLiveIns() {
  ensureSeed();
  const stores = new Map(getStores().map((store) => [String(store.id), store]));
  return read(LIVEIN_SERVICES_KEY).filter((service) => {
    const store = stores.get(String(service.storeId));
    return normalizeStoreStatus(service.status) === "active"
      && normalizeStoreStatus(store?.status) === "active"
      && isStoreType(store, "live-in")
      && Boolean(store);
  });
}
export const getActiveLiveIns = getCustomerVisibleLiveIns;
export function getLiveIn(liveInId) { ensureSeed(); return read(LIVEIN_SERVICES_KEY).find((item) => String(item.id) === String(liveInId)) ?? null; }
export function getCustomerVisibleLiveIn(liveInId) { return getCustomerVisibleLiveIns().find((item) => String(item.id) === String(liveInId)) ?? null; }
export function updateLiveInInfo(storeId, values) {
  ensureSeed(); const services = read(LIVEIN_SERVICES_KEY); const index = services.findIndex((item) => String(item.storeId) === String(storeId));
  if (index < 0) return null;
  services[index] = { ...services[index], ...values, storeId: services[index].storeId, id: services[index].id, updatedAt: now() };
  save(LIVEIN_SERVICES_KEY, services); return services[index];
}
export function getRoomsByStoreId(storeId, { includeInactive = true } = {}) { ensureSeed(); return read(LIVEIN_ROOMS_KEY).filter((room) => String(room.storeId) === String(storeId) && (includeInactive || room.status === "active")); }
export function getActiveRoomsByStoreId(storeId) { return getRoomsByStoreId(storeId, { includeInactive: false }); }
export function getLiveInStartingPrice(storeId) {
  const prices = getActiveRoomsByStoreId(storeId).map((room) => Number(room.pricePerNight)).filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : null;
}
export function getRoom(roomId, storeId) { return getRoomsByStoreId(storeId).find((room) => String(room.id) === String(roomId)) ?? null; }
function validateRoom(values) {
  if (!String(values.name ?? "").trim()) return "Nama kamar wajib diisi.";
  if (!Number.isInteger(Number(values.capacity)) || Number(values.capacity) < 1) return "Kapasitas minimal 1 orang.";
  if (!(Number(values.pricePerNight) > 0)) return "Harga per kamar per malam harus lebih besar dari 0.";
  return "";
}
export function createRoom(storeId, values) {
  const error = validateRoom(values); if (error) return { error };
  const rooms = read(LIVEIN_ROOMS_KEY); const timestamp = now();
  const room = { id: `ROOM-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`, storeId, name: values.name.trim(), description: values.description?.trim() ?? "", capacity: Number(values.capacity), pricePerNight: Number(values.pricePerNight), facilities: values.facilities ?? [], images: values.images ?? [], status: values.status ?? "active", createdAt: timestamp, updatedAt: timestamp };
  save(LIVEIN_ROOMS_KEY, [room, ...rooms]); return { room };
}
export function updateRoom(roomId, storeId, values) {
  const error = validateRoom(values); if (error) return { error };
  const rooms = read(LIVEIN_ROOMS_KEY); const index = rooms.findIndex((room) => String(room.id) === String(roomId) && String(room.storeId) === String(storeId)); if (index < 0) return { error: "Kamar tidak ditemukan." };
  rooms[index] = { ...rooms[index], ...values, name: values.name.trim(), capacity: Number(values.capacity), pricePerNight: Number(values.pricePerNight), updatedAt: now() };
  save(LIVEIN_ROOMS_KEY, rooms); return { room: rooms[index] };
}
export function setRoomStatus(roomId, storeId, status) { const room = getRoom(roomId, storeId); return room ? updateRoom(roomId, storeId, { ...room, status }) : { error: "Kamar tidak ditemukan." }; }
export function getLiveInBookings(storeId) { return read(LIVEIN_BOOKINGS_KEY).filter((booking) => String(booking.storeId) === String(storeId)); }
export function getAllLiveInBookings() { return read(LIVEIN_BOOKINGS_KEY); }
export function getLiveInBooking(bookingId) { return read(LIVEIN_BOOKINGS_KEY).find((booking) => String(booking.id) === String(bookingId)) ?? null; }
export function getCustomerLiveInBookings(customerId) { return read(LIVEIN_BOOKINGS_KEY).filter((booking) => String(booking.customerId) === String(customerId)); }
export function hasBookingOverlap(roomId, checkIn, checkOut, excludeBookingId = null) {
  return read(LIVEIN_BOOKINGS_KEY).some((booking) => booking.id !== excludeBookingId && LIVEIN_BLOCKING_STATUSES.includes(booking.status) && (booking.roomSnapshots ?? []).some((room) => String(room.roomId) === String(roomId)) && bookingIntervalsOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut));
}
export function getOccupyingBooking(roomId, checkIn, checkOut) { return read(LIVEIN_BOOKINGS_KEY).find((booking) => LIVEIN_BLOCKING_STATUSES.includes(booking.status) && (booking.roomSnapshots ?? []).some((room) => String(room.roomId) === String(roomId)) && bookingIntervalsOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut)) ?? null; }
export function isRoomAvailable(roomId, checkIn, checkOut) { const room = read(LIVEIN_ROOMS_KEY).find((item) => String(item.id) === String(roomId)); return Boolean(room?.status === "active" && calculateNights(checkIn, checkOut) >= 1 && !hasBookingOverlap(roomId, checkIn, checkOut)); }
export function getAvailableRooms(storeId, checkIn, checkOut) { return getRoomsByStoreId(storeId, { includeInactive: false }).filter((room) => isRoomAvailable(room.id, checkIn, checkOut)); }
export function calculateBookingTotals(roomSnapshots, checkIn, checkOut) { const nights = calculateNights(checkIn, checkOut); return { nights, totalCapacity: roomSnapshots.reduce((sum, room) => sum + Number(room.capacity ?? 0), 0), totalAmount: roomSnapshots.reduce((sum, room) => sum + Number(room.pricePerNight ?? 0) * nights, 0) }; }
const historyEntry = (from, to, actor, reason = null) => ({ from, to, actorId: actor?.id ?? null, actorName: actor?.name ?? "System", actorRole: actor?.role ?? "system", reason, timestamp: now() });
export function createLiveInBooking({ storeId, roomIds, checkIn, checkOut, customer }) {
  if (!customer?.id) return { error: "Silakan login sebagai Customer untuk membuat booking." };
  const service = getLiveInByStoreId(storeId); if (!service || service.status !== "active") return { error: "Live In sedang tidak aktif." };
  if (checkIn < localDate()) return { error: "Check-in tidak boleh sebelum hari ini." };
  const nights = calculateNights(checkIn, checkOut); if (!nights) return { error: "Check-out harus setelah check-in." };
  const uniqueIds = [...new Set((roomIds ?? []).map(String))]; if (!uniqueIds.length) return { error: "Pilih minimal satu kamar." };
  const recentDuplicate = read(LIVEIN_BOOKINGS_KEY).find((booking) => String(booking.customerId) === String(customer?.id) && String(booking.storeId) === String(storeId) && booking.checkIn === checkIn && booking.checkOut === checkOut && Date.now() - new Date(booking.createdAt).getTime() < 5000 && [...(booking.roomSnapshots ?? []).map((room) => String(room.roomId))].sort().join(",") === [...uniqueIds].sort().join(","));
  if (recentDuplicate) return { error: "Booking yang sama baru saja dibuat." };
  const lockKey = `${customer?.id}|${storeId}|${checkIn}|${checkOut}|${uniqueIds.sort().join(",")}`;
  if (bookingLocks.has(lockKey)) return { error: "Booking sedang diproses. Mohon tunggu." };
  bookingLocks.add(lockKey);
  try {
  const canonicalRooms = getRoomsByStoreId(storeId, { includeInactive: false }); const selected = uniqueIds.map((id) => canonicalRooms.find((room) => String(room.id) === id));
  if (selected.some((room) => !room) || selected.some((room) => !isRoomAvailable(room.id, checkIn, checkOut))) return { error: "Salah satu kamar yang dipilih sudah tidak tersedia. Silakan pilih kamar kembali." };
  const roomSnapshots = selected.map((room) => ({ roomId: room.id, roomName: room.name, capacity: room.capacity, pricePerNight: room.pricePerNight, facilities: [...(room.facilities ?? [])], image: (room.images ?? []).find((image) => image.isPrimary) ?? room.images?.[0] ?? null, subtotal: room.pricePerNight * nights })); const totals = calculateBookingTotals(roomSnapshots, checkIn, checkOut);
  const store = getStores().find((item) => String(item.id) === String(storeId)); const timestamp = now(); const id = `LIB-${Date.now()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const booking = { id, bookingNumber: id, liveInId: service.id, liveInName: service.name, storeId: service.storeId, storeName: store?.name ?? service.name, merchantUserId: service.merchantUserId, customerId: customer.id, customerName: customer.fullName, customerPhone: customer.phone, checkIn, checkOut, nights, roomSnapshots, totalCapacity: totals.totalCapacity, totalAmount: totals.totalAmount, location: normalizeLocation(service.location), status: "pending", createdAt: timestamp, updatedAt: timestamp, completedAt: null, cancellationReason: null, rejectionReason: null, statusHistory: [historyEntry(null, "pending", { id: customer.id, name: customer.fullName, role: "customer" })] };
  save(LIVEIN_BOOKINGS_KEY, [booking, ...read(LIVEIN_BOOKINGS_KEY)]); createNotification({ recipientUserId: service.merchantUserId, recipientRole: "merchant", type: "booking", title: "Booking Live In baru", message: `${booking.bookingNumber} telah dibuat.`, link: `/merchant/stores/${storeId}/live-in/bookings/${booking.id}`, id: `NTF-LIVEIN-CREATED-${booking.id}` }); return { booking };
  } finally { bookingLocks.delete(lockKey); }
}
export function canCustomerCancelLiveInBooking(booking, referenceDate = localDate()) { return ["pending", "approved"].includes(booking?.status) && dayNumber(booking.checkIn) - dayNumber(referenceDate) >= LIVEIN_CUSTOMER_CANCEL_CUTOFF_DAYS; }
export function transitionLiveInBooking(bookingId, nextStatus, actor, reason = null) {
  const bookings = read(LIVEIN_BOOKINGS_KEY); const index = bookings.findIndex((item) => String(item.id) === String(bookingId)); if (index < 0) return { error: "Booking tidak ditemukan." }; const booking = bookings[index];
  const allowed = { pending: ["approved", "rejected", "cancelled"], approved: ["checked-in", "no-show", "cancelled"], "checked-in": ["completed"] };
  if (actor?.role === "merchant" && String(booking.merchantUserId) !== String(actor.id)) return { error: "Anda tidak berwenang mengelola booking ini." };
  if (actor?.role === "customer" && (nextStatus !== "cancelled" || String(booking.customerId) !== String(actor.id))) return { error: "Anda tidak berwenang mengubah status booking ini." };
  if (actor?.role === "customer" && !canCustomerCancelLiveInBooking(booking)) return { error: "Booking tidak dapat dibatalkan dalam periode kurang dari H-3." };
  if (!(allowed[booking.status] ?? []).includes(nextStatus)) return { error: "Perubahan status booking tidak valid." };
  if (["rejected", "cancelled"].includes(nextStatus) && !String(reason ?? "").trim()) return { error: "Alasan wajib diisi." };
  if (nextStatus === "approved" && (booking.roomSnapshots ?? []).some((snapshot) => { const room = getRoom(snapshot.roomId, booking.storeId); return room?.status !== "active" || hasBookingOverlap(snapshot.roomId, booking.checkIn, booking.checkOut, booking.id); })) return { error: "Salah satu kamar tidak aktif atau telah terisi oleh booking lain. Booking ini tidak dapat disetujui." };
  const today = localDate(); if (nextStatus === "checked-in" && today < booking.checkIn) return { error: "Check-in hanya dapat dilakukan pada atau setelah tanggal check-in." }; if (nextStatus === "no-show" && today < booking.checkIn) return { error: "No Show hanya dapat ditandai pada atau setelah tanggal check-in." }; if (nextStatus === "completed" && today < booking.checkOut) return { error: "Booking baru dapat diselesaikan pada atau setelah tanggal check-out." };
  const timestamp = now(); const updates = { status: nextStatus, updatedAt: timestamp, statusHistory: [...(booking.statusHistory ?? []), historyEntry(booking.status, nextStatus, actor, reason?.trim() || null)] };
  if (nextStatus === "rejected") Object.assign(updates, { rejectedAt: timestamp, rejectedBy: actor.id, rejectionReason: reason.trim() }); if (nextStatus === "cancelled") Object.assign(updates, { cancelledAt: timestamp, cancelledBy: actor.id, cancellationReason: reason.trim() }); if (nextStatus === "no-show") Object.assign(updates, { noShowAt: timestamp, noShowBy: actor.id }); if (nextStatus === "completed" && !booking.completedAt) updates.completedAt = timestamp;
  bookings[index] = { ...booking, ...updates }; save(LIVEIN_BOOKINGS_KEY, bookings);
  const notices = { approved: ["Booking Live In disetujui", "Booking Live In Anda telah disetujui."], rejected: ["Booking Live In ditolak", "Booking Live In Anda ditolak."], "checked-in": ["Check-In Live In", "Check-in Live In Anda telah dikonfirmasi."], completed: ["Live In selesai", "Live In telah selesai. Anda dapat memberikan ulasan."], "no-show": ["Booking ditandai No Show", "Booking Live In Anda ditandai No Show."] };
  if (notices[nextStatus]) createNotification({ recipientUserId: booking.customerId, recipientRole: "customer", type: "booking", title: notices[nextStatus][0], message: notices[nextStatus][1], link: `/live-in-bookings/${booking.id}`, id: `NTF-LIVEIN-${nextStatus}-${booking.id}` }); return { booking: bookings[index] };
}
export function cancelCustomerLiveInBooking(bookingId, customer, reason) { const booking = getLiveInBooking(bookingId); if (!booking || String(booking.customerId) !== String(customer.id)) return { error: "Booking tidak ditemukan." }; if (!canCustomerCancelLiveInBooking(booking)) return { error: "Booking tidak dapat dibatalkan dalam periode kurang dari H-3." }; const result = transitionLiveInBooking(bookingId, "cancelled", { id: customer.id, name: customer.fullName, role: "customer" }, reason); if (result.booking) createNotification({ recipientUserId: booking.merchantUserId, recipientRole: "merchant", type: "booking", title: "Booking Live In dibatalkan", message: `${booking.bookingNumber} dibatalkan customer.`, link: `/merchant/stores/${booking.storeId}/live-in/bookings/${booking.id}` }); return result; }
export function getAlternativeLiveIns(booking) { return getActiveLiveIns().filter((service) => String(service.storeId) !== String(booking.storeId)).filter((service) => getAvailableRooms(service.storeId, booking.checkIn, booking.checkOut).length > 0); }
export function getLiveInMetrics(storeId, date) {
  const today = date ?? localDate(); const tomorrowNumber = dayNumber(today) + 1; const tomorrow = new Date(tomorrowNumber * 86400000).toISOString().slice(0, 10);
  const rooms = getRoomsByStoreId(storeId); const bookings = getLiveInBookings(storeId);
  return { totalRooms: rooms.length, totalActiveRooms: rooms.filter((room) => room.status === "active").length, availableRooms: rooms.filter((room) => isRoomAvailable(room.id, today, tomorrow)).length, activeBookings: bookings.filter((booking) => LIVEIN_BLOCKING_STATUSES.includes(booking.status)).length, waitingApproval: bookings.filter((booking) => booking.status === "pending").length, approvedBookings: bookings.filter((booking) => booking.status === "approved").length, checkInsToday: bookings.filter((booking) => booking.checkIn === today && ["approved", "checked-in"].includes(booking.status)).length, stayingNow: bookings.filter((booking) => booking.status === "checked-in").length, completedBookings: bookings.filter((booking) => booking.status === "completed").length, revenue: bookings.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0) };
}
