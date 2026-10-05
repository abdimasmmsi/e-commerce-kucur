const { errors } = require("../errors/AppError");

// Batas percobaan endpoint auth (ubah di sini bila perlu).
const MINUTE = 60 * 1000;
const LOGIN_PER_ACCOUNT = { max: 10, windowMs: 15 * MINUTE };
const LOGIN_FAILED_PER_IP = { max: 30, windowMs: 15 * MINUTE };
const REGISTER_PER_IP = { max: 10, windowMs: 60 * MINUTE };
const EMAIL_STATUS_PER_IP = { max: 30, windowMs: 10 * MINUTE };
const MAX_KEYS = 50000;

const isLoopback = (ip) => ip === "::1" || /^(::ffff:)?127\./.test(String(ip || ""));

// Pengecualian dihitung dari req.ip (IP klien asli setelah "trust proxy"), bukan alamat soket.
// Loopback = e2e/backend test/desktop di laptop sendiri; pengguna HP lewat proxy Vite punya IP Wi-Fi sendiri.
const defaultSkip = () => {
  const disabled = process.env.NODE_ENV === "test" || process.env.RATE_LIMIT_DISABLED === "true";
  const limitLocal = process.env.RATE_LIMIT_LOCAL === "true";
  return (req) => disabled || (!limitLocal && isLoopback(req.ip));
};

// Fixed window per kunci di memori. onSuccess: "reset" hapus hitungan, "uncount" hanya hitung yang gagal.
function createRateLimiter({ max, windowMs, key, onSuccess = null, skip = defaultSkip(), now = Date.now, message } = {}) {
  const hits = new Map();
  const sweep = () => { const time = now(); for (const [name, entry] of hits) if (entry.resetAt <= time) hits.delete(name); };
  const timer = setInterval(sweep, Math.min(windowMs, 10 * MINUTE));
  timer.unref?.();
  const middleware = (req, res, next) => {
    if (skip(req)) return next();
    const name = key(req);
    const time = now();
    let entry = hits.get(name);
    if (!entry || entry.resetAt <= time) {
      if (!entry && hits.size >= MAX_KEYS) sweep();
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(name, entry);
    }
    if (entry.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
      res.set("Retry-After", String(retryAfter));
      return next(errors.tooManyRequests(message, { retryAfterSeconds: retryAfter }));
    }
    entry.count += 1;
    if (onSuccess) res.on("finish", () => {
      if (res.statusCode >= 400 || hits.get(name) !== entry) return;
      if (onSuccess === "reset") hits.delete(name);
      else entry.count = Math.max(0, entry.count - 1);
    });
    return next();
  };
  middleware.stop = () => clearInterval(timer);
  middleware.sweep = sweep;
  middleware.size = () => hits.size;
  return middleware;
}

const ipKey = (req) => String(req.ip || "unknown");
const emailKey = (req) => `${ipKey(req)}|${String(req.body?.email || "").trim().toLowerCase().slice(0, 254)}`;

// limits: override per limiter (dipakai test), mis. { register: { max: 2 } }.
function createAuthRateLimits({ skip, now, limits = {} } = {}) {
  const build = (name, limit, extra) => createRateLimiter({ ...limit, ...limits[name], ...extra, skip, now });
  return {
    loginPerIp: build("loginPerIp", LOGIN_FAILED_PER_IP, { key: ipKey, onSuccess: "uncount" }),
    loginPerAccount: build("loginPerAccount", LOGIN_PER_ACCOUNT, { key: emailKey, onSuccess: "reset" }),
    register: build("register", REGISTER_PER_IP, { key: ipKey }),
    emailStatus: build("emailStatus", EMAIL_STATUS_PER_IP, { key: ipKey }),
  };
}

module.exports = { createRateLimiter, createAuthRateLimits, isLoopback, LOGIN_PER_ACCOUNT, LOGIN_FAILED_PER_IP, REGISTER_PER_IP, EMAIL_STATUS_PER_IP };
