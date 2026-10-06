const { getPrisma, disconnectPrisma } = require("../../config/prisma");
const { randomUUID } = require("node:crypto");

async function main() {
  const prisma = getPrisma();
  const database = (await prisma.$queryRaw`SELECT DATABASE() name`)[0].name;
  if (database !== "kucur") throw new Error(`Final-mode fixture preparation refused database ${database}`);
  const storeId = "12000000-0000-4000-8000-000000000001";
  const customerUserId = "00000000-0000-4000-8000-000000000002";
  // Test tema/bahasa mengubah preferensi akun QA; kembalikan ke default (Indonesia, terang).
  await prisma.targetUser.updateMany({ where: { email: { endsWith: "@kucur.test" } }, data: { language: "id", theme: "light" } });
  // Test commerce membeli produk QA B setiap run; isi ulang stok supaya e2e bisa diulang.
  await prisma.targetProduct.update({ where: { id: "20000000-0000-4000-8000-000000000003" }, data: { stock: 20 } });
  // Test FAQ Chatbot menambah FAQ admin; kosongkan lagi.
  await prisma.targetPlatformSettings.updateMany({ data: { faqEntries: null } });
  // Test tambah kurir membuat akun kurir.e2e.*; hapus supaya daftar kurir tidak menumpuk.
  const testCouriers = await prisma.targetUser.findMany({ where: { email: { startsWith: "kurir.e2e." } }, select: { id: true } });
  for (const { id } of testCouriers) {
    try { await prisma.targetSession.deleteMany({ where: { userId: id } }); await prisma.targetCourierProfile.deleteMany({ where: { userId: id } }); await prisma.targetUserRole.deleteMany({ where: { userId: id } }); await prisma.targetUser.delete({ where: { id } }); } catch (error) { console.warn(`Skip cleanup ${id}: ${error.message}`); }
  }
  // Test cuti kurir menambah pengajuan; kosongkan riwayat cuti kurir QA.
  const courier = await prisma.targetUser.findFirst({ where: { email: "courier@kucur.test" } });
  if (courier) await prisma.targetCourierProfile.updateMany({ where: { userId: courier.id }, data: { availabilityHistory: [], availabilityStatus: "AVAILABLE", unavailableStartAt: null, unavailableEndAt: null, unavailableReason: null } });
  const store = await prisma.targetStore.update({ where: { id: storeId }, data: { status: "PENDING", reviewedByUserId: null, reviewedAt: null, rejectionReason: null } });
  let notification = await prisma.targetNotification.findFirst({ where: { userId: customerUserId }, orderBy: { createdAt: "desc" } });
  if (!notification) {
    const order = await prisma.targetCommerceOrder.findFirst({ where: { customerUserId }, orderBy: { createdAt: "desc" } });
    if (!order) throw new Error("Customer QA order fixture is missing");
    notification = await prisma.targetNotification.create({ data: { id: randomUUID(), userId: customerUserId, type: "COMMERCE_ORDER_STATUS_CHANGED", title: "Status pesanan diperbarui", body: `Status pesanan #${order.orderCode} diperbarui.`, entityType: "COMMERCE_ORDER", entityId: order.id, dedupeKey: `final-e2e-notification:${order.id}` } });
  } else await prisma.targetNotification.update({ where: { id: notification.id }, data: { readAt: null } });
  console.log(`FINAL_E2E_FIXTURE_JSON=${JSON.stringify({ database, storeId: store.id, notificationId: notification.id })}`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(disconnectPrisma);
