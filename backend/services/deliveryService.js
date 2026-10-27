const { randomUUID } = require("node:crypto");
const { errors } = require("../errors/AppError");
const { createNotificationService, dedupe } = require("./notificationService");
const { generateCommerceFinance } = require("./financeService");
const { notifyAdmins, notifySafe } = require("./notifyHelpers");

const ACTIVE_ORDER_STATUSES = ["WAITING_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"];
const TERMINAL_ORDER_STATUSES = ["DELIVERED", "FAILED", "CANCELLED"];
const clockText = (value) => { const match = String(value instanceof Date ? value.toISOString() : value || "").match(/(?:T|^)(\d{2}:\d{2})(?::\d{2})?/); return match?.[1] || null; };
const jakartaParts = (date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const addDate = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const jakartaInstant = (date, time) => new Date(`${date}T${time}:00+07:00`);
function resolveDeliveryDate(createdAt, cutoffTime) { const parts = jakartaParts(new Date(createdAt)); const date = `${parts.year}-${parts.month}-${parts.day}`; return `${parts.hour}:${parts.minute}` <= (clockText(cutoffTime) || "15:00") ? date : addDate(date, 1); }
const dateOnly = (value) => String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
const hasRole = (profile, role) => profile?.user?.roles?.some((entry) => entry.role?.name === role);
const effectiveCapacity = (profileLimit, platformLimit) => Math.min(Number(profileLimit), Number(platformLimit));
const availabilityOverlaps = (leftStart, leftEnd, rightStart, rightEnd) => new Date(leftStart) < new Date(rightEnd || "9999-12-31") && new Date(rightStart) < new Date(leftEnd || "9999-12-31");
const deliveryOrderEligible = (order) => ["confirmed", "processing", "ready-for-pickup"].includes(order.fulfillmentStatus) && ["paid", "pending"].includes(order.paymentStatus);
const publicCourier = (profile) => ({ userId: profile.userId, maxActiveDeliveries: profile.maxActiveDeliveries, isActive: profile.isActive, createdAt: profile.createdAt, updatedAt: profile.updatedAt, user: { id: profile.user.id, fullName: profile.user.fullName } });
const publicOrder = (order) => ({ id: order.id, orderCode: order.orderCode, orderNumber: order.orderNumber, storeId: order.storeId, storeName: order.storeName || order.store?.name, fulfillmentStatus: order.fulfillmentStatus, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, productTotal: order.productTotal, taxAmount: order.taxAmount, deliveryFee: order.deliveryFee, courierTip: order.courierTip, totalAmount: order.totalAmount, recipientName: order.recipientName, recipientPhone: order.recipientPhone, deliveryAddress: order.deliveryAddress, deliveryLocation: order.deliveryLocation, createdAt: order.createdAt, items: order.items });
const publicBatch = (batch) => batch && ({ id: batch.id, courierUserId: batch.courierUserId, deliveryDate: batch.deliveryDate, cutoffAt: batch.cutoffAt, dispatchAt: batch.dispatchAt, status: batch.status, startedAt: batch.startedAt, completedAt: batch.completedAt, createdAt: batch.createdAt, updatedAt: batch.updatedAt, courier: batch.courier ? { id: batch.courier.id, fullName: batch.courier.fullName } : undefined, orders: (batch.orders || []).map((item) => ({ id: item.id, deliveryBatchId: item.deliveryBatchId, commerceOrderId: item.commerceOrderId, pickupSequence: item.pickupSequence, deliverySequence: item.deliverySequence, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt, commerceOrder: item.commerceOrder ? publicOrder(item.commerceOrder) : undefined })) });

const jsonList = (value) => { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } } return []; };
const normalizeLeave = (item) => ({ ...item, status: item.status || "approved" });
const newestLeaveFirst = (a, b) => new Date(b.requestedAt || b.startAt) - new Date(a.requestedAt || a.startAt);
const blocksNewLeave = (item) => ["pending", "approved"].includes(item.status) && !(item.status === "approved" && item.endAt && new Date(item.endAt) <= new Date());
const LEAVE_START_TOLERANCE_MS = 10 * 60 * 1000;
const leaveDateText = (value) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
// Status di profil mengikuti cuti approved yang sedang berjalan saat ini.
const leaveProfileFields = (history, now) => { const current = history.find((item) => item.status === "approved" && new Date(item.startAt) <= now && (!item.endAt || new Date(item.endAt) > now)); return current ? { availabilityStatus: "UNAVAILABLE", unavailableStartAt: new Date(current.startAt), unavailableEndAt: current.endAt ? new Date(current.endAt) : null, unavailableReason: current.reason || null } : { availabilityStatus: "AVAILABLE", unavailableStartAt: null, unavailableEndAt: null, unavailableReason: null }; };

function createDeliveryService(repository) {
  const settings = () => repository.settings.get();
  const notify = (tx, input) => createNotificationService(tx).createNotification(input);
  const assertCourier = async (source, courierUserId, deliveryDate, dispatchAt, orderCount = 0) => {
    const profile = await source.delivery.profile(courierUserId);
    if (!profile || !profile.isActive || !hasRole(profile, "courier")) throw errors.conflict("Kurir tidak aktif atau tidak memiliki peran kurir.");
    if (await source.delivery.overlappingAvailability(courierUserId, dispatchAt, new Date(dispatchAt.getTime() + 86400000))) throw errors.conflict("Kurir tidak tersedia pada jadwal pengiriman.");
    const config = await source.settings.get(); const capacity = effectiveCapacity(profile.maxActiveDeliveries, config.maxDailyDeliveries); const active = await source.delivery.activeCourierCount(courierUserId, new Date(`${deliveryDate}T00:00:00Z`));
    if (active + orderCount > capacity) throw errors.conflict("Kapasitas pengiriman kurir terlampaui.");
    return profile;
  };
  const assertAssignment = async (commerceOrderId, actor) => { const assignment = await repository.delivery.assignment(commerceOrderId); if (!assignment || assignment.batch.courierUserId !== actor.id || !ACTIVE_ORDER_STATUSES.includes(assignment.status)) throw errors.forbidden("Pesanan tidak ditugaskan kepada kurir ini."); return assignment; };
  const eligible = async (deliveryDate) => { const config = await settings(); const rows = await repository.delivery.eligibleOrders(); const result = []; for (const order of rows) if (resolveDeliveryDate(order.createdAt, config.deliveryOrderCutoffTime) <= deliveryDate && !(await repository.delivery.activeAssignment(order.id))) result.push(order); return result; };
  const createBatchData = (deliveryDate, config, courierUserId) => ({ courierUserId, deliveryDate: new Date(`${deliveryDate}T00:00:00Z`), cutoffAt: jakartaInstant(deliveryDate, clockText(config.deliveryOrderCutoffTime) || "15:00"), dispatchAt: jakartaInstant(deliveryDate, clockText(config.deliveryDispatchTime) || "08:00"), status: "PLANNED" });

  // Validasi bersama untuk pengajuan kurir dan cuti yang dicatat Admin.
  const parseLeaveInput = (input, history) => {
    const startAt = new Date(input.startAt), endAt = input.endAt ? new Date(input.endAt) : null;
    if (!input.startAt || !Number.isFinite(startAt.getTime()) || (endAt && (!Number.isFinite(endAt.getTime()) || endAt <= startAt))) throw errors.validation({ availability: "Rentang cuti tidak valid." });
    if (startAt.getTime() < Date.now() - LEAVE_START_TOLERANCE_MS) throw errors.validation({ startAt: "Tanggal mulai cuti tidak boleh sebelum waktu sekarang." });
    const reason = String(input.reason || "").trim().slice(0, 255);
    if (!reason) throw errors.validation({ reason: "Alasan cuti wajib diisi." });
    if (history.some((item) => blocksNewLeave(item) && availabilityOverlaps(item.startAt, item.endAt, startAt, endAt))) throw errors.conflict("Periode cuti bertumpang tindih dengan pengajuan lain.");
    return { startAt, endAt, reason };
  };
  // Cuti berjalan diakhiri sekarang; pengajuan pending atau cuti yang belum mulai dibatalkan.
  const endLeave = async (courierUserId, id, loaded) => {
    const history = loaded || (await repository.delivery.availability(courierUserId)).map(normalizeLeave); const entry = history.find((item) => item.id === id); const now = new Date();
    if (!entry || !(entry.status === "pending" || (entry.status === "approved" && (!entry.endAt || new Date(entry.endAt) > now)))) throw errors.notFound("Cuti aktif atau pengajuan tidak ditemukan.");
    const cancel = entry.status === "pending" || new Date(entry.startAt) > now;
    const next = history.map((item) => item.id === id ? (cancel ? { ...item, status: "cancelled", cancelledAt: now.toISOString() } : { ...item, endAt: now.toISOString() }) : item);
    await repository.delivery.upsertProfile(courierUserId, { availabilityHistory: next, ...leaveProfileFields(next, now) });
    return { entry, cancel };
  };

  return {
    resolveDeliveryDate,
    async profile(actor) { const row = await repository.delivery.profile(actor.id); if (!row) throw errors.notFound("Profil kurir belum tersedia."); return publicCourier(row); },
    // Cuti kurir: diajukan kurir (pending) lalu disetujui/ditolak admin. Hanya cuti "approved" yang memblokir penugasan.
    // Riwayat disimpan di CourierProfile.availabilityHistory (JSON); entri lama tanpa status dianggap approved.
    async availability(actor) { return (await repository.delivery.availability(actor.id)).map(normalizeLeave).sort(newestLeaveFirst); },
    async createAvailability(input, actor) {
      const history = (await repository.delivery.availability(actor.id)).map(normalizeLeave);
      const { startAt, endAt, reason } = parseLeaveInput(input, history);
      const entry = { id: randomUUID(), courierUserId: actor.id, startAt: startAt.toISOString(), endAt: endAt ? endAt.toISOString() : null, reason, status: "pending", requestedAt: new Date().toISOString() };
      await repository.delivery.upsertProfile(actor.id, { availabilityHistory: [...history, entry] });
      await notifyAdmins(repository, { type: "COURIER_LEAVE_REQUESTED", title: "Pengajuan cuti kurir", body: `${actor.fullName || "Kurir"} mengajukan cuti mulai ${leaveDateText(entry.startAt)}${entry.endAt ? ` sampai ${leaveDateText(entry.endAt)}` : ""}. Alasan: ${reason}`, entityType: "COURIER_LEAVE", entityId: entry.id, dedupeKey: `courier-leave-requested:${entry.id}` });
      return entry;
    },
    async endAvailability(id, actor) {
      const { entry, cancel } = await endLeave(actor.id, id);
      if (entry.status === "approved") await notifyAdmins(repository, { type: "COURIER_LEAVE_CANCELLED", title: cancel ? "Cuti kurir dibatalkan" : "Kurir kembali bertugas", body: `${actor.fullName || "Kurir"} ${cancel ? "membatalkan cuti yang sudah disetujui" : "mengakhiri cuti lebih awal"}.`, entityType: "COURIER_LEAVE", entityId: id, dedupeKey: `courier-leave-ended:${id}` });
      return { ended: true };
    },
    // Admin mencatat cuti atas nama kurir (mis. sakit tanpa HP): langsung approved, ditandai createdByAdmin.
    async recordLeaveByAdmin(courierUserId, input, actor) {
      const profile = await repository.delivery.profile(courierUserId);
      if (!profile || !hasRole(profile, "courier")) throw errors.notFound("Kurir tidak ditemukan.");
      const history = (await repository.delivery.availability(courierUserId)).map(normalizeLeave);
      const { startAt, endAt, reason } = parseLeaveInput(input, history);
      const now = new Date();
      const entry = { id: randomUUID(), courierUserId, startAt: startAt.toISOString(), endAt: endAt ? endAt.toISOString() : null, reason, status: "approved", requestedAt: now.toISOString(), reviewedAt: now.toISOString(), reviewedByUserId: actor.id, createdByAdmin: true };
      const next = [...history, entry];
      await repository.delivery.upsertProfile(courierUserId, { availabilityHistory: next, ...leaveProfileFields(next, now) });
      const period = `${leaveDateText(entry.startAt)}${entry.endAt ? ` – ${leaveDateText(entry.endAt)}` : ""}`;
      await notifySafe(repository, [{ userId: courierUserId, type: "COURIER_LEAVE_APPROVED", title: "Admin mencatat cuti untukmu", body: `Cuti ${period} dicatat Admin. Alasan: ${reason}. Kamu tidak akan mendapat pengiriman selama cuti.`, entityType: "COURIER_LEAVE", entityId: entry.id, dedupeKey: `courier-leave-recorded:${entry.id}` }]);
      return entry;
    },
    // Admin mengakhiri cuti approved yang berjalan (endAt = sekarang) atau membatalkan yang belum mulai.
    async endLeaveByAdmin(courierUserId, id) {
      const history = (await repository.delivery.availability(courierUserId)).map(normalizeLeave); const target = history.find((item) => item.id === id);
      if (!target || target.status !== "approved") throw errors.notFound("Cuti aktif tidak ditemukan.");
      const { entry, cancel } = await endLeave(courierUserId, id, history);
      const period = `${leaveDateText(entry.startAt)}${entry.endAt ? ` – ${leaveDateText(entry.endAt)}` : ""}`;
      await notifySafe(repository, [{ userId: courierUserId, type: "COURIER_LEAVE_CANCELLED", title: cancel ? "Cuti dibatalkan Admin" : "Cuti diakhiri Admin", body: cancel ? `Cuti ${period} dibatalkan Admin. Kamu bisa mendapat pengiriman seperti biasa.` : `Admin mengakhiri cutimu lebih awal. Mulai sekarang kamu bisa mendapat pengiriman lagi.`, entityType: "COURIER_LEAVE", entityId: id, dedupeKey: `courier-leave-ended-admin:${id}` }]);
      return { ended: true, cancelled: cancel };
    },
    async leaveRequests() {
      const couriers = await repository.delivery.listCouriers(); const rows = [];
      for (const courier of couriers) for (const item of jsonList(courier.availabilityHistory).map(normalizeLeave)) rows.push({ ...item, courierUserId: courier.userId, courier: { id: courier.userId, fullName: courier.user?.fullName, phone: courier.user?.phone } });
      for (const row of rows.filter((item) => item.status === "pending")) {
        const batches = await repository.delivery.listBatches({ courierUserId: row.courierUserId });
        row.plannedBatchCount = batches.filter((batch) => ["PLANNED", "READY", "IN_PROGRESS"].includes(batch.status) && availabilityOverlaps(row.startAt, row.endAt, new Date(`${dateOnly(batch.deliveryDate)}T00:00:00+07:00`), new Date(`${dateOnly(batch.deliveryDate)}T23:59:59+07:00`))).length;
      }
      return rows.sort((a, b) => (a.status === "pending") === (b.status === "pending") ? newestLeaveFirst(a, b) : a.status === "pending" ? -1 : 1);
    },
    async reviewLeave(courierUserId, id, input, actor) {
      const decision = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : null;
      if (!decision) throw errors.validation({ decision: "Pilih setujui atau tolak." });
      const note = String(input.reason || "").trim().slice(0, 255);
      if (decision === "rejected" && !note) throw errors.validation({ reason: "Alasan penolakan wajib diisi." });
      const history = (await repository.delivery.availability(courierUserId)).map(normalizeLeave); const entry = history.find((item) => item.id === id);
      if (!entry) throw errors.notFound("Pengajuan cuti tidak ditemukan.");
      if (entry.status !== "pending") throw errors.conflict("Pengajuan cuti ini sudah diproses.");
      const now = new Date(); const next = history.map((item) => item.id === id ? { ...item, status: decision, reviewedAt: now.toISOString(), reviewedByUserId: actor.id, ...(decision === "rejected" ? { rejectionReason: note } : {}) } : item);
      await repository.delivery.upsertProfile(courierUserId, { availabilityHistory: next, ...leaveProfileFields(next, now) });
      const period = `${leaveDateText(entry.startAt)}${entry.endAt ? ` – ${leaveDateText(entry.endAt)}` : ""}`;
      await notifySafe(repository, [decision === "approved"
        ? { userId: courierUserId, type: "COURIER_LEAVE_APPROVED", title: "Cuti disetujui", body: `Cuti ${period} disetujui Admin. Kamu tidak akan mendapat pengiriman selama cuti.`, entityType: "COURIER_LEAVE", entityId: id, dedupeKey: `courier-leave-approved:${id}` }
        : { userId: courierUserId, type: "COURIER_LEAVE_REJECTED", title: "Cuti ditolak", body: `Cuti ${period} ditolak Admin. Alasan: ${note}`, entityType: "COURIER_LEAVE", entityId: id, dedupeKey: `courier-leave-rejected:${id}` }]);
      return next.find((item) => item.id === id);
    },
    // Draf batch otomatis: order siap kirim dibagi ke kurir yang tidak cuti dan masih punya kapasitas.
    // Order dari lapak yang sama dikumpulkan ke satu kurir (sedikit titik ambil). Draf tidak disimpan;
    // batch baru dibuat saat Admin menyetujui (approveDrafts). Tidak ada persetujuan otomatis.
    async drafts(query = {}) {
      const config = await settings();
      // Tanpa tanggal: batch hari ini selama kurir belum berangkat, sesudahnya batch besok.
      const today = (({ year, month, day }) => `${year}-${month}-${day}`)(jakartaParts(new Date()));
      const deliveryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(query.deliveryDate || "")) ? query.deliveryDate : (Date.now() < jakartaInstant(today, clockText(config.deliveryDispatchTime) || "17:00").getTime() ? today : addDate(today, 1));
      const orders = await eligible(deliveryDate);
      const { cutoffAt, dispatchAt } = createBatchData(deliveryDate, config, null);
      const reminderMinutes = Number(config.batchReminderMinutes ?? 60);
      const reminderAt = new Date(dispatchAt.getTime() - reminderMinutes * 60000);
      const couriers = [];
      for (const profile of await repository.delivery.listCouriers()) {
        if (!profile.isActive || !hasRole(profile, "courier")) continue;
        const onLeave = Boolean(await repository.delivery.overlappingAvailability(profile.userId, dispatchAt, new Date(dispatchAt.getTime() + 86400000)));
        const capacity = effectiveCapacity(profile.maxActiveDeliveries, config.maxDailyDeliveries);
        const active = await repository.delivery.activeCourierCount(profile.userId, new Date(`${deliveryDate}T00:00:00Z`));
        couriers.push({ courierUserId: profile.userId, fullName: profile.user?.fullName, onLeave, capacity, active, remaining: onLeave ? 0 : Math.max(capacity - active, 0), orders: [] });
      }
      const groups = [...orders.reduce((map, order) => map.set(order.storeId, [...(map.get(order.storeId) || []), order]), new Map()).values()].sort((a, b) => b.length - a.length);
      const unassigned = [];
      for (const group of groups) {
        const rest = [...group];
        while (rest.length) {
          const courier = couriers.filter((item) => item.remaining > 0).sort((a, b) => b.remaining - a.remaining || a.orders.length - b.orders.length)[0];
          if (!courier) { unassigned.push(...rest); break; }
          const take = rest.splice(0, courier.remaining);
          courier.orders.push(...take); courier.remaining -= take.length;
        }
      }
      return { deliveryDate, cutoffAt, dispatchAt, reminderAt, reminderMinutes, cutoffPassed: Date.now() >= cutoffAt.getTime(), total: orders.length, couriers: couriers.map((item) => ({ ...item, orders: item.orders.map(publicOrder) })), unassigned: unassigned.map(publicOrder) };
    },
    async approveDrafts(input, actor) {
      const deliveryDate = dateOnly(input.deliveryDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw errors.validation({ deliveryDate: "Tanggal pengiriman wajib valid." });
      const assignments = (Array.isArray(input.assignments) ? input.assignments : []).map((item) => ({ courierUserId: String(item.courierUserId || ""), commerceOrderIds: [...new Set((item.commerceOrderIds || []).map(String))] })).filter((item) => item.courierUserId && item.commerceOrderIds.length);
      if (!assignments.length) throw errors.validation({ assignments: "Tidak ada order di draf yang bisa disetujui." });
      const created = [];
      for (const assignment of assignments) created.push(await this.createBatch({ ...assignment, deliveryDate }, actor));
      return { deliveryDate, batches: created.map(publicBatch) };
    },
    async eligible(query) { const config = await settings(); const target = query.deliveryDate || resolveDeliveryDate(new Date(), config.deliveryOrderCutoffTime); return { deliveryDate: target, items: await eligible(target) }; },
    async couriers() { return (await repository.delivery.listCouriers()).map(publicCourier); },
    async merchantOrders(actor) { return (await repository.delivery.merchantAssignments(actor.id)).map((item) => ({ id: item.id, status: item.status, pickupSequence: item.pickupSequence, deliverySequence: item.deliverySequence, commerceOrder: publicOrder(item.commerceOrder), batch: publicBatch(item.batch) })); },
    async createBatch(input, actor) { void actor; const config = await settings(); const deliveryDate = dateOnly(input.deliveryDate); if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw errors.validation({ deliveryDate: "Tanggal delivery wajib valid." }); const orderIds = [...new Set((input.commerceOrderIds || []).map(String))]; if (!orderIds.length) throw errors.validation({ commerceOrderIds: "Minimal satu CommerceOrder wajib dipilih." }); const courierUserId = String(input.courierUserId); const data = createBatchData(deliveryDate, config, courierUserId); await assertCourier(repository, courierUserId, deliveryDate, data.dispatchAt, orderIds.length);
      return repository.transaction(async (tx) => { for (const id of orderIds) { await tx.delivery.lockOrder(id); const order = await tx.commerce.findOrder(id); if (!order || resolveDeliveryDate(order.createdAt, config.deliveryOrderCutoffTime) > deliveryDate || !deliveryOrderEligible(order) || await tx.delivery.activeAssignment(id)) throw errors.conflict(`Order ${id} tidak eligible atau sudah memiliki assignment aktif.`); } const created = await tx.delivery.createBatch(data, orderIds); for (const id of orderIds) await tx.delivery.addActivity({ commerceOrderId: id, courierUserId, status: "BATCHED", metadata: { batchId: created.id }, note: "Pesanan masuk jadwal pengiriman harian." }); await notify(tx, { userId: courierUserId, type: "DELIVERY_BATCH_CREATED", title: "Jadwal pengiriman baru", body: `${orderIds.length} pesanan ditugaskan untuk ${deliveryDate}.`, entityType: "DELIVERY_BATCH", entityId: created.id, dedupeKey: dedupe("delivery-batch-created", created.id, courierUserId) }); return created; }); },
    async batches(actor, query = {}) { return (await repository.delivery.listBatches(actor.roles.includes("admin") ? {} : { courierUserId: actor.id, ...(query.status ? { status: query.status } : {}) })).map(publicBatch); },
    async batch(id, actor) { const row = await repository.delivery.batch(id); if (!row || (!actor.roles.includes("admin") && row.courierUserId !== actor.id)) throw errors.notFound("Jadwal pengiriman tidak ditemukan."); return publicBatch(row); },
    async startBatch(id, actor) { const batch = await this.batch(id, actor); if (!["PLANNED", "READY"].includes(batch.status)) throw errors.conflict("Batch tidak dapat dimulai."); return repository.delivery.updateBatch(id, { status: "IN_PROGRESS", startedAt: new Date() }); },
    async confirmReady(commerceOrderId, input, actor) { if (typeof input.isReady !== "boolean") throw errors.validation({ isReady: "Status kesiapan wajib boolean." }); const order = await repository.commerce.findOrder(commerceOrderId); if (!order || order.store.merchantUserId !== actor.id) throw errors.forbidden("Pesanan bukan milik penjual ini."); const assignment = await repository.delivery.assignment(commerceOrderId); if (!assignment) throw errors.conflict("Pesanan belum masuk jadwal pengiriman aktif."); return repository.transaction(async (tx) => { const row = await tx.delivery.pickupConfirmation({ commerceOrderId, merchantUserId: actor.id, courierUserId: assignment.batch.courierUserId, isReady: input.isReady, note: String(input.note || "").trim() || null }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: assignment.batch.courierUserId, status: input.isReady ? "READY" : "NOT_READY", note: row.note }); if (input.isReady && order.fulfillmentStatus === "processing") await tx.commerce.updateOrder(commerceOrderId, { fulfillmentStatus: "readyForPickup" }); return row; }); },
    async pickup(commerceOrderId, input, actor) { const assignment = await assertAssignment(commerceOrderId, actor); if (assignment.status !== "WAITING_PICKUP") throw errors.conflict("Status ambil barang tidak valid."); return repository.transaction(async (tx) => { await tx.delivery.lockOrder(commerceOrderId); const current = await tx.delivery.assignment(commerceOrderId); const before = await tx.commerce.findOrder(commerceOrderId); if (!current || current.id !== assignment.id || current.status !== "WAITING_PICKUP" || !before || !deliveryOrderEligible(before)) throw errors.conflict("Pesanan sudah berubah (mis. dibatalkan) dan tidak bisa diambil."); const row = await tx.delivery.updateAssignment(assignment.id, { status: "PICKED_UP" }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: actor.id, status: "PICKED_UP", note: String(input.note || "").trim() || null }); const order = await tx.commerce.updateOrder(commerceOrderId, { fulfillmentStatus: "pickedUp" }); await notify(tx, { userId: order.customerUserId, type: "DELIVERY_PICKED_UP", title: "Pesanan telah diambil kurir", body: `Pesanan #${order.orderCode} telah diambil dari penjual.`, entityType: "COMMERCE_ORDER", entityId: commerceOrderId, dedupeKey: dedupe("delivery-picked-up", commerceOrderId, order.customerUserId) }); return row; }); },
    async outForDelivery(commerceOrderId, input, actor) { const assignment = await assertAssignment(commerceOrderId, actor); if (assignment.status !== "PICKED_UP") throw errors.conflict("Status delivery tidak valid."); const sameBatch = await repository.delivery.batch(assignment.batch?.id ?? assignment.batchId); if (sameBatch?.orders?.some((item) => item.status === "OUT_FOR_DELIVERY" && item.commerceOrderId !== commerceOrderId)) throw errors.conflict("Selesaikan atau tandai gagal pengantaran yang sedang berjalan dulu."); return repository.transaction(async (tx) => { const row = await tx.delivery.updateAssignment(assignment.id, { status: "OUT_FOR_DELIVERY" }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: actor.id, status: "OUT_FOR_DELIVERY", note: String(input.note || "").trim() || null }); const order = await tx.commerce.updateOrder(commerceOrderId, { fulfillmentStatus: "onDelivery" }); await notify(tx, { userId: order.customerUserId, type: "DELIVERY_OUT_FOR_DELIVERY", title: "Pesanan sedang diantar", body: `Pesanan #${order.orderCode} sedang menuju alamat Anda.`, entityType: "COMMERCE_ORDER", entityId: commerceOrderId, dedupeKey: dedupe("delivery-out-for-delivery", commerceOrderId, order.customerUserId) }); return row; }); },
    async failed(commerceOrderId, input, actor) { const assignment = await assertAssignment(commerceOrderId, actor); const reason = String(input.reason || input.note || "Gagal dikirim").slice(0, 1000); return repository.transaction(async (tx) => { const row = await tx.delivery.updateAssignment(assignment.id, { status: "FAILED", failureReason: reason }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: actor.id, status: "FAILED", note: reason }); const order = await tx.commerce.findOrder(commerceOrderId); for (const userId of [order.customerUserId, order.store.merchantUserId]) await notify(tx, { userId, type: "DELIVERY_FAILED", title: "Pengiriman belum berhasil", body: `Pengiriman pesanan #${order.orderCode} belum berhasil.`, entityType: "COMMERCE_ORDER", entityId: commerceOrderId, dedupeKey: dedupe("delivery-failed", commerceOrderId, assignment.id, userId) }); return row; }); },
    async proof(commerceOrderId, input, actor) { const photoUrl = String(input.photoUrl || "").trim(); if (!photoUrl) throw errors.validation({ photoUrl: "Bukti foto wajib diisi." }); if (!/^\/uploads\/proofs\/[A-Za-z0-9._-]+$/.test(photoUrl)) throw errors.validation({ photoUrl: "Bukti foto tidak valid." }); const existing = await repository.delivery.proof(commerceOrderId); if (existing) return existing; const assignment = await assertAssignment(commerceOrderId, actor); if (assignment.status !== "OUT_FOR_DELIVERY") throw errors.conflict("Order belum dalam perjalanan."); return repository.transaction(async (tx) => { await tx.delivery.lockOrder(commerceOrderId); const duplicate = await tx.delivery.proof(commerceOrderId); if (duplicate) return duplicate; const current = await tx.delivery.assignment(commerceOrderId); if (!current || current.batch.courierUserId !== actor.id || current.status !== "OUT_FOR_DELIVERY") throw errors.conflict("Status delivery sudah berubah."); const proof = await tx.delivery.createProof({ commerceOrderId, courierUserId: actor.id, photoUrl, recipientName: String(input.recipientName || "").trim().slice(0, 255) || null, note: String(input.note || "").trim() || null }); await tx.delivery.updateAssignment(current.id, { status: "DELIVERED" }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: actor.id, status: "DELIVERED", note: proof.note }); const order = await tx.commerce.findOrder(commerceOrderId); for (const reservation of order.reservations.filter((item) => item.status === "reserved")) await tx.commerce.consumeReservation(reservation.id); const completedAt = new Date(proof.deliveredAt || Date.now()); const codCollected = order.paymentMethod === "COD" && order.paymentStatus === "pending"; const delivered = await tx.commerce.updateOrder(commerceOrderId, { fulfillmentStatus: "completed", completedAt, ...(codCollected ? { paymentStatus: "paid" } : {}) }); await generateCommerceFinance(tx, delivered, proof.deliveredAt); await notify(tx, { userId: order.customerUserId, type: "DELIVERY_COMPLETED", title: "Pesanan telah diterima", body: `Pesanan #${order.orderCode} selesai dikirim.`, entityType: "COMMERCE_ORDER", entityId: commerceOrderId, dedupeKey: dedupe("delivery-completed", commerceOrderId, order.customerUserId) }); return proof; }); },
    async removeOrder(batchId, commerceOrderId, actor) { return repository.transaction(async (tx) => { await tx.delivery.lockOrder(commerceOrderId); const assignment = await tx.delivery.batchOrder(batchId, commerceOrderId); if (!assignment) throw errors.notFound("Assignment tidak ditemukan."); if (!["PLANNED", "READY"].includes(assignment.batch.status) || assignment.status !== "WAITING_PICKUP") throw errors.conflict("Pesanan tidak dapat dikeluarkan setelah barang mulai diambil."); await tx.delivery.updateAssignment(assignment.id, { status: "CANCELLED" }); await tx.delivery.addActivity({ commerceOrderId, courierUserId: assignment.batch.courierUserId, status: "REMOVED_FROM_BATCH", metadata: { batchId }, note: "Admin mengeluarkan pesanan dari jadwal sebelum barang diambil." }); await tx.audits.append({ entityType: "delivery-batch-order", entityId: assignment.id, actorId: actor.id, actorRole: "admin", activityType: "DELIVERY_ORDER_REMOVED", description: "Admin mengeluarkan pesanan dari jadwal pengiriman.", isSystem: false }); return { removed: true, assignmentId: assignment.id }; }); },
    async cancelBatch(batchId, actor) { return repository.transaction(async (tx) => { const batch = await tx.delivery.batch(batchId); if (!batch) throw errors.notFound("Jadwal pengiriman tidak ditemukan."); if (!["PLANNED", "READY"].includes(batch.status) || batch.orders.some((item) => ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(item.status))) throw errors.conflict("Jadwal tidak dapat dibatalkan setelah barang mulai diambil."); for (const assignment of batch.orders.filter((item) => item.status === "WAITING_PICKUP")) { await tx.delivery.lockOrder(assignment.commerceOrderId); await tx.delivery.updateAssignment(assignment.id, { status: "CANCELLED" }); await tx.delivery.addActivity({ commerceOrderId: assignment.commerceOrderId, courierUserId: batch.courierUserId, status: "BATCH_CANCELLED", metadata: { batchId }, note: "Admin membatalkan batch sebelum pickup." }); } const updated = await tx.delivery.updateBatch(batchId, { status: "CANCELLED" }); await tx.audits.append({ entityType: "delivery-batch", entityId: batchId, actorId: actor.id, actorRole: "admin", activityType: "DELIVERY_BATCH_CANCELLED", description: "Admin membatalkan delivery batch.", isSystem: false }); return updated; }); },
    async rebatch(commerceOrderId, input, actor) { const config = await settings(); let targetBatch = null, deliveryDate, courierUserId; if (input.targetBatchId) { targetBatch = await repository.delivery.batch(String(input.targetBatchId)); if (!targetBatch || !["PLANNED", "READY"].includes(targetBatch.status)) throw errors.conflict("Jadwal tujuan tidak valid."); deliveryDate = dateOnly(targetBatch.deliveryDate); courierUserId = targetBatch.courierUserId; } else { deliveryDate = dateOnly(input.deliveryDate); courierUserId = String(input.courierUserId || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !courierUserId) throw errors.validation({ rebatch: "Jadwal tujuan atau kurir dan tanggal wajib diisi." }); } const data = createBatchData(deliveryDate, config, courierUserId); await assertCourier(repository, courierUserId, deliveryDate, data.dispatchAt, 1);
      return repository.transaction(async (tx) => { await tx.delivery.lockOrder(commerceOrderId); if (await tx.delivery.activeAssignment(commerceOrderId)) throw errors.conflict("Order masih memiliki assignment aktif."); const previous = await tx.delivery.latestAssignment(commerceOrderId); if (!previous || !["FAILED", "CANCELLED"].includes(previous.status)) throw errors.conflict("Hanya assignment FAILED atau CANCELLED yang dapat di-rebatch."); const order = await tx.commerce.findOrder(commerceOrderId); if (!order || ["cancelled", "completed"].includes(order.fulfillmentStatus)) throw errors.conflict("CommerceOrder tidak dapat di-rebatch."); let batch = targetBatch ? await tx.delivery.batch(targetBatch.id) : await tx.delivery.createBatch(data, []); if (!batch || !["PLANNED", "READY"].includes(batch.status)) throw errors.conflict("Target batch sudah berubah."); const created = await tx.delivery.createBatchOrder({ deliveryBatchId: batch.id, commerceOrderId, pickupSequence: batch.orders.length + 1, deliverySequence: batch.orders.length + 1, status: "WAITING_PICKUP" }); await tx.commerce.updateOrder(commerceOrderId, { fulfillmentStatus: "readyForPickup" }); await tx.delivery.addActivity({ commerceOrderId, courierUserId, status: "REBATCHED", metadata: { previousAssignmentId: previous.id, newAssignmentId: created.id, batchId: batch.id }, note: "Admin melakukan controlled rebatching." }); await tx.audits.append({ entityType: "commerce-order", entityId: commerceOrderId, actorId: actor.id, actorRole: "admin", activityType: "DELIVERY_REBATCHED", description: "Admin memindahkan pesanan ke jadwal pengiriman baru.", isSystem: false }); return { batch, assignment: created }; }); },
    async completeBatch(id, actor) { const batch = await this.batch(id, actor); if (!batch.orders.length || batch.orders.some((item) => !TERMINAL_ORDER_STATUSES.includes(item.status))) throw errors.conflict("Semua delivery harus terminal sebelum batch diselesaikan."); return repository.delivery.updateBatch(id, { status: "COMPLETED", completedAt: new Date() }); },
  };
}

module.exports = { jakartaDate: (date = new Date()) => { const parts = jakartaParts(date); return `${parts.year}-${parts.month}-${parts.day}`; }, ACTIVE_ORDER_STATUSES, TERMINAL_ORDER_STATUSES, availabilityOverlaps, createDeliveryService, deliveryOrderEligible, effectiveCapacity, resolveDeliveryDate };
