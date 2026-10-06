const express = require("express");

const handler = (work, status = 200) => async (req, res, next) => { try { res.status(status).json({ data: await work(req) }); } catch (error) { next(error); } };

const createStoreFinanceRoutes = ({ financeService, authMiddleware }) => {
  const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("merchant", "admin"));
  router.get("/:storeId/finance", handler((req) => financeService.summary(String(req.params.storeId), req.auth.user)));
  router.get("/:storeId/finance/initial-fee", handler((req) => financeService.getInitialFee(String(req.params.storeId), req.auth.user)));
  router.post("/:storeId/finance/initial-fee/setup", authMiddleware.requireRole("merchant"), handler((req) => financeService.setupInitialFee(String(req.params.storeId), req.body || {}, req.auth.user), 201));
  router.post("/:storeId/finance/installments/:installmentId/pay", authMiddleware.requireRole("merchant"), handler((req) => financeService.submitInstallmentPayment(String(req.params.storeId), String(req.params.installmentId), req.body || {}, req.auth.user), 201));
  router.get("/:storeId/finance/admin-fees", handler(async (req) => (await financeService.summary(String(req.params.storeId), req.auth.user)).adminFee));
  router.post("/:storeId/finance/admin-fees/settlements", authMiddleware.requireRole("merchant"), handler((req) => financeService.createSettlement(String(req.params.storeId), req.body || {}, req.auth.user), 201));
  return router;
};

const createContributionRoutes = ({ financeService, authMiddleware }) => { const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("merchant")); router.get("/me/contributions", handler((req) => financeService.listContributions(req.auth.user))); router.post("/me/contributions", handler((req) => financeService.createContribution(req.body || {}, req.auth.user), 201)); return router; };
const createAdminFinanceRoutes = ({ financeService, authMiddleware }) => { const router = express.Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole("admin")); router.get("/", handler((req) => financeService.monitoring(req.auth.user))); router.post("/reconcile-installments", handler((req) => financeService.reconcileInstallments(new Date(), req.auth.user))); router.post("/reconcile-admin-fees", handler((req) => financeService.reconcileAdminFees(new Date(), req.auth.user))); router.post("/remind", handler((req) => financeService.remindOutstanding(req.auth.user, req.body || {}))); router.post("/payments/:kind/:paymentId/confirm", handler((req) => financeService.confirmPayment(String(req.params.kind), String(req.params.paymentId), req.auth.user, req.body?.approved !== false))); return router; };

module.exports = { createStoreFinanceRoutes, createContributionRoutes, createAdminFinanceRoutes };
