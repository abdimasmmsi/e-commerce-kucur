const crypto = require("crypto");
const config = require("./midtransConfig");
const authorization = () => `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;

function assertConfigured() { if (!config.midtransConfigured) { const error = new Error("Midtrans belum dikonfigurasi."); error.statusCode = 503; error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED"; error.provider = "midtrans"; throw error; } }
async function midtransRequest(url, options = {}) { assertConfigured(); const response = await fetch(url, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization(), ...(options.headers ?? {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(body.status_message ?? "Midtrans request gagal."); error.statusCode = response.status; error.details = body; throw error; } return body; }

function normalizeMidtransStatus(payload) {
  const status = payload?.transaction_status;
  if (status === "settlement") return "paid";
  if (status === "capture") return !payload.fraud_status || payload.fraud_status === "accept" ? "paid" : "failed";
  if (status === "pending") return "pending";
  if (["deny", "failure"].includes(status)) return "failed";
  if (status === "expire") return "expired";
  if (status === "cancel") return "cancelled";
  if (["refund", "partial_refund"].includes(status)) return "refunded";
  return "pending";
}

async function createSnapTransaction(payload, notificationUrl) {
  const headers = notificationUrl ? { "X-Override-Notification": notificationUrl } : {};
  return midtransRequest(`${config.snapBaseUrl}/snap/v1/transactions`, { method: "POST", headers, body: JSON.stringify(payload) });
}
const getTransactionStatus = (orderId) => midtransRequest(`${config.apiBaseUrl}/v2/${encodeURIComponent(orderId)}/status`);
function hasValidSignature(payload) { if (!config.midtransConfigured || !payload?.signature_key) return false; const source = `${payload.order_id}${payload.status_code}${payload.gross_amount}${config.serverKey}`; return crypto.createHash("sha512").update(source).digest("hex") === payload.signature_key; }

module.exports = { createSnapTransaction, getTransactionStatus, hasValidSignature, normalizeMidtransStatus };
