const express = require("express");
const { createProductController } = require("../controllers/productController");
module.exports = ({ productService, authMiddleware }) => {
  const router = express.Router(); const controller = createProductController(productService);
  router.get("/", authMiddleware.optionalAuth, controller.list);
  router.get("/:productId", authMiddleware.optionalAuth, controller.get);
  router.post("/:productId/view", controller.recordView);
  router.get("/:productId/restock-watch", authMiddleware.requireAuth, authMiddleware.requireRole("customer"), controller.restockStatus);
  router.post("/:productId/restock-watch", authMiddleware.requireAuth, authMiddleware.requireRole("customer"), controller.watchRestock);
  router.delete("/:productId/restock-watch", authMiddleware.requireAuth, authMiddleware.requireRole("customer"), controller.unwatchRestock);
  router.get("/store/:storeId/views", authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"), controller.storeViews);
  router.post("/", authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"), controller.create);
  router.patch("/:productId", authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"), controller.update);
  return router;
};
