const express = require("express");
const { createUserController } = require("../controllers/userController");

module.exports = ({ userService, authMiddleware }) => {
  const router = express.Router();
  const controller = createUserController(userService);
  router.use(authMiddleware.requireAuth);
  router.get("/", authMiddleware.requireRole("admin"), controller.list);
  router.post("/couriers", authMiddleware.requireRole("admin"), controller.createCourier);
  router.patch("/me", controller.updateProfile);
  router.put("/me/avatar", controller.updateAvatar);
  router.delete("/me/avatar", controller.removeAvatar);
  router.post("/me/password/verify", controller.verifyCurrentPassword);
  router.patch("/me/password", controller.updatePassword);
  router.patch("/me/preferences", controller.updatePreferences);
  router.put("/me/addresses", controller.updateAddresses);
  router.post("/:userId/password-reset", authMiddleware.requireRole("admin"), controller.adminResetPassword);
  return router;
};
