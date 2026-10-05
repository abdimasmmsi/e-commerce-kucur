const express = require("express");
const { createSettingsController } = require("../controllers/settingsController");

module.exports = ({ settingsService, authMiddleware }) => {
  const router = express.Router();
  const controller = createSettingsController(settingsService);
  router.get("/faq", controller.faq);
  router.get("/", authMiddleware.requireAuth, controller.get);
  router.patch("/", authMiddleware.requireAuth, authMiddleware.requireRole("admin"), controller.update);
  return router;
};
