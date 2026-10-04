const crypto = require("node:crypto");
const fs = require("node:fs");
const { Prisma } = require("@prisma/client");
const { getPrisma, disconnectPrisma } = require("../../config/prisma");

const prisma = getPrisma();
const delegates = ["targetUser","targetUserRole","targetSession","targetPlatformSettings","targetStore","targetProduct","targetProductVariant","targetCart","targetCartItem","targetCommerceOrder","targetCommerceOrderItem","targetPaymentAttempt","targetMerchantFee","targetCourierProfile","targetDeliveryBatch","targetDeliveryBatchOrder","targetReview","targetConversation","targetMessage","targetNotification"];
const stable = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
};
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
async function main() {
  const database = (await prisma.$queryRaw`SELECT DATABASE() name`)[0].name;
  if (database !== "kucur") throw new Error(`Safety snapshot hanya untuk main kucur, current=${database}`);
  const legacyTables = await prisma.$queryRawUnsafe("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME<>'_prisma_migrations' AND BINARY TABLE_NAME=BINARY LOWER(TABLE_NAME) ORDER BY TABLE_NAME");
  const legacyCounts = {};
  const legacy = {};
  for (const { name } of legacyTables) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${name}\` ORDER BY 1`);
    legacyCounts[name] = rows.length;
    legacy[name] = { count: rows.length, sha256: hash(rows) };
  }
  const targets = {};
  for (const delegate of delegates) {
    const rows = await prisma[delegate].findMany();
    const ordered = rows.sort((a,b)=>JSON.stringify(stable(a)).localeCompare(JSON.stringify(stable(b))));
    targets[delegate] = { count: rows.length, sha256: hash(ordered) };
  }
  const snapshot = { database, capturedAt: new Date().toISOString(), legacyCounts, legacy, targets };
  if (process.env.MAIN_DB_SAFETY_OUTPUT) {
    const output = require("node:path").resolve(process.env.MAIN_DB_SAFETY_OUTPUT);
    const reportRoot = require("node:path").resolve(__dirname, "../reports");
    if (!output.startsWith(`${reportRoot}${require("node:path").sep}`)) throw new Error("Safety snapshot output must stay inside prisma/reports");
    fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  }
  console.log(`MAIN_DB_SAFETY_JSON=${JSON.stringify(snapshot)}`);
  if (process.env.MAIN_DB_SAFETY_BASELINE) {
    const before = JSON.parse(fs.readFileSync(process.env.MAIN_DB_SAFETY_BASELINE, "utf8"));
    const legacyDifferences = Object.keys(before.legacyCounts).filter((table) => !["sessions", "audit_records"].includes(table) && (before.legacy?.[table]?.sha256 ? before.legacy[table].sha256 !== legacy[table].sha256 : before.legacyCounts[table] !== legacyCounts[table])).map((table) => ({ table, before: before.legacy?.[table] || before.legacyCounts[table], after: legacy[table] }));
    const targetDifferences = Object.keys(before.targets).filter((delegate) => before.targets[delegate].count !== targets[delegate].count || before.targets[delegate].sha256 !== targets[delegate].sha256).map((delegate) => ({ delegate, before: before.targets[delegate], after: targets[delegate] }));
    console.log(`MAIN_DB_SAFETY_COMPARISON_JSON=${JSON.stringify({ legacyDifferences, targetDifferences, contamination: legacyDifferences.length > 0 || targetDifferences.length > 0 })}`);
    if (legacyDifferences.length || targetDifferences.length) process.exitCode = 1;
  }
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(disconnectPrisma);
