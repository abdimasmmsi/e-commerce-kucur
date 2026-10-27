// Mengisi nilai awal Pengaturan Platform untuk UAT (hanya bila masih nilai bawaan createAdmin: PPN 0 dan biaya admin 0).
// Nilai bisa diubah lagi kapan saja di Admin -> Pengaturan Platform. Jalankan di server UAT:
//   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T backend node scripts/uatSettings.js
// Paksa tulis ulang: FORCE=1. Nilai bisa diganti lewat env: UAT_BASE_FEE, UAT_RATE_PER_KM, UAT_TAX_PERCENT, UAT_ADMIN_FEE_PERCENT, UAT_INITIAL_FEE.
require("dotenv").config();
const { getPrisma, disconnectPrisma } = require("../config/prisma");

const num = (name, fallback) => { const value = Number(process.env[name]); return Number.isFinite(value) && value >= 0 ? value : fallback; };

async function main() {
  const prisma = getPrisma();
  const settings = await prisma.targetPlatformSettings.findUnique({ where: { id: "active" } });
  if (!settings) { console.error("PlatformSettings belum ada. Jalankan npm run admin:create dulu."); process.exitCode = 1; return; }
  const pristine = Number(settings.taxPercent) === 0 && Number(settings.adminFeeValue) === 0;
  if (!pristine && process.env.FORCE !== "1") { console.log("Pengaturan sudah diubah sebelumnya; tidak ditimpa (pakai FORCE=1 untuk menimpa)."); return; }
  const data = {
    deliveryBaseFee: num("UAT_BASE_FEE", 6000),
    deliveryRatePerKm: num("UAT_RATE_PER_KM", 1500),
    taxPercent: num("UAT_TAX_PERCENT", 11),
    adminFeeType: "PERCENTAGE",
    adminFeeValue: num("UAT_ADMIN_FEE_PERCENT", 5),
    adminFeeCutoffDay: 7,
    initialStoreFeeAmount: num("UAT_INITIAL_FEE", 100000),
    installmentLateInterestPercent: 2,
    maxDailyDeliveries: 30,
    orderCutoffTime: new Date("1970-01-01T16:00:00Z"),
    dispatchTime: new Date("1970-01-01T17:00:00Z"),
  };
  await prisma.targetPlatformSettings.update({ where: { id: "active" }, data });
  console.log(`Pengaturan UAT diisi: ongkir Rp${data.deliveryBaseFee} untuk 5 km pertama lalu Rp${data.deliveryRatePerKm}/km, PPN ${data.taxPercent}%, biaya admin ${data.adminFeeValue}%, iuran pokok Rp${data.initialStoreFeeAmount}, batas bayar tanggal 7.`);
}

main().catch((error) => { console.error(`Gagal: ${error.message}`); process.exitCode = 1; }).finally(() => disconnectPrisma());
