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

const fakeNotifications = (repository) => { const rows = []; repository.notifications = { create: async (data) => { if (data.dedupeKey && rows.some((row) => row.dedupeKey === data.dedupeKey)) { const error = new Error("duplicate"); error.code = "P2002"; throw error; } const row = { id: `N${rows.length + 1}`, ...data }; rows.push(row); return row; }, findByDedupeKey: async (key) => rows.find((row) => row.dedupeKey === key) || null }; return rows; };
const adminFeeFor = async (repository, orderId, completedAt = new Date("2026-01-01T00:00:00Z")) => { await repository.transaction((tx) => generateCommerceFinance(tx, { id: orderId, storeId: "STORE", customerUserId: "CUSTOMER", productTotal: 1000, paymentStatus: "paid" }, completedAt)); return (await repository.finance.listAdminFees("STORE")).find((row) => row.platformTransactionId && !row.settlementItem && row.status === "OUTSTANDING"); };

test("double-clicked admin fee payment reuses the pending settlement, shows up for Admin, and confirms once", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); const fee = await adminFeeFor(repository, "ORDER-DBL");
  const first = await service.createSettlement("STORE", { obligationIds: [fee.id], amount: 5000 }, merchant); const second = await service.createSettlement("STORE", { obligationIds: [fee.id], amount: 5000 }, merchant);
  assert.equal(second.id, first.id);
  const listed = await repository.finance.listAdminFees("STORE"); assert.equal(listed[0].settlementItem.settlement.paymentStatus, "PENDING");
  const monitor = await service.monitoring(admin); assert.equal(monitor.settlements.filter((row) => row.paymentStatus === "PENDING").length, 1);
  await service.confirmPayment("settlement", first.id, admin, true); assert.equal((await repository.finance.listAdminFees("STORE"))[0].status, "PAID");
});

test("a new admin fee payment replaces an older pending one so no obligation gets stuck", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); const feeA = await adminFeeFor(repository, "ORDER-A"); const old = await service.createSettlement("STORE", { obligationIds: [feeA.id] }, merchant);
  const feeB = await adminFeeFor(repository, "ORDER-B"); const fresh = await service.createSettlement("STORE", { obligationIds: [feeA.id, feeB.id], amount: 10000 }, merchant);
  assert.notEqual(fresh.id, old.id); assert.equal((await repository.finance.findSettlement(old.id)).paymentStatus, "REJECTED");
  await service.confirmPayment("settlement", fresh.id, admin, true); assert.deepEqual((await repository.finance.listAdminFees("STORE")).map((row) => row.status), ["PAID", "PAID"]);
});

test("double-submitted installment payment is reused and float amounts from the browser are accepted", async () => {
  const { service } = fixture({ initialStoreFeeAmount: 100000 }); const fee = await service.setupInitialFee("STORE", { planType: "THREE_MONTHS" }, merchant); const installment = fee.installments[0];
  const amount = Number(installment.principalOutstanding) + 0.000000001;
  const first = await service.submitInstallmentPayment("STORE", installment.id, { amount }, merchant); const second = await service.submitInstallmentPayment("STORE", installment.id, { amount }, merchant);
  assert.equal(second.id, first.id); const paid = await service.confirmPayment("installment", first.id, admin, true); assert.equal(paid.paymentStatus, "PAID");
});

test("penalty added after the merchant paid does not block Admin confirmation and late interest freezes while waiting", async () => {
  const { repository, service } = fixture({ initialStoreFeeAmount: 100000, installmentLateInterestPercent: 2 }); const fee = await service.setupInitialFee("STORE", { planType: "FULL" }, merchant); const installment = fee.installments[0];
  const payment = await service.submitInstallmentPayment("STORE", installment.id, { amount: 100000 }, merchant);
  await repository.finance.updateInstallment(installment.id, { dueAt: new Date(Date.now() - 15 * 86400000) });
  await service.reconcileInstallments(new Date(), null); assert.equal((await repository.finance.findInstallment(installment.id)).penalties.length, 0);
  await repository.finance.createPenalty({ installmentId: installment.id, periodNumber: 1, percentageSnapshot: 2, baseOutstandingAmount: "100000.00", penaltyAmount: "2000.00", appliedAt: new Date(Date.now() + 1000) }); await repository.finance.updateInstallment(installment.id, { penaltyOutstanding: "2000.00" });
  await service.confirmPayment("installment", payment.id, admin, true);
  assert.equal((await repository.finance.findInstallment(installment.id)).status, "PAID"); assert.equal((await repository.stores.findById("STORE")).status, "active");
});

test("double-clicked voluntary contribution creates one pending payment", async () => {
  const { service } = fixture(); const first = await service.createContribution({ amount: 25000 }, merchant); const second = await service.createContribution({ amount: 25000 }, merchant);
  assert.equal(second.id, first.id); assert.equal((await service.listContributions(merchant)).length, 1);
});

test("reconcile admin fees runs without an Admin (background job) and reactivates paid-up stores", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); fakeNotifications(repository); await repository.stores.update("STORE", { status: "suspended_admin_fee" });
  const result = await service.reconcileAdminFees(new Date(), null); assert.equal(result.reactivated, 1); assert.equal((await repository.stores.findById("STORE")).status, "active");
  await adminFeeFor(repository, "ORDER-LATE"); const again = await service.reconcileAdminFees(new Date(), null); assert.equal(again.suspended, 1); assert.equal((await repository.stores.findById("STORE")).status, "suspended_admin_fee");
  await assert.rejects(service.reconcileAdminFees(new Date(), merchant));
});

test("remind sends one notification per store with unpaid bills per day and skips paid-up stores", async () => {
  const repository = createMemoryRepository({ users: [merchant, admin, { id: "M2", roles: ["merchant"] }], stores: [{ id: "STORE", merchantUserId: merchant.id, name: "QA Store", type: "product", status: "active" }, { id: "STORE2", merchantUserId: "M2", name: "Lunas", type: "product", status: "active" }], settings: { adminFeeType: "fixed", adminFeeValue: 5000 } });
  const service = createFinanceService(repository); const sent = fakeNotifications(repository); await adminFeeFor(repository, "ORDER-R1"); await adminFeeFor(repository, "ORDER-R2", new Date());
  await assert.rejects(service.remindOutstanding(merchant));
  const result = await service.remindOutstanding(admin); assert.equal(result.reminded, 1); assert.equal(result.storesWithOutstanding, 1);
  assert.equal(sent[0].userId, merchant.id); assert.equal(sent[0].type, "MERCHANT_FEE_REMINDER"); assert.equal(sent[0].entityType, "STORE_FINANCE"); assert.equal(sent[0].entityId, "STORE"); assert.match(sent[0].body, /Rp10\.000/); assert.match(sent[0].body, /1 di antaranya sudah lewat jatuh tempo/); assert.match(sent[0].dedupeKey, /^finance-reminder:STORE:\d{4}-\d{2}-\d{2}$/);
  const again = await service.remindOutstanding(admin); assert.equal(again.reminded, 0); assert.equal(again.alreadyReminded, 1); assert.equal(sent.length, 1);
  assert.equal((await service.remindOutstanding(admin, { storeId: "STORE2" })).storesWithOutstanding, 0);
});

test("background reconcile job never throws and runs both reconciliations at startup", async () => {
  const { startFinanceReconcileJob } = require("./services/financeReconcileJob"); const calls = [];
  const original = console.warn; console.warn = () => {};
  try { const stop = startFinanceReconcileJob({}, { intervalMs: 1e9, financeService: { reconcileInstallments: async () => { calls.push("installments"); throw new Error("boom"); }, reconcileAdminFees: async () => { calls.push("admin-fees"); return {}; } } }); await new Promise((resolve) => setTimeout(resolve, 20)); stop(); }
  finally { console.warn = original; }
  assert.deepEqual(calls, ["installments", "admin-fees"]);
});

test("Admin menandai biaya admin ditarik langsung: validasi, tolak bila ada pengajuan menunggu, lalu lunas dan lapak aktif lagi", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); const sent = fakeNotifications(repository);
  await adminFeeFor(repository, "ORDER-K1", new Date("2026-01-01T00:00:00Z")); await adminFeeFor(repository, "ORDER-K2", new Date("2026-01-02T00:00:00Z"));
  const [feeA, feeB] = await repository.finance.listAdminFees("STORE"); await repository.stores.update("STORE", { status: "suspended_admin_fee" });
  await assert.rejects(service.collectAdminFees("STORE", { obligationIds: [feeA.id] }, merchant), (error) => error.statusCode === 403);
  await assert.rejects(service.collectAdminFees("STORE", { obligationIds: [] }, admin));
  await assert.rejects(service.collectAdminFees("STORE", { obligationIds: [feeA.id], method: "KOIN" }, admin));
  await assert.rejects(service.collectAdminFees("NOPE", { obligationIds: [feeA.id] }, admin));
  await service.createSettlement("STORE", { obligationIds: [feeB.id] }, merchant);
  await assert.rejects(service.collectAdminFees("STORE", { obligationIds: [feeB.id] }, admin), /menunggu konfirmasi/);
  const partial = await service.collectAdminFees("STORE", { obligationIds: [feeA.id], method: "TRANSFER", note: "Setor di balai desa" }, admin);
  assert.deepEqual(partial, { collected: 1, amount: 5000, storeReactivated: false });
  assert.equal((await repository.stores.findById("STORE")).status, "suspended_admin_fee");
  const paid = (await repository.finance.listAdminFees("STORE")).find((row) => row.id === feeA.id); assert.equal(paid.status, "PAID"); assert.equal(paid.paymentMethod, "TRANSFER");
  await assert.rejects(service.collectAdminFees("STORE", { obligationIds: [feeA.id] }, admin), /tidak valid atau sudah lunas/);
  const pending = (await repository.finance.findAdminFees([feeB.id]))[0].settlementItem.settlement; await service.confirmPayment("settlement", pending.id, admin, false);
  const rest = await service.collectAdminFees("STORE", { obligationIds: [feeB.id], method: "CASH" }, admin);
  assert.deepEqual(rest, { collected: 1, amount: 5000, storeReactivated: true }); assert.equal((await repository.stores.findById("STORE")).status, "active");
  assert.ok(sent.some((row) => row.type === "ADMIN_FEE_PAID" && /Rp5\.000/.test(row.body))); assert.ok(sent.some((row) => row.type === "STORE_REACTIVATED"));
});

test("pengingat otomatis hanya untuk tagihan jatuh tempo dalam 3 hari atau sudah lewat, maks sekali per lapak per hari", async () => {
  const { repository, service } = fixture({ adminFeeType: "fixed", adminFeeValue: 5000 }); const sent = fakeNotifications(repository);
  await adminFeeFor(repository, "ORDER-D1", new Date("2026-01-15T03:00:00Z"));
  assert.equal((await service.remindDueSoon(new Date("2026-01-20T03:00:00Z"))).reminded, 0);
  const near = new Date("2026-01-30T03:00:00Z");
  assert.equal((await service.remindDueSoon(near)).reminded, 1); assert.equal((await service.remindDueSoon(near)).alreadyReminded, 1);
  assert.equal((await service.remindDueSoon(new Date("2026-02-03T03:00:00Z"))).reminded, 1);
  assert.equal(sent.length, 2); assert.ok(sent.every((row) => row.type === "MERCHANT_FEE_REMINDER" && row.userId === merchant.id));
});
