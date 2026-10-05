const express = require("express");
const { createAuthController } = require("../controllers/authController");
const { createAuthRateLimits } = require("../middleware/rateLimit");

module.exports = ({ authService, authMiddleware, authRateLimits }) => {
  const router = express.Router();
  const controller = createAuthController(authService);
  const limits = authRateLimits || createAuthRateLimits();
  router.post("/register", limits.register, controller.register);
  router.get("/email-status", limits.emailStatus, controller.emailStatus);
  router.post("/login", limits.loginPerIp, limits.loginPerAccount, controller.login);
  router.get("/me", authMiddleware.requireAuth, controller.me);
  router.post("/logout", authMiddleware.requireAuth, controller.logout);
  return router;
};
