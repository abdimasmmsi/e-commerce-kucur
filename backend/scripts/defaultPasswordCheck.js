// Cari akun yang masih memakai kata sandi bawaan (akun QA/demo & kurir baru yang belum ganti sandi).
//   node scripts/defaultPasswordCheck.js          → daftar akun
//   NODE_ENV=production ... → exit code 1 bila ada (dipakai sebagai gerbang sebelum go-live)
// Sebelum dibuka ke publik: hapus akun QA atau ganti sandinya lewat Admin → Pengguna → atur ulang kata sandi.
require("dotenv").config({ quiet: true });
const { verifyPassword } = require("../services/authService");
const { getPrisma } = require("../config/prisma");

const DEFAULTS = ["KucurDev123!", "KurirKucur123!", "KucurTest123!", "password", "12345678", "admin123"];
(async () => {
  const prisma = getPrisma();
  const users = await prisma.targetUser.findMany({ select: { email: true, passwordHash: true, isActive: true } });
  const found = [];
  for (const user of users) for (const candidate of DEFAULTS) { if (await verifyPassword(candidate, user.passwordHash).catch(() => false)) { found.push({ email: user.email, aktif: user.isActive, sandi: candidate }); break; } }
  console.log(`${users.length} akun diperiksa, ${found.length} masih memakai kata sandi bawaan:`);
  found.forEach((row) => console.log(`  - ${row.email} (aktif: ${row.aktif})`));
  await prisma.$disconnect();
  process.exit(found.length && process.env.NODE_ENV === "production" ? 1 : 0);
})().catch((error) => { console.error(error.message); process.exit(2); });
