const express = require("express");
const { createStoreController } = require("../controllers/storeController");
const { saveStoreImage } = require("../services/storeImageService");

module.exports = ({ repository, storeService, authMiddleware }) => {
  const router = express.Router();
  const controller = createStoreController(storeService);
  router.use(authMiddleware.requireAuth);
  router.get("/", authMiddleware.requireRole("customer", "merchant", "admin"), controller.list);
  router.get("/applications", authMiddleware.requireRole("admin"), controller.applications);
  router.get("/applications/:storeId", authMiddleware.requireRole("admin"), controller.application);
  router.patch("/applications/:storeId/review", authMiddleware.requireRole("admin"), controller.reviewApplication);
  router.post("/images", authMiddleware.requireRole("merchant"), async (req, res, next) => {
    try {
      const relativeUrl = await saveStoreImage(req.body?.dataUrl);
      res.status(201).json({ data: { url: `${req.protocol}://${req.get("host")}${relativeUrl}` } });
    } catch (error) { next(error); }
  });
  router.get("/:storeId", authMiddleware.requireRole("customer", "merchant", "admin"), controller.get);
  router.post("/", authMiddleware.requireRole("customer", "merchant"), controller.create);
  router.patch("/:storeId/availability", authMiddleware.requireRole("merchant"), authMiddleware.requireStoreOwnership(repository), controller.availability);
  router.patch("/:storeId", authMiddleware.requireRole("merchant", "admin"), authMiddleware.requireStoreOwnership(repository), controller.update);
  return router;
};
