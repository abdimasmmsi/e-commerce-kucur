const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRepository } = require("./repositories/memoryRepository");
const { createFinanceService, generateCommerceFinance, toCents, addJakartaMonths, cutoffFor } = require("./services/financeService");

const merchant = { id: "MERCHANT", roles: ["merchant"] }; const admin = { id: "ADMIN", roles: ["admin"] };
const fixture = (settings = {}) => { const repository = createMemoryRepository({ users: [merchant, admin], stores: [{ id: "STORE", merchantUserId: merchant.id, name: "QA Store", type: "product", status: "active" }], settings }); return { repository, service: createFinanceService(repository) }; };

test("money helpers and calendar-month due dates remain exact", () => {
  assert.equal(toCents("500000.01"), 50000001n);
  const jan31 = new Date("2026-01-30T17:00:00.000Z");
  assert.equal(addJakartaMonths(jan31, 1).toISOString(), "2026-02-27T17:00:00.000Z");
  assert.equal(cutoffFor(new Date("2026-08-20T03:00:00Z"), 1, "12:00").toISOString(), "2026-09-01T05:00:00.000Z");
});

test("initial fee plans distribute exact remainder and snapshot settings", async () => {
  const { repository, service } = fixture({ initialStoreFeeAmount: 500000 });
  const fee = await service.setupInitialFee("STORE", { planType: "THREE_MONTHS" }, merchant);
  assert.equal(fee.installments.length, 3); assert.equal(fee.installments.reduce((sum, row) => sum + toCents(row.principalAmount), 0n), 50000000n);
  assert.equal(fee.installments[2].principalAmount, "166666.68"); assert.equal((await repository.stores.findById("STORE")).status, "pending_initial_payment");
});

test("first full installment confirmation activates Store and completes FULL contract", async () => {
  const { repository, service } = fixture(); const fee = await service.setupInitialFee("STORE", { planType: "FULL" }, merchant); const installment = fee.installments[0];
  const payment = await service.submitInstallmentPayment("STORE", installment.id, { amount: installment.principalOutstanding, provider: "MANUAL" }, merchant);
  await service.confirmPayment("installment", payment.id, admin, true);
  assert.equal((await repository.stores.findById("STORE")).status, "active"); assert.equal((await repository.finance.getInitialFee("STORE")).status, "PAID");
});

test("7-day penalties compound, snapshot percentage, and reconcile idempotently", async () => {
  const { repository, service } = fixture({ initialStoreFeeAmount: 100000, installmentLateInterestPercent: 2 }); const fee = await service.setupInitialFee("STORE", { planType: "FULL" }, merchant); const dueAt = new Date(Date.now() - 15 * 86400000); await repository.finance.updateInstallment(fee.installments[0].id, { dueAt });
  await service.reconcileInstallments(new Date(), admin); await service.reconcileInstallments(new Date(), admin);
  const current = await repository.finance.findInstallment(fee.installments[0].id); assert.equal(current.penalties.length, 2); assert.equal(current.penalties[0].penaltyAmount, "2000.00"); assert.equal(current.penalties[1].baseOutstandingAmount, "102000.00"); assert.equal(current.penaltyOutstanding, "4040.00");
});

test("Commerce completion creates one ledger and percentage Admin Fee from subtotal", async () => {
  const { repository } = fixture({ taxPercent: 11, adminFeeType: "percentage", adminFeeValue: 5 }); const order = { id: "ORDER", storeId: "STORE", customerUserId: "CUSTOMER", productTotal: 200000, totalAmount: 210000, paymentStatus: "paid" };
  await repository.transaction((tx) => generateCommerceFinance(tx, order, new Date("2026-08-20T03:00:00Z"))); await repository.transaction((tx) => generateCommerceFinance(tx, order, new Date()));
  const fees = await repository.finance.listAdminFees("STORE"); assert.equal(fees.length, 1); assert.equal(fees[0].feeAmount, "10000.00"); assert.equal(fees[0].billingMonth, 8);
});

test("Admin Fee settlement requires full amount and reactivates only finance-suspended Store", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); const order = { id: "ORDER2", storeId: "STORE", customerUserId: "CUSTOMER", productTotal: 1000, paymentStatus: "paid" }; await repository.transaction((tx) => generateCommerceFinance(tx, order, new Date("2026-01-01T00:00:00Z"))); const fee = (await repository.finance.listAdminFees("STORE"))[0]; await repository.stores.update("STORE", { status: "suspended_admin_fee" });
  await assert.rejects(service.createSettlement("STORE", { obligationIds: [fee.id], amount: 4000 }, merchant)); const settlement = await service.createSettlement("STORE", { obligationIds: [fee.id], amount: 5000 }, merchant); await service.confirmPayment("settlement", settlement.id, admin, true); assert.equal((await repository.stores.findById("STORE")).status, "active");
});

test("voluntary contribution is Merchant-owned, positive, optional, and Admin-confirmed", async () => {
  const { service } = fixture(); await assert.rejects(service.createContribution({ amount: 0 }, merchant)); const contribution = await service.createContribution({ amount: 25000 }, merchant); assert.equal(contribution.paymentStatus, "PENDING"); const paid = await service.confirmPayment("contribution", contribution.id, admin, true); assert.equal(paid.paymentStatus, "PAID");
  const disabled = fixture({ voluntaryContributionEnabled: false }); await assert.rejects(disabled.service.createContribution({ amount: 1000 }, merchant));
});
