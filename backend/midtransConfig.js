const placeholderValues = new Set(["PLACEHOLDER", "YOUR_SANDBOX_SERVER_KEY", "YOUR_SANDBOX_CLIENT_KEY"]);
const clean = (value) => String(value ?? "").trim();
const serverKey = clean(process.env.MIDTRANS_SERVER_KEY);
const clientKey = clean(process.env.MIDTRANS_CLIENT_KEY);
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
const hasCredential = (value) => Boolean(value) && !placeholderValues.has(value.toUpperCase());
const midtransConfigured = hasCredential(serverKey) && hasCredential(clientKey);
module.exports = { clientKey, isProduction, midtransConfigured, serverKey, snapBaseUrl: isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com", apiBaseUrl: isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com" };
