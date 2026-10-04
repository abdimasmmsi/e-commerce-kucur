const { saveProofImage } = require("../services/storeImageService");
const express = require("express");
const handler = (work, status = 200) => async (req, res, next) => { try { res.status(status).json({ data: await work(req) }); } catch (error) { next(error); } };

function courierRoutes({ deliveryService, authMiddleware }) {
  const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("courier"));
  router.get("/profile", handler((req) => deliveryService.profile(req.auth.user)));
  router.get("/availability", handler((req) => deliveryService.availability(req.auth.user)));
  router.post("/availability", handler((req) => deliveryService.createAvailability(req.body || {}, req.auth.user), 201));
  router.patch("/availability/:id/end", handler((req) => deliveryService.endAvailability(req.params.id, req.auth.user)));
  router.get("/batches", handler((req) => deliveryService.batches(req.auth.user, req.query)));
  router.get("/batches/:id", handler((req) => deliveryService.batch(req.params.id, req.auth.user)));
  router.post("/batches/:id/start", handler((req) => deliveryService.startBatch(req.params.id, req.auth.user)));
  router.patch("/deliveries/:id/pickup", handler((req) => deliveryService.pickup(req.params.id, req.body || {}, req.auth.user)));
  router.patch("/deliveries/:id/out-for-delivery", handler((req) => deliveryService.outForDelivery(req.params.id, req.body || {}, req.auth.user)));
  router.patch("/deliveries/:id/failed", handler((req) => deliveryService.failed(req.params.id, req.body || {}, req.auth.user)));
  // Kurir boleh mengirim foto langsung (photoDataUrl); disimpan dulu lalu dicatat sebagai photoUrl.
  router.post("/deliveries/:id/proof", handler(async (req) => {
    const input = { ...(req.body || {}) };
    if (input.photoDataUrl) { input.photoUrl = `${req.protocol}://${req.get("host")}${await saveProofImage(input.photoDataUrl)}`; delete input.photoDataUrl; }
    return deliveryService.proof(req.params.id, input, req.auth.user);
  }, 201));
  return router;
}

function merchantRoutes({ deliveryService, authMiddleware }) {
  const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("merchant"));
  router.get("/delivery-orders", handler((req) => deliveryService.merchantOrders(req.auth.user)));
  router.post("/orders/:id/pickup-confirmation", handler((req) => deliveryService.confirmReady(req.params.id, req.body || {}, req.auth.user), 201));
  return router;
}

function adminRoutes({ deliveryService, authMiddleware }) {
  const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("admin"));
  router.get("/eligible-orders", handler((req) => deliveryService.eligible(req.query)));
  router.get("/couriers", handler(() => deliveryService.couriers()));
  router.get("/batches", handler((req) => deliveryService.batches(req.auth.user, req.query)));
  router.post("/batches", handler((req) => deliveryService.createBatch(req.body || {}, req.auth.user), 201));
  router.get("/batches/:id", handler((req) => deliveryService.batch(req.params.id, req.auth.user)));
  router.delete("/batches/:id/orders/:commerceOrderId", handler((req) => deliveryService.removeOrder(req.params.id, req.params.commerceOrderId, req.auth.user)));
  router.patch("/batches/:id/cancel", handler((req) => deliveryService.cancelBatch(req.params.id, req.auth.user)));
  router.patch("/batches/:id/complete", handler((req) => deliveryService.completeBatch(req.params.id, req.auth.user)));
  router.post("/orders/:commerceOrderId/rebatch", handler((req) => deliveryService.rebatch(req.params.commerceOrderId, req.body || {}, req.auth.user), 201));
  return router;
}

module.exports = { adminRoutes, courierRoutes, merchantRoutes };
