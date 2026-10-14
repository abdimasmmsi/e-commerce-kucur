const { runWithReadContext } = require("../repositories/repositoryReadContext");
const { notifySafe } = require("./notifyHelpers");

// Pemeliharaan ringan yang jalan sendiri (tiap jam dan sekali saat server menyala):
// 1) Bersihkan sesi login yang sudah kedaluwarsa/dicabut lebih dari 7 hari (tabel Session tidak menumpuk selamanya).
// 2) Ingatkan penjual bila pesanan masih "Menunggu" lebih dari 6 jam (sekali per pesanan). Tidak membatalkan apa pun.
// Gagal hanya dicatat dengan console.warn; job tidak pernah melempar error.
const SESSION_RETENTION_DAYS = 7;
const WAITING_ORDER_HOURS = Number(process.env.ORDER_WAITING_REMINDER_HOURS || 6);
const LOOKBACK_DAYS = 7;

async function purgeExpiredSessions(prisma, now = new Date(), retentionDays = SESSION_RETENTION_DAYS) {
  const before = new Date(new Date(now).getTime() - retentionDays * 86400000);
  const result = await prisma.targetSession.deleteMany({ where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] } });
  return result.count;
}

async function remindWaitingOrders(repository, now = new Date(), hours = WAITING_ORDER_HOURS) {
  const current = new Date(now).getTime();
  const since = new Date(current - LOOKBACK_DAYS * 86400000);
  const orders = await runWithReadContext("/api/orders", () => repository.commerce.listOrders({ since, limit: 2000 }));
  const waiting = (orders || []).filter((order) => order.fulfillmentStatus === "pending" && current - new Date(order.createdAt).getTime() >= hours * 3600000);
  if (!waiting.length) return 0;
  const stores = new Map((await runWithReadContext("/api/stores", () => repository.stores.list())).map((store) => [store.id, store]));
  const items = [];
  for (const order of waiting) {
    const store = stores.get(order.storeId);
    if (!store?.merchantUserId || store.status === "suspended_admin_fee") continue;
    items.push({ userId: store.merchantUserId, type: "ORDER_WAITING_REMINDER", title: "Pesanan menunggu tanggapan", body: `Pesanan ${order.orderCode || order.id} belum diterima lebih dari ${hours} jam. Terima atau batalkan di Pesanan supaya pembeli tidak menunggu.`, entityType: "COMMERCE_ORDER", entityId: order.id, dedupeKey: `order-waiting:${order.id}` });
  }
  await notifySafe(repository, items);
  return items.length;
}

function startMaintenanceJob(repository, { intervalMs = 60 * 60 * 1000, prisma } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const client = prisma || require("../config/prisma").getPrisma();
      const purged = await purgeExpiredSessions(client);
      if (purged) console.log(`[maintenance-job] ${purged} sesi kedaluwarsa dibersihkan`);
    } catch (error) { console.warn(`[maintenance-job] sesi: ${error.message}`); }
    try { await remindWaitingOrders(repository); } catch (error) { console.warn(`[maintenance-job] pesanan menunggu: ${error.message}`); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}

module.exports = { startMaintenanceJob, purgeExpiredSessions, remindWaitingOrders, WAITING_ORDER_HOURS };
