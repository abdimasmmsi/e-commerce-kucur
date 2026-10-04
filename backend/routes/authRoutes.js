const express = require("express");
const { createAuthController } = require("../controllers/authController");

module.exports = ({ authService, authMiddleware }) => {
  const router = express.Router();
  const controller = createAuthController(authService);
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", authMiddleware.requireAuth, controller.me);
  router.post("/logout", authMiddleware.requireAuth, controller.logout);
  return router;
};
