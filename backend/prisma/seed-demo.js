// Seed data demo (untuk screenshot jurnal & demo TA) ke database terpisah `kucur_demo`.
// Data dasar diinsert langsung; order, pengiriman, iuran, ulasan, dan chat dibuat lewat service asli
// dengan jam simulasi agar riwayat tersebar ~4 minggu ke belakang dan tetap konsisten.
// Jalankan: npm run db:seed:demo   (butuh DATABASE_URL yang menunjuk ke .../kucur_demo)
const { randomUUID } = require("node:crypto");

const RealDate = Date;
let fakeNow = RealDate.now();
class SimDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(fakeNow); else super(...args); }
  static now() { return fakeNow; }
}
global.Date = SimDate;

const { Prisma } = require("@prisma/client");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createAuthService } = require("../services/authService");
const { createStoreService } = require("../services/storeService");
const { createFinanceService } = require("../services/financeService");
const { createProductService } = require("../services/productService");
const { createCommerceService } = require("../services/commerceService");
const { createDeliveryService } = require("../services/deliveryService");
const { createReviewService } = require("../services/reviewService");
const { createChatService } = require("../services/chatService");

if (!/\/kucur_demo(\?|$)/.test(process.env.DATABASE_URL || "")) {
  console.error("seed-demo hanya boleh dijalankan ke database kucur_demo. Set DATABASE_URL ke .../kucur_demo.");
  process.exit(1);
}

const PASSWORD = "KucurDev123!";
const DAY = 24 * 60 * 60 * 1000;
const prisma = getPrisma();
const repo = createFinalPrismaRepository(prisma);
const auth = createAuthService(repo);
const stores = createStoreService(repo);
const finance = createFinanceService(repo);
const products = createProductService(repo);
const commerce = createCommerceService(repo);
const delivery = createDeliveryService(repo);
const reviews = createReviewService(repo);
const chats = createChatService(repo);

// Jam simulasi: tanggal relatif terhadap hari ini (WIB = UTC+7).
const today = new RealDate();
const wib = (daysAgo, hour, minute = 0) => {
  const base = new RealDate(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return base.getTime() - daysAgo * DAY + (hour - 7) * 60 * 60 * 1000 + minute * 60 * 1000;
};

// Rows yang dibuat/diubah oleh engine Prisma memakai jam nyata; geser ke jam simulasi setelah tiap langkah.
const timedModels = Prisma.dmmf.datamodel.models
  .filter((model) => model.name.startsWith("Target"))
  .map((model) => ({ key: model.name[0].toLowerCase() + model.name.slice(1), fields: new Set(model.fields.map((field) => field.name)) }))
  .filter((model) => model.fields.has("createdAt"));
async function at(time, work) {
  fakeNow = time;
  const realStart = new RealDate(RealDate.now() - 1000);
  const result = await work();
  const stamp = new RealDate(time);
  for (const model of timedModels) {
    await prisma[model.key].updateMany({ where: { createdAt: { gte: realStart } }, data: { createdAt: stamp } });
    if (model.fields.has("updatedAt")) await prisma[model.key].updateMany({ where: { updatedAt: { gte: realStart } }, data: { updatedAt: stamp } });
  }
  return result;
}

const actor = (user, ...roles) => ({ id: user.id, fullName: user.fullName, roles });

// ---------------------------------------------------------------- data
const people = {
  admin: { email: "admin@kucur.test", fullName: "Pengelola Desa Kucur", phone: "081230001001" },
  customer: { email: "customer@kucur.test", fullName: "Rina Ayu Lestari", phone: "081230002001" },
  merchantA: { email: "merchant.a@kucur.test", fullName: "Sulastri", phone: "081230003001" },
  merchantB: { email: "merchant.b@kucur.test", fullName: "Darmaji", phone: "081230003002" },
  courier: { email: "courier@kucur.test", fullName: "Agus Setiawan", phone: "081230004001" },
  courier2: { email: "kurir.dedi@kucur.test", fullName: "Dedi Firmansyah", phone: "081230004002" },
  merchantC: { email: "jamur.wahyu@kucur.test", fullName: "Wahyu Hidayat", phone: "081230003003" },
  merchantD: { email: "bambu.slamet@kucur.test", fullName: "Slamet Riyadi", phone: "081230003004" },
  customer2: { email: "budi.santoso@kucur.test", fullName: "Budi Santoso", phone: "081230002002" },
  customer3: { email: "dewi.anggraini@kucur.test", fullName: "Dewi Anggraini", phone: "081230002003" },
  customer4: { email: "fajar.nugroho@kucur.test", fullName: "Fajar Nugroho", phone: "081230002004" },
  applicant: { email: "yem.aren@kucur.test", fullName: "Mbok Yem", phone: "081230002005" },
};

const addresses = {
  customer: { address: "Jl. Raya Tlogomas No. 21, Lowokwaru, Kota Malang", recipientName: "Rina Ayu Lestari", recipientPhone: "081230002001", location: { latitude: -7.9302, longitude: 112.5995 } },
  customer2: { address: "Perum Landungsari Asri Blok C-7, Dau, Kab. Malang", recipientName: "Budi Santoso", recipientPhone: "081230002002", location: { latitude: -7.9268, longitude: 112.5868 } },
  customer3: { address: "Jl. Sengkaling Indah No. 5, Mulyoagung, Dau", recipientName: "Dewi Anggraini", recipientPhone: "081230002003", location: { latitude: -7.9167, longitude: 112.5878 } },
  customer4: { address: "Dusun Krajan RT 02/RW 01, Desa Kucur, Dau", recipientName: "Fajar Nugroho", recipientPhone: "081230002004", location: { latitude: -7.9551, longitude: 112.5489 } },
};

const storeDefs = [
  { key: "keripik", owner: "merchantA", plan: "FULL", name: "Keripik Bu Sulastri", description: "Aneka keripik rumahan dari tempe, singkong, dan pisang hasil kebun warga Desa Kucur. Digoreng setiap pagi tanpa pengawet.", phone: "081230003001", location: { address: "Dusun Krajan RT 01/RW 02, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9571, longitude: 112.5429 } },
  { key: "susu", owner: "merchantA", plan: "THREE_MONTHS", name: "Olahan Susu Sapi Kucur", description: "Susu segar dari peternak sapi perah Desa Kucur, diolah jadi susu pasteurisasi, yogurt, dan dodol susu.", phone: "081230003001", location: { address: "Dusun Krajan RT 03/RW 02, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9583, longitude: 112.5441 } },
  { key: "kopi", owner: "merchantB", plan: "FULL", name: "Kopi & Madu Lereng Kawi", description: "Kopi robusta petik merah dari lereng Gunung Kawi dan madu klanceng dari peternak lebah lokal.", phone: "081230003002", location: { address: "Dusun Sumberbendo RT 02/RW 04, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9612, longitude: 112.5378 } },
  { key: "jamur", owner: "merchantC", plan: "SIX_MONTHS", name: "Jamur Tiram Sumber Kucur", description: "Budidaya jamur tiram warga, dijual segar setiap hari dan diolah jadi jamur crispy.", phone: "081230003003", location: { address: "Dusun Kucur Krajan RT 04/RW 01, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9548, longitude: 112.5463 } },
  { key: "bambu", owner: "merchantD", plan: "THREE_MONTHS", name: "Anyaman Bambu Pak Slamet", description: "Kerajinan anyaman bambu buatan tangan: besek, tampah, dan lampu hias untuk rumah maupun suvenir.", phone: "081230003004", location: { address: "Dusun Sumberbendo RT 01/RW 03, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9627, longitude: 112.5402 } },
];

const productDefs = {
  keripik: [
    { name: "Keripik Tempe Original", category: "Makanan Ringan", price: 15000, stock: 60, description: "Keripik tempe tipis dan renyah dengan bumbu bawang dan ketumbar. Kemasan 200 gram." },
    { name: "Keripik Singkong Balado", category: "Makanan Ringan", description: "Singkong kebun Kucur diiris tipis dengan bumbu balado manis pedas.", variants: { group: "Ukuran", rows: [["250 gr", 14000, 40], ["500 gr", 26000, 25]] } },
    { name: "Keripik Pisang Manis", category: "Makanan Ringan", price: 18000, stock: 35, description: "Pisang kepok matang dengan lapisan gula aren tipis. Kemasan 250 gram." },
    { name: "Rengginang Ketan", category: "Makanan Ringan", price: 20000, stock: 20, description: "Rengginang ketan mentah siap goreng, dijemur alami. Isi 20 keping." },
  ],
  susu: [
    { name: "Susu Sapi Pasteurisasi", category: "Minuman", description: "Susu sapi segar yang dipasteurisasi, tanpa bahan pengawet. Simpan di kulkas.", variants: { group: "Rasa", rows: [["Original", 8000, 50], ["Cokelat", 9000, 40], ["Stroberi", 9000, 30]] } },
    { name: "Yogurt Plain 500 ml", category: "Minuman", price: 22000, stock: 25, description: "Yogurt dari susu sapi Kucur, asam segar, cocok untuk sarapan." },
    { name: "Dodol Susu", category: "Makanan Ringan", price: 25000, stock: 30, description: "Dodol susu legit khas peternak Dau. Isi 20 bungkus kecil." },
  ],
  kopi: [
    { name: "Kopi Robusta Bubuk", category: "Minuman", description: "Robusta petik merah, disangrai medium dan digiling halus.", variants: { group: "Berat", rows: [["100 gr", 18000, 50], ["250 gr", 40000, 30]] } },
    { name: "Kopi Robusta Biji Sangrai 250 gr", category: "Minuman", price: 42000, stock: 25, description: "Biji kopi sangrai medium untuk diseduh sendiri di rumah." },
    { name: "Madu Klanceng 250 ml", category: "Hasil Pertanian", price: 85000, stock: 15, description: "Madu lebah klanceng (trigona) asli, rasa manis asam segar." },
    { name: "Gula Aren Cetak 500 gr", category: "Hasil Pertanian", price: 23000, stock: 40, description: "Gula aren cetak dari nira pohon aren warga sekitar Kucur." },
  ],
  jamur: [
    { name: "Jamur Tiram Segar 500 gr", category: "Hasil Pertanian", price: 12000, stock: 40, description: "Jamur tiram dipanen pagi hari, cocok untuk tumis dan sup." },
    { name: "Jamur Crispy", category: "Makanan Ringan", description: "Jamur tiram goreng tepung yang renyah, kemasan 150 gram.", variants: { group: "Rasa", rows: [["Original", 15000, 30], ["Pedas", 15000, 30], ["Keju", 17000, 20]] } },
    { name: "Bibit Jamur Tiram (Baglog)", category: "Hasil Pertanian", price: 4500, stock: 100, description: "Baglog siap tumbuh untuk budidaya jamur tiram di rumah." },
  ],
  bambu: [
    { name: "Besek Bambu Set 10", category: "Kerajinan", price: 35000, stock: 20, description: "Besek anyaman bambu untuk wadah makanan dan hantaran, isi 10 buah." },
    { name: "Tampah Bambu Diameter 50 cm", category: "Kerajinan", price: 30000, stock: 15, description: "Tampah anyaman rapat, kuat untuk menampi beras atau dekorasi." },
    { name: "Lampu Hias Anyaman Bambu", category: "Kerajinan", price: 95000, stock: 8, description: "Kap lampu gantung dari anyaman bambu, cahaya hangat untuk ruang tamu." },
  ],
};

// Jadwal order: [hari lalu, jam, customer, [[store, produkIndex, qty, varianIndex?], ...], tip, nasib]
// nasib: done (selesai + ulasan), done-noreview, cancel, processing, ready, delivery, pending
const orderPlan = [
  [27, 9, "customer", [["keripik", 0, 2], ["kopi", 0, 1, 0]], 2000, "done"],
  [26, 10, "customer2", [["jamur", 0, 2]], 0, "done"],
  [25, 11, "customer3", [["susu", 0, 3, 0], ["susu", 2, 1]], 0, "done"],
  [24, 8, "customer4", [["bambu", 0, 1]], 5000, "done"],
  [22, 13, "customer", [["kopi", 2, 1]], 0, "done"],
  [21, 9, "customer2", [["keripik", 1, 2, 0]], 0, "done-noreview"],
  [20, 10, "customer3", [["jamur", 1, 2, 1], ["keripik", 2, 1]], 3000, "done"],
  [18, 14, "customer4", [["susu", 1, 2]], 0, "cancel"],
  [17, 9, "customer", [["bambu", 2, 1]], 5000, "done"],
  [15, 11, "customer2", [["kopi", 1, 1], ["kopi", 3, 2]], 0, "done"],
  [14, 10, "customer3", [["keripik", 0, 3]], 0, "done"],
  [13, 8, "customer4", [["jamur", 2, 10]], 0, "done-noreview"],
  [11, 13, "customer", [["susu", 0, 2, 1], ["jamur", 1, 1, 0]], 2000, "done"],
  [10, 9, "customer2", [["bambu", 1, 1]], 0, "done"],
  [8, 10, "customer3", [["kopi", 0, 2, 1]], 0, "done"],
  [7, 15, "customer4", [["keripik", 3, 2]], 0, "done"],
  [6, 9, "customer", [["jamur", 0, 1], ["keripik", 1, 1, 1]], 0, "done"],
  [5, 11, "customer2", [["susu", 2, 2]], 0, "done-noreview"],
  [4, 10, "customer3", [["bambu", 0, 2]], 3000, "done"],
  [3, 9, "customer4", [["kopi", 2, 1]], 0, "done"],
  [2, 10, "customer", [["keripik", 0, 1], ["susu", 1, 1]], 0, "done"],
  [1, 11, "customer2", [["jamur", 1, 2, 2]], 2000, "done"],
  [1, 14, "customer3", [["kopi", 3, 1]], 0, "done-noreview"],
  [0, 8, "customer4", [["keripik", 2, 2]], 0, "delivery"],
  [0, 8, "customer", [["kopi", 0, 1, 0], ["kopi", 2, 1]], 0, "ready"],
  [0, 9, "customer2", [["susu", 0, 4, 2]], 0, "processing"],
  [0, 10, "customer3", [["bambu", 2, 1]], 0, "pending"],
  [0, 10, "customer", [["jamur", 0, 3]], 0, "pending"],
];

const reviewTexts = [
  [5, "Renyah banget dan bumbunya pas. Pengiriman juga cepat, kurirnya ramah."],
  [5, "Produk lokal yang kualitasnya nggak kalah sama toko besar. Bakal pesan lagi."],
  [4, "Enak, cuma kemasannya bisa dibuat lebih rapat biar tetap renyah."],
  [5, "Segar dan sesuai deskripsi. Senang bisa beli langsung dari warga Kucur."],
  [5, "Mantap! Keluarga di rumah suka semua."],
  [4, "Rasanya enak, harganya juga masuk akal. Sampai sore sesuai jadwal."],
  [3, "Lumayan, tapi ukurannya sedikit lebih kecil dari bayangan saya."],
  [5, "Pesan untuk oleh-oleh, semua suka. Terima kasih!"],
];
const replyTexts = [
  "Terima kasih sudah belanja, ditunggu pesanan berikutnya ya!",
  "Terima kasih masukannya, akan kami perbaiki kemasannya.",
  "Senang sekali produk kami cocok. Salam dari Desa Kucur!",
];

// ---------------------------------------------------------------- langkah
async function main() {
  const existing = await prisma.targetUser.count();
  if (existing) throw new Error(`kucur_demo sudah berisi ${existing} user. Reset dulu database demo sebelum seed ulang.`);

  const start = wib(35, 8);
  const users = {};
  await at(start, async () => {
    for (const [key, person] of Object.entries(people)) {
      const home = addresses[key] ?? { address: "Dusun Krajan, Desa Kucur, Kec. Dau, Kab. Malang", location: { latitude: -7.9562, longitude: 112.5447 } };
      users[key] = await auth.register({ ...person, password: PASSWORD, address: { label: "Rumah", recipientName: person.fullName, phone: person.phone, address: home.address, latitude: home.location.latitude, longitude: home.location.longitude } });
    }
    await prisma.targetUserRole.deleteMany({ where: { userId: { in: [users.admin.id, users.courier.id, users.courier2.id] } } });
    await prisma.targetUserRole.createMany({ data: [{ userId: users.admin.id, role: "ADMIN" }, { userId: users.courier.id, role: "COURIER" }, { userId: users.courier2.id, role: "COURIER" }] });
    for (const key of ["courier", "courier2"]) await prisma.targetCourierProfile.create({ data: { userId: users[key].id, maxActiveDeliveries: 15 } });
    await prisma.targetPlatformSettings.upsert({
      where: { id: "active" },
      update: {},
      create: { id: "active", taxPercent: 11, deliveryRatePerKm: 3500, orderCutoffTime: new RealDate("1970-01-01T16:00:00Z"), dispatchTime: new RealDate("1970-01-01T17:00:00Z"), maxDailyDeliveries: 30, initialStoreFeeAmount: 100000, installmentLateInterestPercent: 2, adminFeeType: "PERCENTAGE", adminFeeValue: 5, adminFeeCutoffDay: 7, adminFeeGraceTime: new RealDate("1970-01-01T12:00:00Z"), suspendStoreForOutstandingAdminFee: true, voluntaryContributionEnabled: true, updatedByUserId: users.admin.id },
    });
  });
  const admin = actor(users.admin, "admin");
  const merchantActor = (key) => actor(users[key], "customer", "merchant");
  const customerActor = (key) => actor(users[key], "customer");
  const courierActor = (key) => actor(users[key], "courier");

  // Lapak: pengajuan -> disetujui Admin -> setup Iuran Pokok -> bayar cicilan pertama -> dikonfirmasi Admin.
  const storeIds = {};
  for (const [index, def] of storeDefs.entries()) {
    const day = 34 - index;
    const store = await at(wib(day, 9), () => stores.create({ name: def.name, type: "product", description: def.description, phone: def.phone, location: def.location }, actor(users[def.owner], "customer")));
    storeIds[def.key] = store.id;
    await at(wib(day, 13), () => stores.reviewApplication(store.id, { status: "APPROVED" }, admin));
    const contract = await at(wib(day, 15), () => finance.setupInitialFee(store.id, { planType: def.plan }, merchantActor(def.owner)));
    const first = contract.installments[0];
    const payment = await at(wib(day, 15, 10), () => finance.submitInstallmentPayment(store.id, first.id, { amount: first.principalOutstanding, provider: "MANUAL" }, merchantActor(def.owner)));
    await at(wib(day, 16), () => finance.confirmPayment("installment", payment.id, admin));
  }
  // Satu pengajuan masih menunggu review Admin.
  await at(wib(1, 19), () => stores.create({ name: "Gula Aren Mbok Yem", type: "product", description: "Gula aren dan gula semut dari nira aren yang dimasak di tungku kayu.", phone: "081230002005", location: { address: "Dusun Sumberbendo RT 03/RW 04, Desa Kucur, Kec. Dau, Kab. Malang", latitude: -7.9634, longitude: 112.5359 } }, actor(users.applicant, "customer")));

  // Produk
  const catalog = {};
  for (const [storeKey, list] of Object.entries(productDefs)) {
    const owner = storeDefs.find((def) => def.key === storeKey).owner;
    catalog[storeKey] = [];
    for (const [index, def] of list.entries()) {
      const input = { storeId: storeIds[storeKey], name: def.name, description: def.description, category: def.category, status: "active", images: [] };
      if (def.variants) Object.assign(input, { hasVariants: true, variantGroups: [{ name: def.variants.group, options: def.variants.rows.map((row) => row[0]) }], variants: def.variants.rows.map(([option, price, stock], i) => ({ sku: `${storeKey.toUpperCase()}-${index + 1}-${i + 1}`, options: { [def.variants.group]: option }, price, stock, status: "active" })) });
      else Object.assign(input, { hasVariants: false, price: def.price, stock: def.stock });
      catalog[storeKey].push(await at(wib(30 - index, 10), () => products.create(input, merchantActor(owner))));
    }
  }

  // Order
  const ownerOf = (storeKey) => storeDefs.find((def) => def.key === storeKey).owner;
  let reviewIndex = 0; let replyIndex = 0;
  const days = [...new Set(orderPlan.map((row) => row[0]))].sort((a, b) => b - a);
  for (const [dayIndex, daysAgo] of days.entries()) {
    // 1. Customer checkout dan Merchant memproses pesanan sepanjang hari.
    const placed = [];
    for (const [n, [, hour, customerKey, lines, tip, fate]] of orderPlan.entries()) {
      if (orderPlan[n][0] !== daysAgo) continue;
      const items = lines.map(([storeKey, productIndex, quantity, variantIndex]) => {
        const product = catalog[storeKey][productIndex];
        return { productId: product.id, quantity, ...(variantIndex != null ? { productVariantId: product.variants[variantIndex].id } : {}) };
      });
      const created = await at(wib(daysAgo, hour), () => commerce.create({ items, paymentMethod: "COD", courierTip: tip, delivery: addresses[customerKey] }, customerActor(customerKey), `demo-${n}`));
      for (const order of created.orders || created) {
        const storeKey = Object.keys(storeIds).find((key) => storeIds[key] === order.storeId);
        const merchant = merchantActor(ownerOf(storeKey));
        placed.push({ order, fate, customerKey, merchant });
        if (fate === "pending") continue;
        if (fate === "cancel") { await at(wib(daysAgo, hour + 1), () => commerce.cancel(order.id, "Salah pilih produk, mau pesan ulang.", customerActor(customerKey))); continue; }
        await at(wib(daysAgo, hour, 20), () => commerce.transition(order.id, "confirmed", merchant));
        await at(wib(daysAgo, hour + 1), () => commerce.transition(order.id, "processing", merchant));
        if (fate === "processing") continue;
        await at(wib(daysAgo, 15), () => commerce.transition(order.id, "ready-for-pickup", merchant));
      }
    }
    // 2. Admin membuat satu batch harian per kurir; kurir pickup lalu mengantar setelah 17:00.
    const shipping = placed.filter((row) => ["done", "done-noreview", "delivery"].includes(row.fate));
    if (!shipping.length) continue;
    const courierKey = dayIndex % 2 === 0 ? "courier" : "courier2";
    const deliveryDate = delivery.resolveDeliveryDate(new Date(wib(daysAgo, 8)), "16:00");
    const batch = await at(wib(daysAgo, 16, 5), () => delivery.createBatch({ courierUserId: users[courierKey].id, deliveryDate, commerceOrderIds: shipping.map((row) => row.order.id) }, admin));
    for (const [i, row] of shipping.entries()) await at(wib(daysAgo, 16, 30 + i), () => delivery.confirmReady(row.order.id, { isReady: true, note: "Barang sudah dikemas." }, row.merchant));
    await at(wib(daysAgo, 17), () => delivery.startBatch(batch.id, courierActor(courierKey)));
    for (const [i, row] of shipping.entries()) await at(wib(daysAgo, 17, 5 + i * 5), () => delivery.pickup(row.order.id, { note: "Diambil di lapak." }, courierActor(courierKey)));
    for (const [i, row] of shipping.entries()) {
      await at(wib(daysAgo, 17, 30 + i * 2), () => delivery.outForDelivery(row.order.id, {}, courierActor(courierKey)));
      if (row.fate === "delivery") continue;
      await at(wib(daysAgo, 18, i * 15), () => delivery.proof(row.order.id, { photoUrl: "/demo/bukti-antar.jpg", recipientName: addresses[row.customerKey].recipientName, note: "Diterima langsung oleh penerima." }, courierActor(courierKey)));
    }
    if (shipping.every((row) => row.fate !== "delivery")) await at(wib(daysAgo, 19, 30), () => delivery.completeBatch(batch.id, courierActor(courierKey)));
    // 3. Ulasan customer di malam hari dan balasan Merchant.
    for (const row of shipping.filter((item) => item.fate === "done")) {
      for (const item of row.order.items) {
        const [rating, comment] = reviewTexts[reviewIndex++ % reviewTexts.length];
        const review = await at(wib(daysAgo, 20, reviewIndex % 50), () => reviews.createProduct(item.id, { rating, comment, orderId: row.order.id }, customerActor(row.customerKey)));
        if (reviewIndex % 2 === 0) await at(wib(daysAgo, 21, reviewIndex % 50), () => reviews.reply(review.id, { text: replyTexts[replyIndex++ % replyTexts.length] }, row.merchant));
      }
    }
  }

  // Biaya admin bulan lalu dilunasi sebelum cutoff tanggal 1 agar lapak tetap aktif.
  for (const def of storeDefs) {
    const fees = await prisma.targetMerchantFee.findMany({ where: { storeId: storeIds[def.key], feeType: "ADMIN_FEE", status: "OUTSTANDING", dueAt: { lte: new RealDate(wib(0, 12)) } } });
    if (!fees.length) continue;
    const settlement = await at(wib(4, 10), () => finance.createSettlement(storeIds[def.key], { obligationIds: fees.map((fee) => fee.id), provider: "MANUAL" }, merchantActor(def.owner)));
    await at(wib(4, 14), () => finance.confirmPayment("settlement", settlement.id, admin));
  }

  // Iuran sukarela
  const contribution = await at(wib(9, 19), () => finance.createContribution({ amount: 50000, provider: "MANUAL", note: "Untuk kas pengelola desa." }, merchantActor("merchantB")));
  await at(wib(8, 9), () => finance.confirmPayment("contribution", contribution.id, admin));

  // Chat
  const ask = await at(wib(3, 19), () => chats.customerMerchant({ productId: catalog.kopi[2].id }, customerActor("customer")));
  await at(wib(3, 19, 2), () => chats.send(ask.id, { message: "Halo Pak, madu klancengnya masih ada stok untuk 2 botol?" }, customerActor("customer")));
  await at(wib(3, 19, 40), () => chats.send(ask.id, { message: "Masih ada, Mbak. Silakan dipesan, besok sore bisa diantar." }, merchantActor("merchantB")));
  await at(wib(3, 19, 45), () => chats.send(ask.id, { message: "Siap, terima kasih Pak!" }, customerActor("customer")));
  const support = await at(wib(2, 8), () => chats.support({ subject: "Cara ganti alamat pengiriman" }, customerActor("customer2")));
  await at(wib(2, 8, 1), () => chats.send(support.id, { message: "Admin, kalau mau ganti alamat pengiriman untuk pesanan berikutnya caranya bagaimana?" }, customerActor("customer2")));
  await at(wib(2, 9), () => chats.send(support.id, { message: "Bisa diisi ulang di halaman checkout bagian alamat ya, Pak. Alamat lama tidak memengaruhi pesanan baru." }, admin));
  const merchantSupport = await at(wib(1, 16), () => chats.support({ subject: "Jadwal pickup kurir" }, merchantActor("merchantC")));
  await at(wib(1, 16, 1), () => chats.send(merchantSupport.id, { message: "Admin, kurir biasanya ambil barang jam berapa ya?" }, merchantActor("merchantC")));

  const counts = {};
  for (const model of ["targetUser", "targetStore", "targetProduct", "targetCommerceOrder", "targetDeliveryBatch", "targetMerchantFee", "targetReview", "targetMessage", "targetNotification"]) counts[model.replace("target", "")] = await prisma[model].count();
  console.log("Demo seed selesai:", counts);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => disconnectPrisma());
