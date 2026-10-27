const express = require("express");
const path = require("node:path");
const cors = require("cors");
const env = require("./config/env");
const { createApiRateLimits } = require("./middleware/rateLimit");
const dataEvents = require("./services/dataEventBus");
const { createPrismaRepository } = require("./repositories/prismaRepository");
const { createFinalPrismaRepository } = require("./repositories/finalPrismaRepository");
const { createRepositoryReadRouter } = require("./repositories/repositoryReadRouter");
const { readContextMiddleware } = require("./repositories/repositoryReadContext");
const { createShadowWriteSynchronizer } = require("./repositories/shadowWriteSynchronizer");
const { createFinalLegacyMirrorSynchronizer } = require("./repositories/finalLegacyMirrorSynchronizer");
const { createRepositoryWriteRouter } = require("./repositories/repositoryWriteRouter");
const { createAuthService } = require("./services/authService");
const { createStoreService } = require("./services/storeService");
const { createSettingsService } = require("./services/settingsService");
const { createUserService } = require("./services/userService");
const { createProductService } = require("./services/productService");
const { createCartService } = require("./services/cartService");
const { createCommerceService } = require("./services/commerceService");
const { createFinanceService } = require("./services/financeService");
const { createReviewService } = require("./services/reviewService");
const { createNotificationService } = require("./services/notificationService");
const { createChatService } = require("./services/chatService");
const { createDeliveryService } = require("./services/deliveryService");
const { createAuthMiddleware } = require("./middleware/auth");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const createAuthRoutes = require("./routes/authRoutes");
const createStoreRoutes = require("./routes/storeRoutes");
const { createStoreFinanceRoutes, createContributionRoutes, createAdminFinanceRoutes } = require("./routes/financeRoutes");
const createSettingsRoutes = require("./routes/settingsRoutes");
const createGeoRoutes = require("./routes/geoRoutes");
const { createGeoService } = require("./services/geoService");
const createUserRoutes = require("./routes/userRoutes");
const createProductRoutes = require("./routes/productRoutes");
const { createCartRoutes, createCheckoutRoutes, createOrderRoutes } = require("./routes/commerceRoutes");
const createCommercePaymentRoutes = require("./routes/commercePaymentRoutes");
const createReviewRoutes = require("./routes/reviewRoutes");
const createNotificationRoutes = require("./routes/notificationRoutes");
const createChatRoutes = require("./routes/chatRoutes");
const { adminRoutes: createAdminDeliveryRoutes, courierRoutes: createCourierDeliveryRoutes, merchantRoutes: createMerchantDeliveryRoutes } = require("./routes/deliveryRoutes");

function createApp(options = {}) {
  const legacyRepository = options.repository || createPrismaRepository();
  const finalRepository = options.finalRepository || (!options.repository ? createFinalPrismaRepository() : null);
  const shadowSynchronizer = options.shadowSynchronizer || createShadowWriteSynchronizer({ enabled: process.env.FINAL_REPOSITORY_SHADOW_SYNC_WRITES === "true", nodeEnv: env.nodeEnv });
  const legacyMirrorSynchronizer = options.legacyMirrorSynchronizer || createFinalLegacyMirrorSynchronizer(legacyRepository, { enabled: process.env.FINAL_REPOSITORY_LEGACY_MIRROR_WRITES === "true", nodeEnv: env.nodeEnv });
  const allowProductionFinal = env.nodeEnv !== "production" || process.env.FINAL_REPOSITORY_ALLOW_FINAL_IN_PRODUCTION === "true";
  const allowFinalReads = allowProductionFinal && process.env.FINAL_REPOSITORY_READ_MODE === "final";
  const allowFinalWrites = allowProductionFinal && process.env.FINAL_REPOSITORY_WRITE_MODE === "final";
  const writeRepository = finalRepository ? createRepositoryWriteRouter(legacyRepository, finalRepository, { allowFinal: allowFinalWrites, ...(options.writeRouter || {}), mirrorSynchronizer: legacyMirrorSynchronizer }) : legacyRepository;
  const repository = finalRepository ? createRepositoryReadRouter(writeRepository, finalRepository, { allowFinal: allowFinalReads, ...(options.readRouter || {}), shadowSynchronizer }) : legacyRepository;
  const authService = options.authService || createAuthService(repository);
  const authMiddleware = createAuthMiddleware(authService);
  require("./services/pushService").setRepository(repository);
  const notificationService = createNotificationService(repository); const dependencies = { repository, authService, authMiddleware, authRateLimits: options.authRateLimits, notificationService, chatService: createChatService(repository), deliveryService: createDeliveryService(repository), storeService: createStoreService(repository), productService: createProductService(repository), cartService: createCartService(repository), commerceService: createCommerceService(repository), financeService: createFinanceService(repository), reviewService: createReviewService(repository, notificationService), settingsService: createSettingsService(repository), geoService: options.geoService || createGeoService(), userService: createUserService(repository) };
  const app = express();
  app.disable("x-powered-by");
  // Header keamanan dasar (tanpa dependensi). API hanya JSON + serve /uploads; CSP ketat & anti-clickjacking.
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    // Gambar /uploads dimuat lintas-origin oleh frontend (port beda), jadi izinkan secara eksplisit.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    // HSTS hanya berarti di HTTPS; diaktifkan di produksi (browser mengabaikannya di HTTP).
    if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    return next();
  });
  // Proxy Vite (dev:phone) berjalan di laptop yang sama, jadi hanya proxy loopback yang dipercaya:
  // req.ip diambil dari X-Forwarded-For hanya bila koneksi datang dari 127.0.0.1/::1 (dipakai rate limit auth).
  // Di server (Caddy/Nginx di depan backend, mis. container Docker) set TRUST_PROXY ke "uniquelocal" (jaringan privat) atau jumlah hop
  // ("1"); tanpa itu semua pengguna terlihat berasal dari IP proxy dan batas permintaan per IP mengenai semua orang sekaligus.
  const trustProxy = process.env.TRUST_PROXY;
  app.set("trust proxy", trustProxy === undefined || trustProxy === "" ? "loopback" : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.use(cors({ origin(origin, callback) { if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true); return callback(null, false); }, credentials: false }));
  // Batas permintaan seluruh API (login/daftar punya batas sendiri di authRoutes).
  const apiLimits = options.apiRateLimits || createApiRateLimits();
  app.use("/api", apiLimits.general);
  app.use("/api", (req, res, next) => (["GET", "HEAD", "OPTIONS"].includes(req.method) ? next() : apiLimits.writes(req, res, next)));
  app.post("/api/checkout/orders", apiLimits.checkout);
  app.post("/api/conversations/:conversationId/messages", apiLimits.chatSend);
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(path.resolve(__dirname, "uploads"), { immutable: true, maxAge: "7d", fallthrough: true }));
  app.use(readContextMiddleware);
  // Aksi yang berhasil memberi sinyal "data berubah": ke semua admin yang sedang membuka panel dan ke perangkat lain milik pelaku.
  // Pihak lain yang terdampak dikabari lewat pembuatan notifikasi (finalPrismaRepository).
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) res.on("finish", () => { if (res.statusCode < 400) dataEvents.publish({ roles: ["admin"], userIds: req.auth?.user?.id ? [req.auth.user.id] : [] }); });
    next();
  });
  app.get("/",(req, res) => { void req; res.json({ data: { message: "Kucur Platform API is running" } }); });
  app.get("/health/live", (req, res) => { void req; res.json({ data: { status: "alive" } }); });
  app.get("/health/ready", async (req, res, next) => { try { await repository.health(); res.json({ data: { status: "ready", database: "reachable" } }); } catch (error) { next(error); } });
  if (env.nodeEnv !== "production") app.get("/health/repository-routing", (req, res) => { void req; res.json({ data: { read: { config: repository.config || { mode: "legacy" }, summary: repository.metrics?.summary?.() || null, unsafeDomains: [...(repository.unsafe || [])] }, write: { config: writeRepository.config || { mode: "legacy" }, summary: writeRepository.metrics?.summary?.() || null, unsafeDomains: [...(writeRepository.unsafeDomains || [])], unsafeEntities: [...(writeRepository.unsafeEntities || [])], events: (writeRepository.metrics?.events || []).slice(-200) } } }); });
  app.use("/api/auth", createAuthRoutes(dependencies));
  app.use("/api/users", createUserRoutes(dependencies));
  app.use("/api/stores", createStoreRoutes(dependencies));
  app.use("/api/stores", createStoreFinanceRoutes(dependencies));
  app.use("/api/users", createContributionRoutes(dependencies));
  app.use("/api/admin/finance", createAdminFinanceRoutes(dependencies));
  app.use("/api/products", createProductRoutes(dependencies));
  app.use("/api/cart", createCartRoutes(dependencies));
  app.use("/api/checkout", createCheckoutRoutes(dependencies));
  app.use("/api/orders", createOrderRoutes(dependencies));
  app.use("/api/settings", createSettingsRoutes(dependencies));
  app.use("/api/geo", createGeoRoutes(dependencies));
  app.use("/api/payments", createCommercePaymentRoutes(dependencies));
  app.use("/api", createReviewRoutes(dependencies));
  app.use("/api/notifications", createNotificationRoutes(dependencies));
  app.use("/api/conversations", createChatRoutes(dependencies));
  app.use("/api/courier", createCourierDeliveryRoutes(dependencies));
  app.use("/api/merchant", createMerchantDeliveryRoutes(dependencies));
  app.use("/api/admin/delivery", createAdminDeliveryRoutes(dependencies));
  app.use(notFoundHandler);
  app.use(errorHandler);
  app.locals.dependencies = dependencies;
  app.locals.repositoryRead = { config: repository.config || { mode: "legacy" }, metrics: repository.metrics || null };
  app.locals.repositoryWrite = { config: writeRepository.config || { mode: "legacy" }, metrics: writeRepository.metrics || null };
  return app;
}

module.exports = { createApp };
