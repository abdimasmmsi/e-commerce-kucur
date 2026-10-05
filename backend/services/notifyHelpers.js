const { createNotificationService } = require("./notificationService");

// Notifikasi pelengkap dikirim setelah aksi utama berhasil. Gagal kirim notifikasi tidak boleh menggagalkan aksi.
async function notifySafe(repository, items) {
  try {
    const service = createNotificationService(repository);
    for (const item of items.filter((row) => row?.userId)) await service.createNotification(item);
  } catch (error) {
    console.warn(`[notification] ${error.message}`);
  }
}

async function adminUserIds(repository) {
  try { return (await repository.users.list()).filter((user) => user.roles?.includes("admin") && user.status !== "inactive").map((user) => user.id); }
  catch { return []; }
}

async function notifyAdmins(repository, item) {
  const ids = await adminUserIds(repository);
  await notifySafe(repository, ids.map((userId) => ({ ...item, userId, dedupeKey: item.dedupeKey ? `${item.dedupeKey}:${userId}` : undefined })));
}

module.exports = { notifySafe, notifyAdmins };
