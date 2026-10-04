const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const database = (await prisma.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
  if (database !== "kucur_cutover_test") throw new Error(`Disposable inventory refused database ${database}`);
  const rows = await prisma.$queryRawUnsafe("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const legacy = rows.map((row) => row.name).filter((name) => name !== "_prisma_migrations" && name === name.toLowerCase());
  const target = rows.map((row) => row.name).filter((name) => name !== "_prisma_migrations" && name !== name.toLowerCase());
  const counts = {};
  for (const name of legacy) counts[name] = Number((await prisma.$queryRawUnsafe(`SELECT COUNT(*) n FROM \`${name}\``))[0].n);
  console.log(`DISPOSABLE_INVENTORY_JSON=${JSON.stringify({ database, legacyTableCount: legacy.length, targetTableCount: target.length, counts })}`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
