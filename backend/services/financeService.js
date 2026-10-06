const { errors } = require("../errors/AppError");

const PLAN_COUNTS = { FULL: 1, THREE_MONTHS: 3, SIX_MONTHS: 6 };
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const toCents = (value) => {
  const text = String(value ?? "0"); const [whole, fraction = ""] = text.split(".");
  if (!/^-?\d+$/.test(whole) || !/^\d*$/.test(fraction)) throw errors.validation({ amount: "Nominal tidak valid." });
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2)) * (whole.startsWith("-") ? -1n : 1n);
};
// Nominal dari browser bisa berupa angka float (mis. 36802.690000000001); bulatkan ke sen dulu.
const moneyCents = (value) => toCents(typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : value);
const upper = (value) => String(value ?? "").toUpperCase();
const fromCents = (value) => `${value / 100n}.${String(value < 0 ? -(value % 100n) : value % 100n).padStart(2, "0")}`;
const percentOf = (cents, percent) => (cents * toCents(percent) + 5000n) / 10000n;
const jakartaParts = (date) => { const shifted = new Date(new Date(date).getTime() + JAKARTA_OFFSET_MS); return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() }; };
const jakartaDate = (year, month, day, hour = 0, minute = 0) => new Date(Date.UTC(year, month, day, hour, minute) - JAKARTA_OFFSET_MS);
const addJakartaMonths = (date, count) => { const p = jakartaParts(date); const targetFirst = new Date(Date.UTC(p.year, p.month + count, 1)); const year = targetFirst.getUTCFullYear(); const month = targetFirst.getUTCMonth(); const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); return jakartaDate(year, month, Math.min(p.day, lastDay), p.hour, p.minute); };
const cutoffFor = (completedAt, day, time) => { const p = jakartaParts(completedAt); const [hour, minute] = String(time).split(":").map(Number); const next = new Date(Date.UTC(p.year, p.month + 1, 1)); const year = next.getUTCFullYear(); const month = next.getUTCMonth(); const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); return jakartaDate(year, month, Math.min(Number(day), last), hour, minute); };
const paymentProviderError = () => { const error = new Error("Midtrans belum dikonfigurasi."); error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED"; error.statusCode = 503; return error; };
const requireOwner = (store, actor) => { if (!store) throw errors.notFound("Store tidak ditemukan."); if (!actor.roles.includes("admin") && store.merchantUserId !== actor.id) throw errors.forbidden("Keuangan Store bukan milik pengguna ini."); };
const audit = (tx, actor, entityType, entityId, activityType, description) => tx.audits.append({ entityType, entityId, actorId: actor?.id || null, actorRole: actor?.roles?.includes("admin") ? "admin" : actor ? "merchant" : null, activityType, previousStatus: null, nextStatus: null, description, reason: null, isSystem: !actor });

async function generateCommerceFinance(tx, order, completedAt = new Date()) {
  const existing = await tx.finance.findPlatformTransaction("COMMERCE", order.id); if (existing) return existing;
  const settings = await tx.settings.get(); const subtotal = toCents(order.productTotal); const tax = percentOf(subtotal, settings.taxPercent);
  const transaction = await tx.finance.createPlatformTransaction({ storeId: order.storeId, customerUserId: order.customerUserId, type: "COMMERCE", sourceEntityId: order.id, commerceOrderId: order.id, subtotal: fromCents(subtotal), taxPercentSnapshot: settings.taxPercent, taxAmount: fromCents(tax), grandTotal: fromCents(subtotal + tax), paymentStatus: order.paymentStatus, transactionStatus: "COMPLETED", completedAt });
  const fee = settings.adminFeeType === "percentage" ? percentOf(subtotal, settings.adminFeeValue) : toCents(settings.adminFeeValue);
  const obligation = await tx.finance.createAdminFeeObligation({ platformTransactionId: transaction.id, storeId: order.storeId, feeTypeSnapshot: settings.adminFeeType, feeValueSnapshot: settings.adminFeeValue, baseTransactionAmount: fromCents(subtotal), feeAmount: fromCents(fee), billingYear: jakartaParts(completedAt).year, billingMonth: jakartaParts(completedAt).month + 1, cutoffAt: cutoffFor(completedAt, settings.adminFeeCutoffDay, settings.adminFeeGraceTime), status: "OUTSTANDING" });
  await audit(tx, null, "admin-fee-obligation", obligation.id, "ADMIN_FEE_CREATED", `Biaya Admin dibuat untuk transaksi ${order.id}.`); return transaction;
}

async function completePlatformTransaction(tx, transactionId, completedAt = new Date()) {
  const transaction = await tx.finance.findPlatformTransactionById(transactionId); if (!transaction) throw errors.notFound("Platform Transaction tidak ditemukan.");
  const existing = await tx.finance.findAdminFeeByTransaction(transactionId); if (existing) return existing;
  const settings = await tx.settings.get(); const base = toCents(transaction.subtotal); const fee = settings.adminFeeType === "percentage" ? percentOf(base, settings.adminFeeValue) : toCents(settings.adminFeeValue);
  await tx.finance.updatePlatformTransaction(transactionId, { transactionStatus: "COMPLETED", completedAt });
  const p = jakartaParts(completedAt); const obligation = await tx.finance.createAdminFeeObligation({ platformTransactionId: transactionId, storeId: transaction.storeId, feeTypeSnapshot: settings.adminFeeType, feeValueSnapshot: settings.adminFeeValue, baseTransactionAmount: fromCents(base), feeAmount: fromCents(fee), billingYear: p.year, billingMonth: p.month + 1, cutoffAt: cutoffFor(completedAt, settings.adminFeeCutoffDay, settings.adminFeeGraceTime), status: "OUTSTANDING" });
  await audit(tx, null, "admin-fee-obligation", obligation.id, "ADMIN_FEE_CREATED", `Biaya Admin dibuat untuk transaksi ${transaction.sourceEntityId}.`); return obligation;
}

const { notifyAdmins, notifySafe } = require("./notifyHelpers");
const { createNotificationService } = require("./notificationService");

const jakartaDay = (date = new Date()) => new Date(new Date(date).getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
const rupiah = (cents) => `Rp${new Intl.NumberFormat("id-ID").format(Math.round(Number(cents) / 100))}`;
const dayText = (date) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" }).format(new Date(date));

// Ringkas tagihan belum dibayar per lapak dari data monitoring: cicilan iuran pokok (pokok + denda) dan biaya admin.
// Tagihan yang sudah diajukan dan menunggu konfirmasi Admin tidak dihitung sebagai belum dibayar.
function buildUnpaidByStore(data, now = new Date()) {
  const stores = new Map();
  const entry = (storeId, store) => { const row = stores.get(storeId) || { storeId, store: store || null, outstanding: 0n, count: 0, overdueCount: 0, nearestDueAt: null }; if (!row.store && store) row.store = store; stores.set(storeId, row); return row; };
  const add = (row, cents, dueAt) => { row.outstanding += cents; row.count += 1; if (dueAt && new Date(dueAt) <= now) row.overdueCount += 1; if (dueAt && (!row.nearestDueAt || new Date(dueAt) < new Date(row.nearestDueAt))) row.nearestDueAt = dueAt; };
  for (const contract of data.initialFees || []) for (const item of contract.installments || []) {
    if (upper(item.status) === "PAID" || (item.payments || []).some((payment) => upper(payment.paymentStatus) === "PENDING")) continue;
    add(entry(contract.storeId, contract.store), moneyCents(item.principalOutstanding) + moneyCents(item.penaltyOutstanding), item.dueAt);
  }
  for (const fee of data.adminFees || []) {
    if (upper(fee.status) !== "OUTSTANDING" || fee.settlementItem) continue;
    add(entry(fee.storeId, fee.store), moneyCents(fee.feeAmount), fee.cutoffAt);
  }
  return [...stores.values()].filter((row) => row.outstanding > 0n);
}

function createFinanceService(repository) {
  const transactionalRetry = async (work) => { let lastError; for (let attempt = 0; attempt < 5; attempt += 1) { try { return await repository.transaction(work); } catch (error) { lastError = error; if (!["P2034", "P2002"].includes(error.code)) throw error; await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1))); } } throw lastError; };
  // Rekonsiliasi cicilan: tandai cicilan lewat jatuh tempo (OVERDUE) dan tambahkan denda per 7 hari (bunga majemuk).
  // Idempoten: denda per periode hanya dibuat sekali. Selama ada pembayaran menunggu konfirmasi, denda baru tidak ditambahkan.
  const reconcileInstallments = async (now = new Date(), actor = null, options = {}) => {
    const candidates = (await repository.finance.listReconcileInstallments(now)).filter((item) => !options.storeId || item.initialFee?.storeId === options.storeId); let penaltiesCreated = 0;
    for (const item of candidates) await transactionalRetry(async (tx) => {
      const current = await tx.finance.findInstallment(item.id); if (!current || current.status === "PAID") return;
      const waitingConfirmation = (current.payments || []).some((payment) => upper(payment.paymentStatus) === "PENDING");
      const periods = waitingConfirmation ? 0 : Math.floor((new Date(now) - new Date(current.dueAt)) / (7 * 86400000));
      let outstanding = toCents(current.principalOutstanding) + toCents(current.penaltyOutstanding); const existing = new Set(current.penalties.map((row) => row.periodNumber));
      for (let period = 1; period <= periods; period += 1) { if (existing.has(period)) continue; const settings = await tx.settings.get(); const amount = percentOf(outstanding, settings.installmentLateInterestPercent); await tx.finance.createPenalty({ installmentId: current.id, periodNumber: period, percentageSnapshot: settings.installmentLateInterestPercent, baseOutstandingAmount: fromCents(outstanding), penaltyAmount: fromCents(amount), appliedAt: now }); outstanding += amount; penaltiesCreated += 1; await audit(tx, actor, "store-installment", current.id, "INSTALLMENT_PENALTY_APPLIED", `Penalty periode ${period} diterapkan.`); }
      await tx.finance.updateInstallment(current.id, { status: "OVERDUE", penaltyOutstanding: fromCents(outstanding - toCents(current.principalOutstanding)) });
      if (current.status !== "OVERDUE") await audit(tx, actor, "store-installment", current.id, "INSTALLMENT_OVERDUE", "Cicilan melewati jatuh tempo.");
    }); return { reconciled: candidates.length, penaltiesCreated };
  };
  const summary = async (storeId, actor) => { await reconcileInstallments(new Date(), null, { storeId }); const store = await repository.stores.findById(storeId); requireOwner(store, actor); const initialFee = await repository.finance.getInitialFee(storeId); const adminFees = await repository.finance.listAdminFees(storeId); const outstandingFees = adminFees.filter((row) => row.status === "OUTSTANDING"); const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0); return { store, initialFee: initialFee && { ...initialFee, total: initialFee.initialAmountSnapshot, paid: sum(initialFee.installments.filter((row) => row.status === "PAID"), "principalAmount"), outstanding: sum(initialFee.installments, "principalOutstanding") + sum(initialFee.installments, "penaltyOutstanding"), nextDueAt: initialFee.installments.find((row) => row.status !== "PAID")?.dueAt || null }, adminFee: { outstanding: sum(outstandingFees, "feeAmount"), overdue: sum(outstandingFees.filter((row) => new Date(row.cutoffAt) <= new Date()), "feeAmount"), nextCutoffAt: outstandingFees.map((row) => row.cutoffAt).sort()[0] || null, obligations: adminFees, status: outstandingFees.length ? "OUTSTANDING" : "PAID" }, serverNow: new Date().toISOString() }; };
  const reactivatePaidUpStores = async (now, actor) => {
    let reactivated = 0;
    const suspended = (await repository.stores.list()).filter((store) => store.status === "suspended_admin_fee");
    for (const store of suspended) {
      if (await repository.finance.countOverdueAdminFees(store.id, now) > 0) continue;
      let done = false;
      await repository.transaction(async (tx) => { const fresh = await tx.stores.findById(store.id); if (fresh?.status !== "suspended_admin_fee") return; await tx.stores.update(store.id, { status: "active" }); await tx.finance.createStatusHistory({ storeId: store.id, oldStatus: "suspended_admin_fee", newStatus: "active", reason: "Tidak ada lagi tunggakan Admin Fee.", changedByUserId: actor?.id || null, metadata: { process: "admin-fee-reconciliation" } }); await audit(tx, actor, "store", store.id, "STORE_REACTIVATED_ADMIN_FEE", "Store aktif kembali karena tidak ada tunggakan."); done = true; });
      if (!done) continue;
      reactivated += 1;
      await notifySafe(repository, [{ userId: store.merchantUserId, type: "STORE_REACTIVATED", title: "Lapak aktif kembali", body: `Tidak ada lagi tunggakan biaya admin. Lapak "${store.name}" aktif lagi dan bisa menerima pesanan.`, entityType: "STORE", entityId: store.id, dedupeKey: `store-reactivated:${store.id}:${new Date(now).toISOString().slice(0, 10)}` }]);
    }
    return reactivated;
  };
  const service = {
    summary,
    getInitialFee: async (storeId, actor) => { const store = await repository.stores.findById(storeId); requireOwner(store, actor); return repository.finance.getInitialFee(storeId); },
    async setupInitialFee(storeId, input, actor) { const store = await repository.stores.findById(storeId); requireOwner(store, actor); const planType = String(input.planType || "").toUpperCase(); const count = PLAN_COUNTS[planType]; if (!count) throw errors.validation({ planType: "Pilih FULL, THREE_MONTHS, atau SIX_MONTHS." }); return repository.transaction(async (tx) => { if (await tx.finance.getInitialFee(storeId)) throw errors.conflict("Kontrak Iuran Pokok Store sudah ada."); const settings = await tx.settings.get(); const enabled = planType === "FULL" ? settings.installmentFullEnabled : planType === "THREE_MONTHS" ? settings.installment3MonthsEnabled : settings.installment6MonthsEnabled; if (!enabled) throw errors.validation({ planType: "Skema cicilan sedang dinonaktifkan." }); const total = toCents(settings.initialStoreFeeAmount); const base = total / BigInt(count); const now = new Date(); const installments = Array.from({ length: count }, (_, index) => { const amount = index === count - 1 ? total - base * BigInt(count - 1) : base; return { installmentNumber: index + 1, principalAmount: fromCents(amount), principalOutstanding: fromCents(amount), penaltyOutstanding: "0.00", dueAt: addJakartaMonths(now, index), status: "PENDING" }; }); const contract = await tx.finance.createInitialFee({ storeId, initialAmountSnapshot: settings.initialStoreFeeAmount, planType, installmentCount: count, status: "PENDING" }, installments); await tx.stores.update(storeId, { status: "pending_initial_payment" }); await tx.finance.createStatusHistory({ storeId, oldStatus: store.status, newStatus: "pending_initial_payment", reason: "Menunggu pembayaran pertama Iuran Pokok.", changedByUserId: actor.id, metadata: { process: "initial-fee-setup" } }); await audit(tx, actor, "store-initial-fee", contract.id, "INITIAL_FEE_CREATED", `Kontrak ${planType} dibuat.`); return contract; }); },
    async submitInstallmentPayment(storeId, installmentId, input, actor) { const store = await repository.stores.findById(storeId); requireOwner(store, actor); const installment = await repository.finance.findInstallment(installmentId); if (!installment || installment.initialFee.storeId !== storeId) throw errors.notFound("Cicilan tidak ditemukan."); if (installment.status === "PAID") throw errors.conflict("Cicilan sudah lunas."); if (String(input.provider || "MANUAL").toUpperCase() === "MIDTRANS") throw paymentProviderError(); const waiting = (installment.payments || []).find((payment) => upper(payment.paymentStatus) === "PENDING"); if (waiting) return waiting; const expected = moneyCents(installment.principalOutstanding) + moneyCents(installment.penaltyOutstanding); if (moneyCents(input.amount) !== expected) throw errors.validation({ amount: `Pembayaran harus penuh sebesar ${fromCents(expected)}.` }); return repository.finance.createInstallmentPayment({ installmentId, amount: fromCents(expected), paymentMethod: "MANUAL", paymentStatus: "PENDING", provider: "MANUAL" }); },
    reconcileInstallments,
    async createSettlement(storeId, input, actor) { const store = await repository.stores.findById(storeId); requireOwner(store, actor); const ids = [...new Set((input.obligationIds || []).map(String))]; if (!ids.length) throw errors.validation({ obligationIds: "Pilih minimal satu kewajiban." }); if (String(input.provider || "MANUAL").toUpperCase() === "MIDTRANS") throw paymentProviderError(); return repository.transaction(async (tx) => { const obligations = await tx.finance.findAdminFees(ids); const settlementOf = (row) => row.settlementItem?.settlement; if (obligations.length !== ids.length || obligations.some((row) => row.storeId !== storeId || row.status !== "OUTSTANDING" || upper(settlementOf(row)?.paymentStatus) === "PAID")) throw errors.conflict("Kewajiban tidak valid atau sudah diproses."); const pendingIds = [...new Set(obligations.map((row) => upper(settlementOf(row)?.paymentStatus) === "PENDING" ? settlementOf(row).id : null).filter(Boolean))]; if (pendingIds.length === 1 && obligations.every((row) => settlementOf(row)?.id === pendingIds[0])) { const existing = await tx.finance.findSettlement(pendingIds[0]); if (existing && upper(existing.paymentStatus) === "PENDING" && existing.items.length === ids.length) return existing; } for (const pendingId of pendingIds) await tx.finance.updateSettlement(pendingId, { paymentStatus: "REJECTED" }); for (const row of obligations) await tx.finance.cancelPendingPaymentAttempts(row.id); const total = obligations.reduce((sum, row) => sum + moneyCents(row.feeAmount), 0n); if (input.amount != null && moneyCents(input.amount) !== total) throw errors.validation({ amount: "Settlement harus menutup seluruh kewajiban terpilih." }); return tx.finance.createSettlement({ storeId, merchantUserId: actor.id, totalAmount: fromCents(total), paymentMethod: "MANUAL", provider: "MANUAL", paymentStatus: "PENDING" }, obligations.map((row) => ({ adminFeeObligationId: row.id, amount: fromCents(moneyCents(row.feeAmount)) }))); }); },
    async listContributions(actor) { return repository.finance.listContributions(actor.id); },
    async createContribution(input, actor) { const settings = await repository.settings.get(); if (!settings.voluntaryContributionEnabled) throw errors.conflict("Iuran Sukarela sedang dinonaktifkan."); const amount = moneyCents(input.amount); if (amount <= 0n) throw errors.validation({ amount: "Nominal harus lebih dari 0." }); if (String(input.provider || "MANUAL").toUpperCase() === "MIDTRANS") throw paymentProviderError(); const duplicate = (await repository.finance.listContributions(actor.id)).find((row) => upper(row.paymentStatus) === "PENDING" && moneyCents(row.amount) === amount && Date.now() - new Date(row.createdAt).getTime() < 15000); if (duplicate) return duplicate; return repository.finance.createContribution({ merchantUserId: actor.id, amount: fromCents(amount), paymentMethod: "MANUAL", provider: "MANUAL", paymentStatus: "PENDING" }); },
    async confirmPayment(kind, id, actor, approved = true) { if (!actor.roles.includes("admin")) throw errors.forbidden(); return repository.transaction(async (tx) => { const now = new Date(); if (kind === "installment") { const payment = await tx.finance.findInstallmentPayment(id); if (!payment || payment.paymentStatus !== "PENDING") throw errors.conflict("Pembayaran tidak tersedia untuk konfirmasi."); if (!approved) return tx.finance.updateInstallmentPayment(id, { paymentStatus: "REJECTED" }); const installment = await tx.finance.findInstallment(payment.installmentId); if (installment.status === "PAID") throw errors.conflict("Cicilan ini sudah lunas lewat pembayaran lain. Tolak pembayaran ganda ini."); const principal = moneyCents(installment.principalOutstanding); const paidAmount = moneyCents(payment.amount); let penaltyCutoffAt = null;
          // Denda yang muncul setelah lapak mengajukan bayar tidak ditagihkan: nominal dibandingkan dengan tagihan saat pengajuan.
          if (paidAmount !== principal + moneyCents(installment.penaltyOutstanding)) { const submittedAt = new Date(payment.createdAt || now); const penaltiesThen = (installment.penalties || []).filter((row) => !["PAID", "CANCELLED"].includes(upper(row.status)) && new Date(row.appliedAt || row.createdAt || 0) <= submittedAt).reduce((sum, row) => sum + moneyCents(row.penaltyAmount), 0n); if (paidAmount !== principal + penaltiesThen) throw errors.conflict("Nominal pembayaran tidak sesuai tagihan. Tolak lalu minta lapak mengajukan ulang."); penaltyCutoffAt = submittedAt; }
          await tx.finance.updateInstallmentPayment(id, { paymentStatus: "PAID", paidAt: now }); await tx.finance.updateInstallment(installment.id, { principalOutstanding: "0.00", penaltyOutstanding: "0.00", status: "PAID", paidAt: now, ...(penaltyCutoffAt ? { penaltyCutoffAt } : {}) }); await tx.finance.cancelPendingPaymentAttempts(installment.id); if (installment.initialFee?.store?.status === "pending_initial_payment") { await tx.stores.update(installment.initialFee.storeId, { status: "active" }); await tx.finance.createStatusHistory({ storeId: installment.initialFee.storeId, oldStatus: "pending_initial_payment", newStatus: "active", reason: "Pembayaran pertama Iuran Pokok dikonfirmasi.", changedByUserId: actor.id, metadata: { paymentId: id } }); } if (await tx.finance.countUnpaidInstallments(installment.storeInitialFeeId) === 0) { await tx.finance.updateInitialFee(installment.storeInitialFeeId, { status: "PAID", completedAt: now }); await audit(tx, actor, "store-initial-fee", installment.storeInitialFeeId, "INITIAL_FEE_COMPLETED", "Seluruh cicilan Iuran Pokok lunas."); } await audit(tx, actor, "store-installment", installment.id, "INSTALLMENT_PAYMENT_CONFIRMED", "Pembayaran cicilan dikonfirmasi."); return tx.finance.findInstallmentPayment(id); }
      if (kind === "settlement") { const settlement = await tx.finance.findSettlement(id); if (!settlement || settlement.paymentStatus !== "PENDING") throw errors.conflict("Settlement tidak tersedia untuk konfirmasi."); if (!approved) return tx.finance.updateSettlement(id, { paymentStatus: "REJECTED" }); for (const item of settlement.items) { if (item.obligation.status !== "OUTSTANDING") throw errors.conflict("Kewajiban sudah diselesaikan."); await tx.finance.payAdminFee(item.adminFeeObligationId, now); } await tx.finance.updateSettlement(id, { paymentStatus: "PAID", paidAt: now }); for (const item of settlement.items) await tx.finance.cancelPendingPaymentAttempts(item.adminFeeObligationId); const overdue = await tx.finance.countOverdueAdminFees(settlement.storeId, now); if (overdue === 0 && settlement.store.status === "suspended_admin_fee") { await tx.stores.update(settlement.storeId, { status: "active" }); await tx.finance.createStatusHistory({ storeId: settlement.storeId, oldStatus: "suspended_admin_fee", newStatus: "active", reason: "Seluruh tunggakan Admin Fee dilunasi.", changedByUserId: actor.id, metadata: { settlementId: id } }); await audit(tx, actor, "store", settlement.storeId, "STORE_REACTIVATED_ADMIN_FEE", "Store aktif kembali setelah pelunasan."); } await audit(tx, actor, "admin-fee-settlement", id, "ADMIN_FEE_SETTLED", "Admin Fee dilunasi penuh."); return tx.finance.findSettlement(id); }
      if (kind === "contribution") { const contribution = await tx.finance.findContribution(id); if (!contribution || contribution.paymentStatus !== "PENDING") throw errors.conflict("Kontribusi tidak tersedia untuk konfirmasi."); const updated = await tx.finance.updateContribution(id, { paymentStatus: approved ? "PAID" : "REJECTED", ...(approved ? { paidAt: now } : {}) }); if (approved) await audit(tx, actor, "voluntary-contribution", id, "VOLUNTARY_CONTRIBUTION_PAID", "Iuran Sukarela dikonfirmasi."); return updated; } throw errors.validation({ kind: "Jenis pembayaran tidak valid." }); }); },
    // Rekonsiliasi biaya admin: lapak aktif yang punya biaya admin melewati cutoff (tgl 1, batas jam grace) ditangguhkan;
    // lapak yang ditangguhkan karena biaya admin tetapi sudah tidak punya tunggakan diaktifkan lagi. Idempoten.
    async reconcileAdminFees(now = new Date(), actor = null) { if (actor && !actor.roles?.includes("admin")) throw errors.forbidden(); const reactivated = await reactivatePaidUpStores(now, actor); const settings = await repository.settings.get(); if (!settings.suspendStoreForOutstandingAdminFee) return { suspended: 0, reactivated }; const stores = await repository.finance.listStoresForAdminFeeReconcile(now); for (const store of stores) await repository.transaction(async (tx) => { const fresh = await tx.stores.findById(store.id); if (fresh.status !== "active") return; await tx.stores.update(store.id, { status: "suspended_admin_fee" }); await tx.finance.createStatusHistory({ storeId: store.id, oldStatus: "active", newStatus: "suspended_admin_fee", reason: "Admin Fee melewati cutoff.", changedByUserId: null, metadata: { process: "admin-fee-reconciliation" } }); await audit(tx, null, "store", store.id, "STORE_SUSPENDED_ADMIN_FEE", "Store ditangguhkan karena tunggakan Admin Fee."); }); return { suspended: stores.length, reactivated }; },
    // Kirim pengingat ke setiap pemilik lapak yang masih punya tagihan. Satu pengingat per lapak per hari (dedupeKey berisi tanggal).
    async remindOutstanding(actor, input = {}, now = new Date()) {
      if (!actor?.roles?.includes("admin")) throw errors.forbidden();
      const storeId = input.storeId ? String(input.storeId) : null;
      const rows = buildUnpaidByStore(await repository.finance.monitoring(), now).filter((row) => !storeId || row.storeId === storeId);
      const notifications = createNotificationService(repository); const day = jakartaDay(now);
      let reminded = 0, alreadyReminded = 0, failed = 0;
      for (const row of rows) {
        const store = row.store?.merchantUserId ? row.store : await Promise.resolve().then(() => repository.stores.findById(row.storeId)).catch(() => null);
        if (!store?.merchantUserId) { failed += 1; continue; }
        const overdue = row.overdueCount ? `, ${row.overdueCount} di antaranya sudah lewat jatuh tempo` : "";
        const due = row.nearestDueAt ? ` Jatuh tempo terdekat: ${dayText(row.nearestDueAt)}.` : "";
        try {
          const result = await notifications.createNotification({ userId: store.merchantUserId, type: "MERCHANT_FEE_REMINDER", title: "Pengingat tagihan lapak", body: `Lapak "${store.name}" masih punya tagihan ${rupiah(row.outstanding)} (${row.count} tagihan${overdue}).${due} Bayar di Keuangan Lapak supaya lapak tetap aktif.`, entityType: "STORE_FINANCE", entityId: row.storeId, metadata: { outstanding: fromCents(row.outstanding), count: row.count, overdueCount: row.overdueCount, nearestDueAt: row.nearestDueAt }, dedupeKey: `finance-reminder:${row.storeId}:${day}` });
          if (result.created) reminded += 1; else alreadyReminded += 1;
        } catch (error) { failed += 1; console.warn(`[finance-reminder] ${error.message}`); }
      }
      return { reminded, alreadyReminded, failed, storesWithOutstanding: rows.length };
    },
    async monitoring(actor) { if (!actor.roles.includes("admin")) throw errors.forbidden(); return repository.finance.monitoring(); },
  };
  // Pembungkus notifikasi: aksi keuangan tetap jalan walaupun notifikasi gagal.
  const storeOf = async (storeId) => { try { return await repository.stores.findById(storeId); } catch { return null; } };
  const pendingForAdmin = (kindLabel) => async (result, storeId, actor) => {
    const store = storeId ? await storeOf(storeId) : null;
    await notifyAdmins(repository, { type: "PAYMENT_PENDING", title: "Pembayaran menunggu konfirmasi", body: `${kindLabel}${store ? ` dari lapak "${store.name}"` : actor?.fullName ? ` dari ${actor.fullName}` : ""} menunggu konfirmasi admin.`, entityType: "STORE_FINANCE", entityId: store?.id ?? null, dedupeKey: result?.id ? `payment-pending:${result.id}` : undefined });
  };
  const wrapAfter = (name, after) => { const original = service[name]; service[name] = async (...args) => { const result = await original(...args); try { await after(result, ...args); } catch (error) { console.warn(`[notification] ${error.message}`); } return result; }; };
  wrapAfter("submitInstallmentPayment", (result, storeId, _id, _input, actor) => pendingForAdmin("Cicilan iuran pokok")(result, storeId, actor));
  wrapAfter("createSettlement", (result, storeId, _input, actor) => pendingForAdmin("Pembayaran biaya admin")(result, storeId, actor));
  wrapAfter("createContribution", (result, _input, actor) => pendingForAdmin("Iuran sukarela")(result, null, actor));
  const originalConfirm = service.confirmPayment;
  service.confirmPayment = async (kind, id, actor, approved = true) => {
    let target = null;
    try {
      if (kind === "installment") { const payment = await repository.finance.findInstallmentPayment(id); const installment = payment && await repository.finance.findInstallment(payment.installmentId); const store = installment && await storeOf(installment.initialFee.storeId); target = store && { userId: store.merchantUserId, store, label: "Cicilan iuran pokok" }; }
      if (kind === "settlement") { const settlement = await repository.finance.findSettlement(id); const store = settlement && await storeOf(settlement.storeId); target = store && { userId: store.merchantUserId, store, label: "Pembayaran biaya admin", wasSuspended: store.status === "suspended_admin_fee" }; }
      if (kind === "contribution") { const contribution = await repository.finance.findContribution(id); target = contribution && { userId: contribution.merchantUserId, label: "Iuran sukarela" }; }
    } catch { target = null; }
    const result = await originalConfirm(kind, id, actor, approved);
    if (target?.userId) {
      const items = [{ userId: target.userId, type: approved ? (kind === "installment" ? "STORE_INSTALLMENT_PAID" : kind === "settlement" ? "ADMIN_FEE_PAID" : "PAYMENT_SUCCESS") : "PAYMENT_FAILED", title: approved ? "Pembayaran dikonfirmasi" : "Pembayaran ditolak", body: `${target.label}${target.store ? ` untuk lapak "${target.store.name}"` : ""} ${approved ? "sudah dikonfirmasi admin. Terima kasih!" : "ditolak admin. Cek nominal lalu kirim ulang atau hubungi admin."}`, entityType: "STORE_FINANCE", entityId: target.store?.id ?? null, dedupeKey: `payment-result:${kind}:${id}` }];
      if (approved && target.wasSuspended) { const fresh = await storeOf(target.store.id); if (fresh?.status === "active") items.push({ userId: target.userId, type: "STORE_REACTIVATED", title: "Lapak aktif kembali", body: `Biaya admin lunas. Lapak "${fresh.name}" aktif lagi dan bisa menerima pesanan.`, entityType: "STORE", entityId: fresh.id, dedupeKey: `store-reactivated:${fresh.id}:${id}` }); }
      await notifySafe(repository, items);
    }
    return result;
  };
  const originalReconcile = service.reconcileAdminFees;
  service.reconcileAdminFees = async (now = new Date(), actor) => {
    let candidates = [];
    try { candidates = await repository.finance.listStoresForAdminFeeReconcile(now); } catch { candidates = []; }
    const result = await originalReconcile(now, actor);
    const items = [];
    for (const candidate of candidates) { const fresh = await storeOf(candidate.id); if (fresh?.status === "suspended_admin_fee") items.push({ userId: fresh.merchantUserId, type: "STORE_SUSPENDED", title: "Lapak ditangguhkan", body: `Lapak "${fresh.name}" ditangguhkan karena biaya admin belum lunas. Lunasi di Keuangan Lapak supaya aktif lagi.`, entityType: "STORE_FINANCE", entityId: fresh.id, dedupeKey: `store-suspended:${fresh.id}:${new Date(now).toISOString().slice(0, 10)}` }); }
    await notifySafe(repository, items);
    return result;
  };
  return service;
}

module.exports = { createFinanceService, buildUnpaidByStore, generateCommerceFinance, completePlatformTransaction, toCents, fromCents, addJakartaMonths, cutoffFor };
