const { getPrisma, disconnectPrisma } = require("../../config/prisma");

const FINAL_TABLES = new Set(["User", "UserRole", "Session", "PlatformSettings", "Store", "Product", "ProductVariant", "Cart", "CartItem", "CommerceOrder", "CommerceOrderItem", "PaymentAttempt", "MerchantFee", "CourierProfile", "DeliveryBatch", "DeliveryBatchOrder", "Review", "Conversation", "Message", "Notification"]);
const quote = (name) => `\`${String(name).replaceAll("`", "``")}\``;

async function main() {
  const prisma = getPrisma();
  const database = (await prisma.$queryRaw`SELECT DATABASE() name`)[0].name;
  if (!["kucur", "kucur_cutover_test"].includes(database)) throw new Error(`Final integrity validation refused database ${database}`);
  const foreignKeys = await prisma.$queryRawUnsafe("SELECT TABLE_NAME tableName,COLUMN_NAME columnName,REFERENCED_TABLE_NAME referencedTable,REFERENCED_COLUMN_NAME referencedColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
  const orphanChecks = [];
  for (const fk of foreignKeys.filter((row) => FINAL_TABLES.has(row.tableName))) {
    const sql = `SELECT COUNT(*) count FROM ${quote(fk.tableName)} child LEFT JOIN ${quote(fk.referencedTable)} parent ON child.${quote(fk.columnName)}=parent.${quote(fk.referencedColumn)} WHERE child.${quote(fk.columnName)} IS NOT NULL AND parent.${quote(fk.referencedColumn)} IS NULL`;
    const count = Number((await prisma.$queryRawUnsafe(sql))[0].count);
    orphanChecks.push({ ...fk, count });
  }
  const paymentXorViolations = Number((await prisma.$queryRawUnsafe("SELECT COUNT(*) count FROM `PaymentAttempt` WHERE (`commerceOrderId` IS NULL)=(`merchantFeeId` IS NULL)"))[0].count);
  const result = { database, finalTableCount: FINAL_TABLES.size, foreignKeysChecked: orphanChecks.length, orphanCount: orphanChecks.reduce((sum, row) => sum + row.count, 0), paymentXorViolations, passed: orphanChecks.every((row) => row.count === 0) && paymentXorViolations === 0 };
  console.log(`FINAL_INTEGRITY_JSON=${JSON.stringify(result)}`);
  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(disconnectPrisma);
