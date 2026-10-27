// Membuat (atau memperbarui kata sandi) satu akun Admin dari variabel lingkungan.
//   ADMIN_EMAIL=admin@desa.id ADMIN_PASSWORD='...min 12 karakter...' ADMIN_NAME='Nama Admin' npm run admin:create
// Opsional: ADMIN_PHONE. Kata sandi tidak pernah dicetak. Aman dijalankan berulang (idempotent).
// Di Docker: docker compose ... exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... backend npm run admin:create
require("dotenv").config();
const crypto = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { hashPassword } = require("../services/authService");
const { validateEmail, validatePhone } = require("../validation/sharedValidation");

const fail = (message) => { console.error(`Gagal: ${message}`); process.exitCode = 1; };

async function main() {
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = String(process.env.ADMIN_NAME || "Admin Kucur").trim().slice(0, 120);
  if (!rawEmail || !password) return fail("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi.");
  if (password.length < 12) return fail("ADMIN_PASSWORD minimal 12 karakter.");
  if (password.length > 128) return fail("ADMIN_PASSWORD maksimal 128 karakter.");
  let email, phone;
  try { email = validateEmail(rawEmail); phone = validatePhone(process.env.ADMIN_PHONE || "081200000000"); } catch (error) { return fail(error.details ? JSON.stringify(error.details) : error.message); }
  if (/@kucur\.test$/i.test(email) && process.env.NODE_ENV === "production") return fail("Jangan pakai email @kucur.test di produksi.");

  const prisma = getPrisma();
  const now = new Date();
  const passwordHash = await hashPassword(password);
  const existing = await prisma.targetUser.findUnique({ where: { email } });
  let userId;
  if (existing) {
    userId = existing.id;
    await prisma.targetUser.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now, passwordResetRequired: false, isActive: true, fullName } });
    // Cabut sesi lama supaya kata sandi lama tidak berlaku lagi.
    await prisma.targetSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  } else {
    userId = crypto.randomUUID();
    await prisma.targetUser.create({ data: { id: userId, email, fullName, phone, passwordHash, passwordChangedAt: now, passwordResetRequired: false, isActive: true, language: "id", theme: "light" } });
  }
  await prisma.targetUserRole.upsert({ where: { userId_role: { userId, role: "ADMIN" } }, update: {}, create: { userId, role: "ADMIN" } });

  // Baris PlatformSettings ("active") harus ada; nilai awal bisa diubah Admin di Pengaturan Platform.
  const settings = await prisma.targetPlatformSettings.findUnique({ where: { id: "active" } });
  if (!settings) {
    await prisma.targetPlatformSettings.create({ data: {
      id: "active", deliveryBaseFee: 6000, deliveryRatePerKm: 1500, taxPercent: 0, maxDailyDeliveries: 20,
      orderCutoffTime: new Date("1970-01-01T16:00:00Z"), dispatchTime: new Date("1970-01-01T17:00:00Z"),
      adminFeeCutoffDay: 7, updatedByUserId: userId,
    } });
    console.log("PlatformSettings dibuat dengan nilai awal (ongkir/km 0, PPN 0%). Atur di Pengaturan Platform setelah masuk.");
  }
  console.log(`${existing ? "Akun diperbarui" : "Akun admin dibuat"}: ${email}`);
}

main().catch((error) => fail(error.message)).finally(() => disconnectPrisma());
