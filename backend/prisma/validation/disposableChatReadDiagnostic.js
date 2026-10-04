const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const database = (await prisma.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
  if (database !== "kucur_cutover_test") throw new Error(`Chat diagnostic refused database ${database}`);
  const messages = await prisma.message.findMany({ where: { message: { startsWith: "Pesan e2e-chat-" } }, include: { reads: true }, orderBy: { createdAt: "desc" }, take: 5 });
  const merchantUserId = "00000000-0000-4000-8000-000000000003";
  const unread = await prisma.message.findMany({ where: { senderUserId: { not: merchantUserId }, conversation: { participants: { some: { userId: merchantUserId, leftAt: null } } }, reads: { none: { userId: merchantUserId } } }, select: { id: true, conversationId: true, message: true } });
  console.log(`CHAT_READ_DIAGNOSTIC_JSON=${JSON.stringify({ messages: messages.map((row) => ({ id: row.id, conversationId: row.conversationId, senderUserId: row.senderUserId, message: row.message, reads: row.reads.map((read) => ({ userId: read.userId, readAt: read.readAt })) })), unread })}`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
