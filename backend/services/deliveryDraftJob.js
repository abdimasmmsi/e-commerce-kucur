const { createDeliveryService, jakartaDate } = require("./deliveryService");
const { notifyAdmins } = require("./notifyHelpers");

// Job ringan tiap menit: setelah cutoff, beri tahu Admin bahwa draf batch siap disetujui; saat mendekati
// jam berangkat (Admin Settings: batchReminderMinutes), kirim pengingat keras. Tidak pernah menyetujui otomatis.
function startDeliveryDraftJob(repository, { intervalMs = 60000 } = {}) {
  const service = createDeliveryService(repository);
  const tick = async () => {
    try {
      const deliveryDate = jakartaDate();
      const draft = await service.drafts({ deliveryDate });
      const now = Date.now();
      if (!draft.total || now >= new Date(draft.dispatchAt).getTime()) return;
      const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(draft.dispatchAt));
      if (now >= new Date(draft.cutoffAt).getTime()) await notifyAdmins(repository, { type: "DELIVERY_DRAFT_READY", title: "Draf batch pengiriman siap", body: `${draft.total} pesanan untuk pengiriman hari ini sudah disusun otomatis. Periksa dan setujui sebelum kurir berangkat pukul ${time}.`, entityType: "DELIVERY_DRAFT", dedupeKey: `delivery-draft-ready:${deliveryDate}` });
      if (now >= new Date(draft.reminderAt).getTime()) await notifyAdmins(repository, { type: "DELIVERY_APPROVAL_REMINDER", title: "Segera setujui batch pengiriman", body: `${draft.total} pesanan belum masuk batch. Kurir berangkat pukul ${time}; tanpa persetujuan, pesanan tidak akan diantar.`, entityType: "DELIVERY_DRAFT", dedupeKey: `delivery-approval-reminder:${deliveryDate}` });
    } catch (error) { console.warn(`[delivery-draft-job] ${error.message}`); }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}

module.exports = { startDeliveryDraftJob };
