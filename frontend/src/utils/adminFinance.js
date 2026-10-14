// Menyusun data GET /api/admin/finance menjadi "buku tagihan" per lapak untuk halaman Monitoring Keuangan Admin.
// Semua hitungan dilakukan dari data asli backend; tidak ada data tiruan.

const DAY_MS = 86400000;
export const DUE_SOON_DAYS = 7;
// Warna label untuk status satu tagihan (dipakai FinanceBadge).
export const STATE_TONE = { paid: "success", pending: "info", overdue: "danger", dueSoon: "warning", upcoming: "", cancelled: "" };
const upper = (value) => String(value ?? "").toUpperCase();
const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const isPendingPayment = (row) => upper(row?.paymentStatus ?? row?.status) === "PENDING";

// Status satu tagihan: paid | pending (menunggu konfirmasi) | overdue | dueSoon (<= 7 hari) | upcoming | cancelled
function itemState(item, now) {
  if (item.paid) return "paid";
  if (item.cancelled) return "cancelled";
  if (item.pendingPayment) return "pending";
  if (!item.dueAt) return "upcoming";
  const due = new Date(item.dueAt).getTime();
  if (due <= now) return "overdue";
  if (due - now <= DUE_SOON_DAYS * DAY_MS) return "dueSoon";
  return "upcoming";
}

export const daysBetween = (from, to) => Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));

export function buildFinanceLedger(data, now = Date.now()) {
  const stores = new Map();
  const knownStores = new Map();
  const remember = (store) => { if (store?.id) knownStores.set(store.id, { ...(knownStores.get(store.id) || {}), ...store }); };
  for (const store of data?.suspendedStores ?? []) remember(store);
  for (const contract of data?.initialFees ?? []) remember(contract.store);
  for (const fee of data?.adminFees ?? []) remember(fee.store);
  for (const settlement of data?.settlements ?? []) remember(settlement.store);

  const ledger = (storeId) => {
    if (!storeId) return null;
    if (!stores.has(storeId)) stores.set(storeId, { storeId, store: knownStores.get(storeId) || null, contract: null, installments: [], adminFees: [], contributions: [], confirmations: [] });
    return stores.get(storeId);
  };

  for (const contract of data?.initialFees ?? []) {
    const entry = ledger(contract.storeId); if (!entry) continue;
    entry.contract = contract;
    for (const row of contract.installments ?? []) {
      const pendingPayment = (row.payments ?? []).find(isPendingPayment) || null;
      const principal = money(row.principalOutstanding), penalty = money(row.penaltyOutstanding);
      const item = { kind: "installment", id: row.id, number: row.installmentNumber, dueAt: row.dueAt, paidAt: row.paidAt, paid: upper(row.status) === "PAID", principalAmount: money(row.principalAmount), penalty, amount: money(principal + penalty), penaltyPeriods: (row.penalties ?? []).filter((item) => !["PAID", "CANCELLED"].includes(upper(item.status))).length, latePercent: row.penalties?.[0]?.percentageSnapshot ?? null, pendingPayment, raw: row };
      item.state = itemState(item, now);
      entry.installments.push(item);
      if (pendingPayment) entry.confirmations.push({ kind: "installment", id: pendingPayment.id, amount: money(pendingPayment.amount), createdAt: pendingPayment.createdAt, number: row.installmentNumber });
    }
    entry.installments.sort((a, b) => a.number - b.number);
  }

  for (const fee of data?.adminFees ?? []) {
    const entry = ledger(fee.storeId); if (!entry) continue;
    const settlement = fee.settlementItem?.settlement;
    const item = { kind: "adminFee", id: fee.id, dueAt: fee.cutoffAt, paidAt: fee.paidAt, paid: upper(fee.status) === "PAID", cancelled: upper(fee.status) === "CANCELLED", amount: money(fee.feeAmount), base: money(fee.baseTransactionAmount), billingYear: fee.billingYear, billingMonth: fee.billingMonth, pendingPayment: upper(settlement?.paymentStatus) === "PENDING" ? settlement : null, orderId: fee.platformTransactionId, raw: fee };
    item.state = itemState(item, now);
    entry.adminFees.push(item);
  }

  for (const settlement of data?.settlements ?? []) {
    if (!isPendingPayment(settlement)) continue;
    const entry = ledger(settlement.storeId); if (!entry) continue;
    entry.confirmations.push({ kind: "settlement", id: settlement.id, amount: money(settlement.totalAmount ?? settlement.amount), createdAt: settlement.createdAt, count: settlement.items?.length ?? 0 });
  }

  // Iuran sukarela dicatat per akun merchant, jadi ditampilkan di setiap lapak milik akun tersebut.
  const byOwner = new Map();
  for (const entry of stores.values()) if (entry.store?.merchantUserId) byOwner.set(entry.store.merchantUserId, [...(byOwner.get(entry.store.merchantUserId) || []), entry]);
  for (const contribution of data?.contributions ?? []) {
    const owners = byOwner.get(contribution.merchantUserId) || [];
    const item = { kind: "contribution", id: contribution.id, amount: money(contribution.amount), createdAt: contribution.createdAt, paidAt: contribution.paidAt, status: upper(contribution.paymentStatus ?? contribution.status), merchantUserId: contribution.merchantUserId };
    owners.forEach((entry, index) => {
      entry.contributions.push(item);
      // Konfirmasi iuran sukarela cukup muncul sekali (di lapak pertama pemiliknya).
      if (index === 0 && item.status === "PENDING") entry.confirmations.push({ kind: "contribution", id: contribution.id, amount: item.amount, createdAt: contribution.createdAt });
    });
  }

  return [...stores.values()].map((entry) => summarize(entry, now));
}

function summarize(entry, now) {
  const obligations = [...entry.installments, ...entry.adminFees];
  const open = obligations.filter((item) => !item.paid && !item.cancelled);
  const unpaid = open.filter((item) => item.state !== "pending");
  const overdue = unpaid.filter((item) => item.state === "overdue");
  const dueSoon = unpaid.filter((item) => item.state === "dueSoon");
  const oldestOverdue = [...overdue].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0] || null;
  const nearestDue = [...unpaid].filter((item) => item.dueAt).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0] || null;
  const status = String(entry.store?.status || "").toLowerCase();
  const adminFeeOverdue = overdue.some((item) => item.kind === "adminFee");
  const adminFeeDueSoon = dueSoon.some((item) => item.kind === "adminFee");
  return {
    ...entry,
    storeName: entry.store?.name || "",
    storeStatus: status,
    outstanding: money(unpaid.reduce((sum, item) => sum + item.amount, 0)),
    awaitingConfirmation: money(open.filter((item) => item.state === "pending").reduce((sum, item) => sum + item.amount, 0)),
    paidTotal: money(obligations.filter((item) => item.paid).reduce((sum, item) => sum + (item.kind === "installment" ? item.principalAmount : item.amount), 0)),
    overdueCount: overdue.length,
    overdueAmount: money(overdue.reduce((sum, item) => sum + item.amount, 0)),
    dueSoonCount: dueSoon.length,
    unpaidCount: unpaid.length,
    oldestOverdue,
    oldestOverdueDays: oldestOverdue ? daysBetween(oldestOverdue.dueAt, now) : 0,
    nearestDue,
    suspended: status.startsWith("suspended"),
    // Lapak aktif yang biaya adminnya sudah lewat cutoff atau jatuh tempo <= 7 hari akan ditangguhkan bila tidak dibayar.
    atRisk: status === "active" && (adminFeeOverdue || adminFeeDueSoon),
    paidUp: unpaid.length === 0,
  };
}

// Urutan daftar: lewat jatuh tempo dulu (paling lama di atas), lalu yang jatuh tempo terdekat, lalu yang lunas.
export function sortLedgers(rows) {
  const rank = (row) => (row.overdueCount ? 0 : row.dueSoonCount ? 1 : row.unpaidCount ? 2 : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.oldestOverdueDays - a.oldestOverdueDays || (a.nearestDue && b.nearestDue ? new Date(a.nearestDue.dueAt) - new Date(b.nearestDue.dueAt) : 0) || b.outstanding - a.outstanding || a.storeName.localeCompare(b.storeName));
}

export const FINANCE_FILTERS = ["all", "unpaid", "overdue", "dueSoon", "atRisk", "suspended", "paid"];
export function filterLedgers(rows, filter) {
  if (filter === "unpaid") return rows.filter((row) => row.outstanding > 0);
  if (filter === "atRisk") return rows.filter((row) => row.atRisk);
  if (filter === "suspended") return rows.filter((row) => row.suspended);
  if (filter === "overdue") return rows.filter((row) => row.overdueCount > 0);
  if (filter === "dueSoon") return rows.filter((row) => row.dueSoonCount > 0);
  if (filter === "paid") return rows.filter((row) => row.paidUp);
  return rows;
}

// Biaya admin dikelompokkan per bulan tagihan (seperti di Keuangan Lapak milik merchant).
export function groupAdminFeesByMonth(items, now = Date.now()) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.billingYear}-${String(item.billingMonth).padStart(2, "0")}`;
    const group = groups.get(key) || { key, year: item.billingYear, month: item.billingMonth, items: [], total: 0, unpaid: 0, pending: 0, dueAt: null, unpaidDueAt: null, paidAt: null, collectIds: [] };
    group.items.push(item); group.total = money(group.total + item.amount);
    if (item.state === "pending") group.pending = money(group.pending + item.amount);
    else if (!item.paid && !item.cancelled) {
      group.unpaid = money(group.unpaid + item.amount);
      group.collectIds.push(item.id);
      if (item.dueAt && (!group.unpaidDueAt || new Date(item.dueAt) < new Date(group.unpaidDueAt))) group.unpaidDueAt = item.dueAt;
    }
    if (item.dueAt && (!group.dueAt || new Date(item.dueAt) < new Date(group.dueAt))) group.dueAt = item.dueAt;
    if (item.paidAt && (!group.paidAt || new Date(item.paidAt) > new Date(group.paidAt))) group.paidAt = item.paidAt;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const state = group.unpaid > 0 ? itemState({ dueAt: group.unpaidDueAt }, now) : group.pending > 0 ? "pending" : "paid";
    return { ...group, dueAt: group.unpaidDueAt || group.dueAt, state };
  }).sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

// Rekap biaya admin per bulan untuk semua lapak (dan per lapak per bulan untuk CSV). Tagihan dibatalkan tidak dihitung.
export function buildAdminFeeRecap(ledgers) {
  const months = new Map();
  const perStore = [];
  for (const ledger of ledgers) {
    for (const group of groupAdminFeesByMonth(ledger.adminFees.filter((item) => !item.cancelled))) {
      const paid = money(group.total - group.unpaid - group.pending);
      const outstanding = money(group.unpaid + group.pending);
      perStore.push({ key: group.key, year: group.year, month: group.month, storeId: ledger.storeId, storeName: ledger.storeName, orders: group.items.length, total: group.total, paid, outstanding });
      const row = months.get(group.key) || { key: group.key, year: group.year, month: group.month, orders: 0, total: 0, paid: 0, outstanding: 0, storesOwing: 0 };
      row.orders += group.items.length; row.total = money(row.total + group.total); row.paid = money(row.paid + paid); row.outstanding = money(row.outstanding + outstanding);
      if (outstanding > 0) row.storesOwing += 1;
      months.set(group.key, row);
    }
  }
  const byMonth = (a, b) => (b.year - a.year) || (b.month - a.month);
  return { months: [...months.values()].sort(byMonth), perStore: perStore.sort((a, b) => byMonth(a, b) || a.storeName.localeCompare(b.storeName)) };
}
