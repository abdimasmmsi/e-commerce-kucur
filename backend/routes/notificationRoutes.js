const express = require("express");
const handler = (work) => async (req,res,next) => { try { res.json({ data: await work(req) }); } catch (error) { next(error); } };
module.exports = ({ notificationService, authMiddleware }) => { const router = express.Router(); router.use(authMiddleware.requireAuth);
  router.get("/", handler((req) => notificationService.list(req.auth.user, req.query)));
  router.get("/unread-count", handler((req) => notificationService.unreadCount(req.auth.user)));
  router.patch("/read-all", handler((req) => notificationService.markAllRead(req.auth.user)));
  router.patch("/:notificationId/read", handler((req) => notificationService.markRead(String(req.params.notificationId), req.auth.user, true)));
  router.patch("/:notificationId/unread", handler((req) => notificationService.markRead(String(req.params.notificationId), req.auth.user, false)));
  return router; };
