const parseOrigins = (value) => String(value || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  allowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
  databaseUrl: process.env.DATABASE_URL || null,
  authSessionTtlHours: Math.max(1, Number(process.env.AUTH_SESSION_TTL_HOURS) || 12),
};
