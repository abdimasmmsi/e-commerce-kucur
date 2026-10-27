const express = require("express");

module.exports = ({ geoService, authMiddleware }) => {
  const router = express.Router();
  router.get("/reverse", authMiddleware.requireAuth, async (req, res, next) => {
    try { res.json({ data: await geoService.reverse(req.query.latitude, req.query.longitude) }); } catch (error) { next(error); }
  });
  return router;
};
