require("dotenv").config();
const { createServer } = require("node:http");
const { createApp } = require("./app");
const { attachChatRealtime } = require("./realtime/chatRealtime");
const env = require("./config/env");
const { connectPrisma, disconnectPrisma } = require("./config/prisma");
const { startDeliveryDraftJob } = require("./services/deliveryDraftJob");
const { startFinanceReconcileJob } = require("./services/financeReconcileJob");
async function start() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL wajib dikonfigurasi untuk menjalankan backend.");
  await connectPrisma();
  const app = createApp();
  const server = createServer(app);
  const stopDraftJob = startDeliveryDraftJob(app.locals.dependencies.repository);
  const stopFinanceJob = startFinanceReconcileJob(app.locals.dependencies.repository, { financeService: app.locals.dependencies.financeService });
  const io = attachChatRealtime(server, { ...app.locals.dependencies, allowedOrigins: env.allowedOrigins });
  server.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    console.log(`Repository routing: reads=${app.locals.repositoryRead.config.mode || "legacy"}, writes=${app.locals.repositoryWrite.config.mode || "legacy"}, shadowSync=${process.env.FINAL_REPOSITORY_SHADOW_SYNC_WRITES === "true"}, legacyMirror=${process.env.FINAL_REPOSITORY_LEGACY_MIRROR_WRITES === "true"}`);
  });
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down.`);
    stopDraftJob();
    stopFinanceJob();
    io.close();
    server.close(async () => { await disconnectPrisma(); process.exit(0); });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(async (error) => {
  console.error(`Backend startup failed: ${error.message}`);
  await disconnectPrisma();
  process.exit(1);
});
