const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { errors } = require("../errors/AppError");
const { requiredString, validateEmail, validatePhone } = require("../validation/sharedValidation");

const scrypt = promisify(crypto.scrypt);
const PASSWORD_ROTATION_MONTHS = 3;
const passwordSecurity = (user) => {
  const changedAt = new Date(user.passwordChangedAt || user.createdAt || Date.now());
  const recommendedChangeAt = new Date(changedAt);
  recommendedChangeAt.setUTCMonth(recommendedChangeAt.getUTCMonth() + PASSWORD_ROTATION_MONTHS);
  return {
    changedAt: changedAt.toISOString(),
    recommendedChangeAt: recommendedChangeAt.toISOString(),
    rotationRecommended: Date.now() >= recommendedChangeAt.getTime(),
    resetRequired: Boolean(user.passwordResetRequired),
  };
};
const publicUser = ({ passwordHash, passwordChangedAt, passwordResetRequired, language = "en", theme = "light", ...user }) => ({
  ...user,
  preferences: { language: language === "id" ? "id" : "en", theme: theme === "dark" ? "dark" : "light" },
  passwordSecurity: passwordSecurity({ ...user, passwordChangedAt, passwordResetRequired }),
});

async function hashPassword(password) {
  const value = requiredString(password, "password", { max: 128 });
  if (value.length < 8) throw errors.validation({ password: "Password minimal 8 karakter." });
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(value, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const [, salt, expectedHex] = String(encoded).split(":");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createAuthService(repository) {
  const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
  const sessionLifetimeMs = Math.max(1, Number(process.env.AUTH_SESSION_TTL_HOURS) || 12) * 60 * 60 * 1000;
  return {
    publicUser,
    async register(input) {
      const email = validateEmail(input.email);
      if (await repository.users.findByEmail(email)) throw errors.conflict("Email sudah digunakan.");
      const timestamp = new Date().toISOString();
      const user = await repository.users.create({ fullName: requiredString(input.fullName, "fullName", { max: 120 }), email, phone: validatePhone(input.phone), passwordHash: await hashPassword(input.password), passwordChangedAt: timestamp, passwordResetRequired: false, status: "active", language: "en", theme: "light", roles: ["customer"], createdAt: timestamp, updatedAt: timestamp });
      return publicUser(user);
    },
    async login(input) {
      const user = await repository.users.findByEmail(validateEmail(input.email));
      if (!user || user.status !== "active" || !(await verifyPassword(input.password, user.passwordHash))) throw errors.unauthenticated("Email atau password salah.");
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + sessionLifetimeMs);
      await repository.sessions.create({ tokenHash: tokenHash(token), userId: user.id, expiresAt });
      return { token, expiresAt: expiresAt.toISOString(), user: publicUser(user) };
    },
    async authenticate(token) {
      const session = await repository.sessions.findActiveByTokenHash(tokenHash(token));
      return session?.user?.status === "active" ? publicUser(session.user) : null;
    },
    revoke(token) { return repository.sessions.revokeByTokenHash(tokenHash(token)); },
  };
}

module.exports = { createAuthService, hashPassword, passwordSecurity, publicUser, verifyPassword };
