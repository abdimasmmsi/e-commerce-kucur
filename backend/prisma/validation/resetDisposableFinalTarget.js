const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const database = (await prisma.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
  if (database !== "kucur_cutover_test") throw new Error(`Target reset refused database ${database}`);
  const delegates = [
    "targetNotification", "targetMessage", "targetConversation", "targetReview",
    "targetDeliveryBatchOrder", "targetDeliveryBatch", "targetPaymentAttempt", "targetMerchantFee",
    "targetCommerceOrderItem", "targetCommerceOrder", "targetCartItem", "targetCart",
    "targetProductVariant", "targetProduct", "targetCourierProfile", "targetStore",
    "targetPlatformSettings", "targetSession", "targetUserRole", "targetUser",
  ];
  const removed = {};
  await prisma.$transaction(async (tx) => {
    for (const delegate of delegates) {
      if (delegate !== "targetMerchantFee") { removed[delegate] = (await tx[delegate].deleteMany()).count; continue; }
      removed[delegate] = 0;
      for (;;) {
        const count = (await tx.targetMerchantFee.deleteMany({ where: { children: { none: {} } } })).count;
        removed[delegate] += count;
        if (!count) break;
      }
      if (await tx.targetMerchantFee.count()) throw new Error("MerchantFee hierarchy contains a cycle");
    }
  }, { timeout: 30000 });
  console.log(`DISPOSABLE_TARGET_RESET_JSON=${JSON.stringify({ database, removed })}`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
