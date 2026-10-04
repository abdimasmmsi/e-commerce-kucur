const { getPrisma, disconnectPrisma } = require("../../config/prisma");
const { createPrismaRepository } = require("../../repositories/prismaRepository");
const { createFinalPrismaRepository } = require("../../repositories/finalPrismaRepository");
const { createRepositoryReadRouter } = require("../../repositories/repositoryReadRouter");

const stages = {
  0: { percent: 0, domains: [] },
  1: { percent: 100, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT"] },
  2: { percent: 100, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT", "CART", "REVIEW", "CHAT", "NOTIFICATION"] },
  3: { percent: 100, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT", "CART", "REVIEW", "CHAT", "NOTIFICATION", "COMMERCE", "PAYMENT", "FINANCE", "DELIVERY"] },
  4: { percent: 100, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT", "CART", "REVIEW", "CHAT", "NOTIFICATION", "COMMERCE", "PAYMENT", "FINANCE", "DELIVERY"] },
  A: { percent: 25, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT"], main: true },
  B: { percent: 50, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT", "CART", "REVIEW", "CHAT", "NOTIFICATION"], main: true },
  C: { percent: 100, domains: ["AUTH", "SETTINGS", "STORE", "PRODUCT", "CART", "REVIEW", "CHAT", "NOTIFICATION", "COMMERCE", "PAYMENT", "FINANCE", "DELIVERY"], main: true },
};

async function main() {
  const client = getPrisma(); const database = (await client.$queryRawUnsafe("SELECT DATABASE() name"))[0].name;
  const stage = String(process.argv[2] || "0").toUpperCase(); const policy = stages[stage]; if (!policy) throw new Error(`Unknown stage ${stage}`);
  const requiredDatabase = policy.main ? "kucur" : "kucur_cutover_test";
  if (database !== requiredDatabase) throw new Error(`Canary stage ${stage} refused database ${database}; required ${requiredDatabase}`);
  const legacy = createPrismaRepository(client); const final = createFinalPrismaRepository(client);
  const router = createRepositoryReadRouter(legacy, final, { mode: "canary", percent: policy.percent, domains: new Set(policy.domains) });
  const customer = await client.user.findFirst({ where: { email: "customer@kucur.test" } });
  const conversation = await client.conversation.findFirst({ orderBy: { createdAt: "asc" } });
  await router.users.findByEmail("customer@kucur.test"); await router.settings.get(); await router.stores.list(); await router.products.list();
  await router.commerce.getCart(customer.id); await router.reviews.list({ customerUserId: customer.id });
  if (conversation) await router.chats.find(conversation.id);
  await router.notifications.list({ where: { userId: customer.id }, skip: 0, take: 100 });
  await router.commerce.listOrders(); await router.finance.monitoring(); await router.delivery.listBatches();
  const output = { database, stage, policy, summary: router.metrics.summary(), performance: router.metrics.performance(), unsafeDomains: [...router.unsafe], events: router.metrics.events.map(({ differences, ...event }) => event) };
  console.log(`CANARY_STAGE_JSON=${JSON.stringify(output)}`);
  if (output.summary.unexpectedMismatches || output.summary.finalReadErrors) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(disconnectPrisma);
