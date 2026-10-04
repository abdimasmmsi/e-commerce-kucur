import { getOrders } from "../data/mockOrders";
import { filterByPeriod } from "../utils/datePeriod";

const BOOKING_SOURCES = [
  { key: "kucur_tourism_bookings", transactionType: "educational-tourism" },
  { key: "kucur_livein_bookings", transactionType: "live-in" },
];

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function getCompletedTransactions() {
  const products = getOrders().filter((order) => order.status === "completed").map((order) => ({
    transactionId: order.id,
    transactionType: "product",
    storeId: String(order.storeId),
    merchantUserId: order.merchantUserId,
    customerId: order.customerId,
    courierId: order.courierId ?? null,
    completedAt: order.completedAt,
    grossAmount: Number(order.totalAmount) || 0,
    merchantRevenue: Number(order.productTotal) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    courierTip: Number(order.courierTip) || 0,
  }));
  const bookings = BOOKING_SOURCES.flatMap(({ key, transactionType }) => readArray(key)
    .filter((booking) => booking.status === "completed" && booking.completedAt)
    .map((booking) => ({
      transactionId: booking.id,
      transactionType,
      storeId: String(booking.storeId),
      merchantUserId: booking.merchantUserId,
      customerId: booking.customerId,
      completedAt: booking.completedAt,
      grossAmount: Number(booking.totalAmount) || 0,
      merchantRevenue: Number(booking.totalAmount) || 0,
      deliveryFee: 0,
      courierTip: 0,
    })));
  return [...products, ...bookings];
}

export function getMerchantRevenue({ merchantUserId, storeIds, from, to, period, start, end } = {}) {
  const allowedStores = storeIds ? new Set(storeIds.map(String)) : null;
  const rows = getCompletedTransactions().filter((row) => (!merchantUserId || row.merchantUserId === merchantUserId)
    && (!allowedStores || allowedStores.has(String(row.storeId)))
    && (!from || new Date(row.completedAt) >= new Date(from))
    && (!to || new Date(row.completedAt) <= new Date(to)));
  const filteredRows = period ? filterByPeriod(rows, (row) => row.completedAt, period, start, end) : rows;
  return {
    transactions: filteredRows,
    completedCount: filteredRows.length,
    merchantRevenue: filteredRows.reduce((sum, row) => sum + row.merchantRevenue, 0),
    grossAmount: filteredRows.reduce((sum, row) => sum + row.grossAmount, 0),
    breakdown: filteredRows.reduce((result, row) => ({ ...result, [row.transactionType]: (result[row.transactionType] ?? 0) + row.merchantRevenue }), {}),
  };
}

export function getCourierEarnings(courierId, { period, start, end } = {}) {
  const allRows = getCompletedTransactions().filter((row) => row.transactionType === "product" && String(row.courierId) === String(courierId));
  const rows = period ? filterByPeriod(allRows, (row) => row.completedAt, period, start, end) : allRows;
  const delivery = rows.reduce((sum, row) => sum + row.deliveryFee, 0);
  const tips = rows.reduce((sum, row) => sum + row.courierTip, 0);
  return { delivery, tips, total: delivery + tips, completedCount: rows.length };
}

export function getAdminTransactionSummary({ period, start, end } = {}) {
  const allRows = getCompletedTransactions();
  const rows = period ? filterByPeriod(allRows, (row) => row.completedAt, period, start, end) : allRows;
  const values = rows.reduce((result, row) => ({ ...result, [row.transactionType]: (result[row.transactionType] ?? 0) + row.grossAmount }), {});
  return { completedCount: rows.length, values, totalValue: rows.reduce((sum, row) => sum + row.grossAmount, 0) };
}
