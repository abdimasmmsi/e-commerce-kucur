// Mengisi server UAT dengan 3 lapak contoh + produk (tanpa akun bawaan @kucur.test), lewat service asli:
// pengajuan lapak -> disetujui admin -> Iuran Pokok lunas dikonfirmasi admin -> produk.
// Pemilik lapak contoh mendapat kata sandi acak yang dicetak sebagai baris "SAMPLE email kata-sandi nama-lapak".
// Aman dijalankan berulang (lapak yang namanya sudah ada dilewati). Prasyarat: akun admin sudah dibuat (npm run admin:create).
//   docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml exec -T backend node scripts/seedUat.js
require("dotenv").config();
const crypto = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createAuthService, hashPassword } = require("../services/authService");
const { createStoreService } = require("../services/storeService");
const { createFinanceService } = require("../services/financeService");
const { createProductService } = require("../services/productService");
const { createCommerceService } = require("../services/commerceService");
const { createUserService } = require("../services/userService");

const DOMAIN = "kucur.example";
const defs = [
  {
    key: "keripik", owner: { email: `lapak.keripik@${DOMAIN}`, fullName: "Pemilik Lapak Keripik (contoh)", phone: "081230003001" },
    store: { name: "Keripik Bu Sulastri (contoh)", description: "Aneka keripik rumahan dari tempe, singkong, dan pisang hasil kebun warga Desa Kucur. Data contoh untuk UAT.", phone: "081230003001", location: { address: "Dusun Krajan RT 01/RW 02, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9571, longitude: 112.5429 } },
    products: [
      { name: "Keripik Tempe Original", category: "Makanan Ringan", price: 15000, stock: 60, description: "Keripik tempe tipis dan renyah dengan bumbu bawang dan ketumbar. Kemasan 200 gram." },
      { name: "Keripik Singkong Balado", category: "Makanan Ringan", description: "Singkong kebun Kucur diiris tipis dengan bumbu balado manis pedas.", variants: { group: "Ukuran", rows: [["250 gr", 14000, 40], ["500 gr", 26000, 25]] } },
      { name: "Keripik Pisang Manis", category: "Makanan Ringan", price: 18000, stock: 35, description: "Pisang kepok matang dengan lapisan gula aren tipis. Kemasan 250 gram." },
      { name: "Rengginang Ketan", category: "Makanan Ringan", price: 20000, stock: 20, description: "Rengginang ketan mentah siap goreng, dijemur alami. Isi 20 keping." },
    ],
  },
  {
    key: "kopi", owner: { email: `lapak.kopi@${DOMAIN}`, fullName: "Pemilik Lapak Kopi dan Madu (contoh)", phone: "081230003002" },
    store: { name: "Kopi dan Madu Lereng Kawi (contoh)", description: "Kopi robusta petik merah dan madu klanceng dari peternak lebah lokal. Data contoh untuk UAT.", phone: "081230003002", location: { address: "Dusun Sumberbendo RT 02/RW 04, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9612, longitude: 112.5378 } },
    products: [
      { name: "Kopi Robusta Bubuk", category: "Minuman", description: "Robusta petik merah, disangrai medium dan digiling halus.", variants: { group: "Berat", rows: [["100 gr", 18000, 50], ["250 gr", 40000, 30]] } },
      { name: "Kopi Robusta Biji Sangrai 250 gr", category: "Minuman", price: 42000, stock: 25, description: "Biji kopi sangrai medium untuk diseduh sendiri di rumah." },
      { name: "Madu Klanceng 250 ml", category: "Hasil Pertanian", price: 85000, stock: 15, description: "Madu lebah klanceng (trigona) asli, rasa manis asam segar." },
      { name: "Gula Aren Cetak 500 gr", category: "Hasil Pertanian", price: 23000, stock: 40, description: "Gula aren cetak dari nira pohon aren warga sekitar Kucur." },
    ],
  },
  {
    key: "bambu", owner: { email: `lapak.bambu@${DOMAIN}`, fullName: "Pemilik Lapak Anyaman Bambu (contoh)", phone: "081230003003" },
    store: { name: "Anyaman Bambu Pak Slamet (contoh)", description: "Kerajinan anyaman bambu buatan tangan: besek, tampah, dan lampu hias. Data contoh untuk UAT.", phone: "081230003003", location: { address: "Dusun Sumberbendo RT 01/RW 03, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9627, longitude: 112.5402 } },
    products: [
      { name: "Besek Bambu Set 10", category: "Kerajinan", price: 35000, stock: 20, description: "Besek anyaman bambu untuk wadah makanan dan hantaran, isi 10 buah." },
      { name: "Tampah Bambu Diameter 50 cm", category: "Kerajinan", price: 30000, stock: 15, description: "Tampah anyaman rapat, kuat untuk menampi beras atau dekorasi." },
      { name: "Lampu Hias Anyaman Bambu", category: "Kerajinan", price: 95000, stock: 8, description: "Kap lampu gantung dari anyaman bambu, cahaya hangat untuk ruang tamu." },
    ],
  },
];

async function main() {
  const prisma = getPrisma();
  const devAccounts = await prisma.targetUser.count({ where: { email: { endsWith: "@kucur.test" } } });
  if (devAccounts) throw new Error(`Ditemukan ${devAccounts} akun @kucur.test: ini database dev/demo, bukan server UAT. Dibatalkan.`);
  const adminRow = await prisma.targetUser.findFirst({ where: { roles: { some: { role: "ADMIN" } } } });
  if (!adminRow) throw new Error("Belum ada akun admin. Jalankan npm run admin:create dulu.");
  const settings = await prisma.targetPlatformSettings.findUnique({ where: { id: "active" } });
  if (!settings) throw new Error("PlatformSettings belum ada. Jalankan npm run admin:create dulu.");

  const repo = createFinalPrismaRepository(prisma);
  const auth = createAuthService(repo);
  const stores = createStoreService(repo);
  const finance = createFinanceService(repo);
  const products = createProductService(repo);
  const admin = { id: adminRow.id, roles: ["admin"] };

  for (const def of defs) {
    const password = process.env.SAMPLE_PASSWORD || crypto.randomBytes(9).toString("hex");
    if (await prisma.targetStore.findFirst({ where: { name: def.store.name } })) {
      console.log(`Lewati (sudah ada): ${def.store.name}`);
      // Kata sandi bersama (SAMPLE_PASSWORD) diterapkan juga ke pemilik yang sudah ada supaya cocok dengan panel akun di halaman Masuk.
      if (process.env.SAMPLE_PASSWORD) {
        const result = await prisma.targetUser.updateMany({ where: { email: def.owner.email }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), passwordResetRequired: false } });
        if (result.count) console.log(`SAMPLE ${def.owner.email} ${password} ${def.store.name}`);
      }
      continue;
    }
    const home = def.store.location;
    const owner = await auth.register({ ...def.owner, password, address: { label: "Rumah", recipientName: def.owner.fullName, phone: def.owner.phone, address: home.address, latitude: home.latitude, longitude: home.longitude } });
    const actor = { id: owner.id, roles: ["customer", "merchant"] };
    const store = await stores.create({ ...def.store, type: "product" }, { id: owner.id, roles: ["customer"] });
    await stores.reviewApplication(store.id, { status: "APPROVED" }, admin);
    const contract = await finance.setupInitialFee(store.id, { planType: "FULL" }, actor);
    const first = contract.installments[0];
    const payment = await finance.submitInstallmentPayment(store.id, first.id, { amount: first.principalOutstanding, provider: "MANUAL" }, actor);
    await finance.confirmPayment("installment", payment.id, admin);
    for (const [index, item] of def.products.entries()) {
      const input = { storeId: store.id, name: item.name, description: item.description, category: item.category, status: "active", images: [] };
      if (item.variants) Object.assign(input, { hasVariants: true, variantGroups: [{ name: item.variants.group, options: item.variants.rows.map((row) => row[0]) }], variants: item.variants.rows.map(([option, price, stock], i) => ({ sku: `${def.key.toUpperCase()}-${index + 1}-${i + 1}`, options: { [item.variants.group]: option }, price, stock, status: "active" })) });
      else Object.assign(input, { hasVariants: false, price: item.price, stock: item.stock });
      await products.create(input, actor);
    }
    console.log(`Lapak dibuat: ${def.store.name} (${def.products.length} produk)`);
    console.log(`SAMPLE ${def.owner.email} ${password} ${def.store.name}`);
  }
  await seedCourierAndOrders({ prisma, repo, auth, admin });
}

// Akun kurir contoh + pembeli contoh + 3 pesanan COD (satu per lapak) yang sudah dikemas dan siap diambil,
// supaya Admin bisa menyusun jadwal pengiriman dan kurir bisa dicoba. Aman diulang (dilewati bila sudah ada).
async function seedCourierAndOrders({ prisma, repo, auth, admin }) {
  const password = process.env.SAMPLE_PASSWORD || crypto.randomBytes(9).toString("hex");
  const courierEmail = `kurir.uat@${DOMAIN}`;
  const customerEmail = `pembeli.contoh@${DOMAIN}`;
  let courier = await prisma.targetUser.findFirst({ where: { email: courierEmail } });
  if (!courier) {
    const created = await createUserService(repo).createCourier({ id: admin.id, roles: ["admin"] }, { fullName: "Kurir Contoh UAT", email: courierEmail, phone: "081230004001", maxActiveDeliveries: 10 });
    courier = { id: created.user.id };
  }
  // Kata sandi acak khusus UAT (bukan kata sandi awal standar) dan tidak wajib diganti, supaya langsung bisa dicoba.
  await prisma.targetUser.update({ where: { id: courier.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), passwordResetRequired: false } });
  console.log(`CREDS ${courierEmail} ${password} Kurir contoh`);
  // Kurir sisa uji coba (mis. "Kurir Smoke") dinonaktifkan supaya draf jadwal hanya jatuh ke kurir contoh.
  const stale = await prisma.targetCourierProfile.updateMany({ where: { userId: { not: courier.id }, isActive: true }, data: { isActive: false } });
  if (stale.count) console.log(`Kurir lain dinonaktifkan: ${stale.count}`);

  let customer = await prisma.targetUser.findFirst({ where: { email: customerEmail } });
  const home = { address: "Dusun Krajan RT 02/RW 01, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9551, longitude: 112.5489 };
  if (!customer) customer = await auth.register({ email: customerEmail, fullName: "Pembeli Contoh UAT", phone: "081230004002", password, address: { label: "Rumah", recipientName: "Pembeli Contoh UAT", phone: "081230004002", address: home.address, latitude: home.latitude, longitude: home.longitude } });
  else await prisma.targetUser.update({ where: { id: customer.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), passwordResetRequired: false } });
  console.log(`CREDS ${customerEmail} ${password} Pembeli contoh`);

  if (await prisma.targetCommerceOrder.count({ where: { customerUserId: customer.id } })) { console.log("Lewati pesanan contoh (sudah ada)."); return; }
  const commerce = createCommerceService(repo);
  const customerActor = { id: customer.id, roles: ["customer"] };
  for (const def of defs) {
    const owner = await prisma.targetUser.findFirst({ where: { email: def.owner.email } });
    const store = await prisma.targetStore.findFirst({ where: { name: def.store.name } });
    const product = await prisma.targetProduct.findFirst({ where: { storeId: store.id, status: "ACTIVE" }, include: { variants: true }, orderBy: { createdAt: "asc" } });
    if (!owner || !store || !product) continue;
    const item = { productId: product.id, quantity: 1, ...(product.variants?.length ? { productVariantId: product.variants[0].id } : {}) };
    const created = await commerce.create({ items: [item], paymentMethod: "COD", courierTip: 0, delivery: { address: home.address, recipientName: "Pembeli Contoh UAT", recipientPhone: "081230004002", location: { latitude: home.latitude, longitude: home.longitude } } }, customerActor, `uat-seed-${def.key}`);
    const merchant = { id: owner.id, roles: ["customer", "merchant"] };
    for (const order of created.orders || created) for (const step of ["confirmed", "processing", "ready-for-pickup"]) await commerce.transition(order.id, step, merchant);
    console.log(`Pesanan contoh siap diambil: ${def.store.name}`);
  }
}

main().catch((error) => { console.error(`Gagal: ${error.message}`); process.exitCode = 1; }).finally(() => disconnectPrisma());
