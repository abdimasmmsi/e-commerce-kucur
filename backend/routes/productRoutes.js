const express = require("express");
const { createProductController } = require("../controllers/productController");
module.exports = ({ productService, authMiddleware }) => {
  const router = express.Router(); const controller = createProductController(productService);
  router.get("/", authMiddleware.optionalAuth, controller.list);
  router.get("/:productId", authMiddleware.optionalAuth, controller.get);
  router.post("/", authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"), controller.create);
  router.patch("/:productId", authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"), controller.update);
  return router;
};
