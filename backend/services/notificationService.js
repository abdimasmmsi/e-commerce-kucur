const { errors } = require("../errors/AppError");
const { NOTIFICATION_TYPE_SET } = require("../constants/notificationTypes");
const pushService = require("./pushService");
const required = (value, field, max) => { const text = String(value || "").trim(); if (!text || text.length > max) throw errors.validation({ [field]: `${field} wajib diisi dan maksimal ${max} karakter.` }); return text; };
const dedupe = (...parts) => parts.map((part) => String(part)).join(":");
function createNotificationService(repository) {
  const createNotification = async (input) => { const type = required(input.type, "type", 100); if (!NOTIFICATION_TYPE_SET.has(type)) throw errors.validation({ type: "Tipe notifikasi tidak dikenali." }); const data = { userId: required(input.userId, "userId", 36), type, title: required(input.title, "title", 255), body: required(input.body, "body", 10000), entityType: input.entityType ? required(input.entityType, "entityType", 100) : null, entityId: input.entityId ? required(input.entityId, "entityId", 36) : null, metadata: input.metadata || undefined, dedupeKey: input.dedupeKey ? required(input.dedupeKey, "dedupeKey", 255) : null, expiresAt: input.expiresAt || null };
    // Push ke HP dikirim di belakang layar; gagal kirim tidak memengaruhi notifikasi di aplikasi.
    try { const notification = await repository.notifications.create(data); void pushService.sendToUser(repository, data.userId, { title: data.title, body: data.body, url: "/", tag: data.dedupeKey || notification?.id }); return { notification, created: true }; } catch (error) { if (error?.code === "P2002" && data.dedupeKey) return { notification: await repository.notifications.findByDedupeKey(data.dedupeKey), created: false }; throw error; }
  };
  return { createNotification, dedupe,
    async createManyNotifications(items) { return Promise.all(items.map(createNotification)); },
    async list(actor, query = {}) { const page = Math.max(1, Number.parseInt(query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)); const where = { userId: actor.id, ...(String(query.unreadOnly) === "true" ? { readAt: null } : {}), ...(query.type ? { type: String(query.type) } : {}), OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }; const [items,total,unreadCount] = await Promise.all([repository.notifications.list({ where, skip: (page - 1) * limit, take: limit }), repository.notifications.count(where), repository.notifications.count({ userId: actor.id, readAt: null })]); return { items: items.map((row) => ({ ...row, message: row.body, isRead: Boolean(row.readAt) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, unreadCount }; },
    unreadCount: async (actor) => ({ unreadCount: await repository.notifications.count({ userId: actor.id, readAt: null }) }),
    async markRead(id, actor, read = true) { const row = await repository.notifications.findById(id); if (!row || row.userId !== actor.id) throw errors.notFound("Notifikasi tidak ditemukan."); await repository.notifications.markRead(id, actor.id, read ? new Date() : null); return { ...row, readAt: read ? new Date().toISOString() : null, isRead: read }; },
    async markAllRead(actor) { return { updatedCount: await repository.notifications.markAllRead(actor.id, new Date()) }; },
  };
}
module.exports = { createNotificationService, dedupe };
