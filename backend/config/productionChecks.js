// Peringatan konfigurasi saat server dijalankan dengan NODE_ENV=production (hanya mencatat, tidak menghentikan server).
async function productionWarnings({ repository, env }) {
  if (env.nodeEnv !== "production") return [];
  const warnings = [];
  const local = /localhost|127\.0\.0\.1/;
  if (!process.env.CORS_ALLOWED_ORIGINS) warnings.push("CORS_ALLOWED_ORIGINS belum diatur: hanya localhost yang diizinkan, domain asli akan ditolak browser.");
  if (env.allowedOrigins.some((origin) => origin.startsWith("http://") && !local.test(origin))) warnings.push("Ada origin http:// (bukan HTTPS) di CORS_ALLOWED_ORIGINS.");
  if (env.allowedOrigins.some((origin) => local.test(origin))) warnings.push("Origin localhost masih diizinkan di CORS_ALLOWED_ORIGINS.");
  try {
    const users = await repository.users.list();
    const qa = users.filter((user) => /@kucur\.test$/i.test(String(user.email))).length;
    if (qa) warnings.push(`${qa} akun @kucur.test (QA/demo) masih ada: hapus atau ganti kata sandinya (npm run security:passwords).`);
  } catch { /* pemeriksaan akun gagal: abaikan */ }
  return warnings;
}

module.exports = { productionWarnings };
