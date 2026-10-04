require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../services/authService");

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed tidak boleh dijalankan pada NODE_ENV=production.");
}

const prisma = new PrismaClient();
const roleNames = ["customer", "merchant", "courier", "admin"];
const users = [
  { id: "00000000-0000-4000-8000-000000000001", fullName: "Admin Kucur", email: "admin@kucur.test", phone: "081100000001", roles: ["admin"] },
  { id: "00000000-0000-4000-8000-000000000002", fullName: "Customer Kucur", email: "customer@kucur.test", phone: "081100000002", roles: ["customer"] },
  { id: "00000000-0000-4000-8000-000000000003", fullName: "Merchant A", email: "merchant.a@kucur.test", phone: "081100000003", roles: ["customer", "merchant"] },
  { id: "00000000-0000-4000-8000-000000000004", fullName: "Merchant B", email: "merchant.b@kucur.test", phone: "081100000004", roles: ["customer", "merchant"] },
  { id: "00000000-0000-4000-8000-000000000005", fullName: "Courier Kucur", email: "courier@kucur.test", phone: "081100000005", roles: ["courier"] },
];

async function seed() {
  const passwordHash = await hashPassword(process.env.DEV_SEED_PASSWORD || "KucurDev123!");
  for (const name of roleNames) await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  for (const user of users) {
    await prisma.user.upsert({ where: { email: user.email }, update: { fullName: user.fullName, phone: user.phone, status: "active", language: "en", theme: "light" }, create: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, passwordHash, status: "active", language: "en", theme: "light" } });
    const persisted = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    for (const role of user.roles) {
      const persistedRole = await prisma.role.findUniqueOrThrow({ where: { name: role } });
      await prisma.userRole.upsert({ where: { userId_roleId: { userId: persisted.id, roleId: persistedRole.id } }, update: {}, create: { userId: persisted.id, roleId: persistedRole.id } });
    }
  }
  await prisma.platformSettings.upsert({ where: { id: "active" }, update: {}, create: { id: "active", deliveryRatePerKm: 3500, deliveryOrderCutoffTime: "16:00", deliveryDispatchTime: "17:00", maxDailyDeliveries: 30, tourismApprovalTimeoutHours: 6, initialStoreFeeAmount: 100000, installmentFullEnabled: true, installment3MonthsEnabled: true, installment6MonthsEnabled: true, installmentLateInterestPercent: 2, adminFeeType: "percentage", adminFeeValue: 5, adminFeeCutoffDay: 1, adminFeeGraceTime: "12:00", suspendStoreForOutstandingAdminFee: true, taxPercent: 11, voluntaryContributionEnabled: true, prideTransactionValueWeight: 35, prideTransactionCountWeight: 25, prideRatingWeight: 20, prideCompletionRateWeight: 20, prideLeaderboardSize: 7 } });
  const productStoreLocation = { locationLabel: "Desa Kucur", address: "Kucur, Dau, Malang", latitude: -7.957641, longitude: 112.543281, locationSource: "development-seed" };
  await prisma.store.upsert({ where: { id: "10000000-0000-4000-8000-000000000001" }, update: productStoreLocation, create: { id: "10000000-0000-4000-8000-000000000001", merchantUserId: users[2].id, name: "Lapak Merchant A", type: "product", description: "Store QA development", status: "active", ...productStoreLocation } });
  await prisma.store.upsert({ where: { id: "10000000-0000-4000-8000-000000000002" }, update: { merchantUserId: users[3].id, name: "Lapak Merchant B", type: "product", description: "Store produk QA development", status: "active", ...productStoreLocation }, create: { id: "10000000-0000-4000-8000-000000000002", merchantUserId: users[3].id, name: "Lapak Merchant B", type: "product", description: "Store produk QA development", status: "active", ...productStoreLocation } });
  await prisma.store.upsert({ where: { id: "12000000-0000-4000-8000-000000000001" }, update: { approvalStatus: "PENDING", rejectionReason: null, reviewedAt: null, reviewedByUserId: null }, create: { id: "12000000-0000-4000-8000-000000000001", merchantUserId: users[3].id, name: "E2E Approval Store", type: "product", description: "Dedicated deterministic browser approval fixture", status: "pending_initial_payment", approvalStatus: "PENDING", ...productStoreLocation } });

  const products = [
    { id: "20000000-0000-4000-8000-000000000001", storeId: "10000000-0000-4000-8000-000000000001", name: "Keripik Tempe Kucur", category: "Makanan", description: "Keripik tempe renyah buatan warga Desa Kucur dengan bumbu rempah pilihan.", status: "active", hasVariants: false, price: 35000, stock: 24, images: [], options: [], variants: [] },
    { id: "20000000-0000-4000-8000-000000000002", storeId: "10000000-0000-4000-8000-000000000001", name: "Keripik Pisang Varian QA", category: "Makanan", description: "Produk fixture QA untuk kombinasi SKU, harga, dan stok varian.", status: "active", hasVariants: true, price: null, stock: null, images: [], options: [{ id: "21000000-0000-4000-8000-000000000001", name: "Rasa", values: ["Original", "Balado"], position: 0 }, { id: "21000000-0000-4000-8000-000000000002", name: "Ukuran", values: ["250gr", "500gr"], position: 1 }], variants: [
      { id: "22000000-0000-4000-8000-000000000001", sku: "QA-ORI-250", combinationKey: "rasa=original|ukuran=250gr", options: { Rasa: "Original", Ukuran: "250gr" }, price: 25000, stock: 5, status: "active" },
      { id: "22000000-0000-4000-8000-000000000002", sku: "QA-BAL-250", combinationKey: "rasa=balado|ukuran=250gr", options: { Rasa: "Balado", Ukuran: "250gr" }, price: 27000, stock: 0, status: "active" },
      { id: "22000000-0000-4000-8000-000000000003", sku: "QA-ORI-500", combinationKey: "rasa=original|ukuran=500gr", options: { Rasa: "Original", Ukuran: "500gr" }, price: 45000, stock: 8, status: "active" },
    ] },
    { id: "20000000-0000-4000-8000-000000000003", storeId: "10000000-0000-4000-8000-000000000002", name: "Madu Kucur QA B", category: "Hasil Pertanian", description: "Produk fixture QA dari Store B.", status: "active", hasVariants: false, price: 55000, stock: 12, images: [], options: [], variants: [] },
  ];
  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      await tx.product.upsert({ where: { id: product.id }, update: { storeId: product.storeId, name: product.name, category: product.category, description: product.description, status: product.status, hasVariants: product.hasVariants, price: product.price, stock: product.stock }, create: { id: product.id, storeId: product.storeId, name: product.name, category: product.category, description: product.description, status: product.status, hasVariants: product.hasVariants, price: product.price, stock: product.stock } });
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.productVariant.deleteMany({ where: { productId: product.id } });
      await tx.productOption.deleteMany({ where: { productId: product.id } });
      if (product.images.length) await tx.productImage.createMany({ data: product.images.map((item) => ({ ...item, productId: product.id })) });
      if (product.options.length) await tx.productOption.createMany({ data: product.options.map((item) => ({ ...item, productId: product.id })) });
      if (product.variants.length) await tx.productVariant.createMany({ data: product.variants.map((item) => ({ ...item, productId: product.id })) });
    });
  }

  // Deterministic finance fixtures are development QA data only.
  const financeStores = [
    { id: "11000000-0000-4000-8000-000000000001", name: "QA Finance FULL Pending", status: "pending_initial_payment" },
    { id: "11000000-0000-4000-8000-000000000002", name: "QA Finance 3 Bulan Aktif", status: "active" },
    { id: "11000000-0000-4000-8000-000000000003", name: "QA Finance 6 Bulan Overdue", status: "active" },
  ];
  for (const store of financeStores) await prisma.store.upsert({ where: { id: store.id }, update: { name: store.name, status: store.status }, create: { ...store, merchantUserId: users[2].id, type: "product", description: "Fixture QA Store Finance" } });
  const contracts = [
    { id: "31000000-0000-4000-8000-000000000001", storeId: financeStores[0].id, planType: "FULL", count: 1, status: "PENDING", amounts: [100000], paid: [] },
    { id: "31000000-0000-4000-8000-000000000002", storeId: financeStores[1].id, planType: "THREE_MONTHS", count: 3, status: "PENDING", amounts: [33333.33, 33333.33, 33333.34], paid: [1] },
    { id: "31000000-0000-4000-8000-000000000003", storeId: financeStores[2].id, planType: "SIX_MONTHS", count: 6, status: "PENDING", amounts: [16666.66, 16666.66, 16666.66, 16666.66, 16666.66, 16666.70], paid: [1] },
  ];
  for (const contract of contracts) {
    await prisma.storeInitialFee.upsert({ where: { storeId: contract.storeId }, update: {}, create: { id: contract.id, storeId: contract.storeId, initialAmountSnapshot: 100000, planType: contract.planType, installmentCount: contract.count, status: contract.status } });
    for (let index = 0; index < contract.count; index += 1) {
      const number = index + 1; const isPaid = contract.paid.includes(number); const overdue = contract.planType === "SIX_MONTHS" && number === 2;
      const installmentId = `32${String(contract.count).padStart(2, "0")}0000-0000-4000-8000-${String(number).padStart(12, "0")}`;
      await prisma.storeInstallment.upsert({ where: { storeInitialFeeId_installmentNumber: { storeInitialFeeId: contract.id, installmentNumber: number } }, update: {}, create: { id: installmentId, storeInitialFeeId: contract.id, installmentNumber: number, principalAmount: contract.amounts[index], principalOutstanding: isPaid ? 0 : contract.amounts[index], penaltyOutstanding: 0, dueAt: overdue ? new Date("2026-07-01T05:00:00.000Z") : new Date(Date.UTC(2026, 7 + index, 1, 5)), status: isPaid ? "PAID" : overdue ? "OVERDUE" : "PENDING", paidAt: isPaid ? new Date("2026-08-01T05:00:00.000Z") : null } });
      if (isPaid) await prisma.storeInstallmentPayment.upsert({ where: { providerReference: `QA-INITIAL-${contract.id}-${number}` }, update: {}, create: { installmentId, amount: contract.amounts[index], paymentMethod: "MANUAL", paymentStatus: "PAID", provider: "MANUAL", providerReference: `QA-INITIAL-${contract.id}-${number}`, paidAt: new Date("2026-08-01T05:00:00.000Z") } });
    }
  }
  const qaCheckoutId = "41000000-0000-4000-8000-000000000001";
  await prisma.checkoutTransaction.upsert({ where: { customerUserId_idempotencyKey: { customerUserId: users[1].id, idempotencyKey: "qa-finance-seed" } }, update: {}, create: { id: qaCheckoutId, customerUserId: users[1].id, idempotencyKey: "qa-finance-seed" } });
  for (const [position, paid] of [false, true].entries()) {
    const orderId = `42000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`; const transactionId = `43000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`; const obligationId = `44000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
    await prisma.commerceOrder.upsert({ where: { id: orderId }, update: {}, create: { id: orderId, orderCode: `QA-FIN-${position + 1}`, checkoutTransactionId: qaCheckoutId, customerUserId: users[1].id, storeId: financeStores[1].id, fulfillmentStatus: "completed", paymentStatus: "paid", paymentMethod: "COD", productTotal: 100000, deliveryFee: 0, courierTip: 0, totalAmount: 100000, distanceKm: 0, roundedDistanceKm: 0, deliveryRateSnapshot: 3500, recipientName: "QA Finance", recipientPhone: "081100000002", deliveryAddress: "Desa Kucur" } });
    await prisma.platformTransaction.upsert({ where: { type_sourceEntityId: { type: "COMMERCE", sourceEntityId: orderId } }, update: { commerceOrderId: orderId }, create: { id: transactionId, storeId: financeStores[1].id, customerUserId: users[1].id, type: "COMMERCE", sourceEntityId: orderId, commerceOrderId: orderId, subtotal: 100000, taxPercentSnapshot: 11, taxAmount: 11000, grandTotal: 111000, paymentStatus: "paid", transactionStatus: "COMPLETED", completedAt: new Date("2026-08-20T03:00:00.000Z") } });
    await prisma.adminFeeObligation.upsert({ where: { platformTransactionId: transactionId }, update: {}, create: { id: obligationId, platformTransactionId: transactionId, storeId: financeStores[1].id, feeTypeSnapshot: "percentage", feeValueSnapshot: 5, baseTransactionAmount: 100000, feeAmount: 5000, billingYear: 2026, billingMonth: 8, cutoffAt: new Date("2026-09-01T05:00:00.000Z"), status: paid ? "PAID" : "OUTSTANDING", paidAt: paid ? new Date("2026-08-25T05:00:00.000Z") : null } });
  }

  const tourismStoreId = "51000000-0000-4000-8000-000000000001";
  await prisma.store.upsert({ where: { id: tourismStoreId }, update: { type: "tourism", status: "active" }, create: { id: tourismStoreId, merchantUserId: users[2].id, name: "Lapak Wisata Kucur QA", type: "tourism", description: "Tourism Store QA canonical", status: "active", locationLabel: "Desa Kucur", address: "Kucur, Dau, Malang", locationSource: "local" } });
  const tourismPackages = [
    { id: "52000000-0000-4000-8000-000000000001", name: "Belajar Kopi Kucur", category: "EDUCATIONAL", description: "Paket edukasi pengolahan kopi untuk QA.", durationMinutes: 120, pricePerPax: 50000 },
    { id: "52000000-0000-4000-8000-000000000002", name: "Trekking Panorama Kucur", category: "NON_EDUCATIONAL", description: "Paket trekking wisata alam untuk QA.", durationMinutes: 180, pricePerPax: 75000 },
  ];
  for (const item of tourismPackages) await prisma.tourismPackage.upsert({ where: { id: item.id }, update: { ...item, storeId: tourismStoreId, isActive: true }, create: { ...item, storeId: tourismStoreId, isActive: true } });
  const tourismSchedules = [
    { id: "53000000-0000-4000-8000-000000000001", tourismPackageId: tourismPackages[0].id, startAt: new Date("2026-09-05T01:00:00.000Z"), capacity: 20, reservedPax: 2, status: "AVAILABLE" },
    { id: "53000000-0000-4000-8000-000000000002", tourismPackageId: tourismPackages[1].id, startAt: new Date("2026-09-06T00:00:00.000Z"), capacity: 10, reservedPax: 10, status: "FULL" },
  ];
  for (const item of tourismSchedules) await prisma.tourismSchedule.upsert({ where: { id: item.id }, update: item, create: item });
  const tourismBookingId = "54000000-0000-4000-8000-000000000001"; const tourismTransactionId = "55000000-0000-4000-8000-000000000001";
  await prisma.platformTransaction.upsert({ where: { type_sourceEntityId: { type: "TOURISM", sourceEntityId: tourismBookingId } }, update: {}, create: { id: tourismTransactionId, storeId: tourismStoreId, customerUserId: users[1].id, type: "TOURISM", sourceEntityId: tourismBookingId, subtotal: 100000, taxPercentSnapshot: 11, taxAmount: 11000, grandTotal: 111000, paymentStatus: "PENDING", transactionStatus: "PENDING" } });
  await prisma.tourismBooking.upsert({ where: { id: tourismBookingId }, update: {}, create: { id: tourismBookingId, platformTransactionId: tourismTransactionId, customerUserId: users[1].id, tourismPackageId: tourismPackages[0].id, tourismScheduleId: tourismSchedules[0].id, bookingCode: "WST-QA-STANDARD-001", bookingType: "STANDARD", paxCount: 2, packageNameSnapshot: tourismPackages[0].name, categorySnapshot: tourismPackages[0].category, storeNameSnapshot: "Lapak Wisata Kucur QA", durationMinutesSnapshot: 120, scheduleStartAtSnapshot: tourismSchedules[0].startAt, pricePerPaxSnapshot: 50000, subtotal: 100000, taxPercentSnapshot: 11, taxAmount: 11000, grandTotal: 111000, bookingName: "Customer Kucur", status: "PENDING_APPROVAL", paymentStatus: "PENDING", approvalExpiresAt: new Date("2026-09-04T01:00:00.000Z") } });
  await prisma.paymentAttempt.upsert({ where: { providerReference: "QA-TOURISM-STANDARD-001" }, update: { platformTransactionId: tourismTransactionId }, create: { platformTransactionId: tourismTransactionId, provider: "cod", providerReference: "QA-TOURISM-STANDARD-001", paymentMethod: "COD", status: "pending", amount: 111000 } });
  await prisma.tourismGroupRequest.upsert({ where: { id: "56000000-0000-4000-8000-000000000001" }, update: {}, create: { id: "56000000-0000-4000-8000-000000000001", customerUserId: users[1].id, tourismPackageId: tourismPackages[1].id, groupName: "Komunitas Trekking QA", requestedDate: new Date("2026-09-20"), requestedStartTime: "07:00", paxCount: 15, notes: "Fixture permintaan grup.", status: "SUBMITTED" } });

  // Live In values below are development QA defaults, not stakeholder-approved commercial values.
  const liveInStoreId = "61000000-0000-4000-8000-000000000001"; const liveInProfileId = "62000000-0000-4000-8000-000000000001";
  await prisma.store.upsert({ where: { id: liveInStoreId }, update: { type: "liveIn", status: "active" }, create: { id: liveInStoreId, merchantUserId: users[2].id, name: "Live In Kucur QA", type: "liveIn", description: "Program Live In canonical QA", status: "active", locationLabel: "Desa Kucur", address: "Kucur, Dau, Malang", locationSource: "local" } });
  await prisma.liveInProfile.upsert({ where: { storeId: liveInStoreId }, update: { description: "Program tinggal bersama warga untuk QA.", defaultMealsPerDay: 2, isActive: true }, create: { id: liveInProfileId, storeId: liveInStoreId, description: "Program tinggal bersama warga untuk QA.", defaultMealsPerDay: 2, checkInTime: "14:00", checkOutTime: "11:00", isActive: true } });
  await prisma.liveInMealPlan.upsert({ where: { liveInProfileId }, update: { mealsPerDay: 2, description: "QA default: sarapan dan makan malam." }, create: { id: "63000000-0000-4000-8000-000000000001", liveInProfileId, mealsPerDay: 2, description: "QA default: sarapan dan makan malam." } });
  const liveInRooms = [
    { id: "64000000-0000-4000-8000-000000000001", name: "Kamar A QA", capacity: 2, pricePerNight: 250000, description: "Menggunakan meal plan default." },
    { id: "64000000-0000-4000-8000-000000000002", name: "Kamar B QA", capacity: 4, pricePerNight: 400000, description: "Memiliki meal override QA." },
  ];
  for (const room of liveInRooms) await prisma.liveInRoom.upsert({ where: { id: room.id }, update: { ...room, liveInProfileId, isActive: true }, create: { ...room, liveInProfileId, isActive: true } });
  await prisma.liveInRoomMealOverride.upsert({ where: { roomId: liveInRooms[1].id }, update: { mealsPerDay: 3, notes: "QA override: tiga kali makan." }, create: { id: "65000000-0000-4000-8000-000000000001", roomId: liveInRooms[1].id, mealsPerDay: 3, notes: "QA override: tiga kali makan." } });
  const liveInBookingId = "66000000-0000-4000-8000-000000000001"; const liveInTransactionId = "67000000-0000-4000-8000-000000000001";
  await prisma.platformTransaction.upsert({ where: { type_sourceEntityId: { type: "LIVE_IN", sourceEntityId: liveInBookingId } }, update: {}, create: { id: liveInTransactionId, storeId: liveInStoreId, customerUserId: users[1].id, type: "LIVE_IN", sourceEntityId: liveInBookingId, subtotal: 500000, taxPercentSnapshot: 11, taxAmount: 55000, grandTotal: 555000, paymentStatus: "PENDING", transactionStatus: "PENDING" } });
  await prisma.liveInBooking.upsert({ where: { id: liveInBookingId }, update: {}, create: { id: liveInBookingId, platformTransactionId: liveInTransactionId, customerUserId: users[1].id, liveInProfileId, bookingCode: "LIN-QA-STANDARD-001", bookingType: "STANDARD", bookingName: "Customer Kucur", storeNameSnapshot: "Live In Kucur QA", liveInNameSnapshot: "Live In Kucur QA", checkIn: new Date("2026-09-10"), checkOut: new Date("2026-09-12"), nightCount: 2, subtotal: 500000, taxPercentSnapshot: 11, taxAmount: 55000, grandTotal: 555000, bookingStatus: "CONFIRMED", paymentStatus: "PENDING" } });
  await prisma.liveInBookingRoom.upsert({ where: { liveInBookingId_liveInRoomId: { liveInBookingId, liveInRoomId: liveInRooms[0].id } }, update: {}, create: { liveInBookingId, liveInRoomId: liveInRooms[0].id, roomNameSnapshot: liveInRooms[0].name, capacitySnapshot: 2, pricePerNightSnapshot: 250000, mealsPerDaySnapshot: 2, nightCount: 2, subtotal: 500000 } });
  for (const [index, stayDate] of ["2026-09-10", "2026-09-11"].entries()) await prisma.liveInRoomNightReservation.upsert({ where: { liveInRoomId_stayDate: { liveInRoomId: liveInRooms[0].id, stayDate: new Date(stayDate) } }, update: { liveInBookingId }, create: { id: `68000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, liveInRoomId: liveInRooms[0].id, liveInBookingId, stayDate: new Date(stayDate) } });
  await prisma.paymentAttempt.upsert({ where: { providerReference: "QA-LIVEIN-STANDARD-001" }, update: { platformTransactionId: liveInTransactionId }, create: { platformTransactionId: liveInTransactionId, provider: "cod", providerReference: "QA-LIVEIN-STANDARD-001", paymentMethod: "COD", status: "pending", amount: 555000 } });
  const liveInGroupRequestId = "69000000-0000-4000-8000-000000000001"; const liveInGroupOfferId = "6a000000-0000-4000-8000-000000000001";
  await prisma.liveInGroupRequest.upsert({ where: { id: liveInGroupRequestId }, update: {}, create: { id: liveInGroupRequestId, customerUserId: users[1].id, liveInProfileId, groupName: "Rombongan Sekolah QA", requestedCheckIn: new Date("2026-10-10"), requestedCheckOut: new Date("2026-10-12"), paxCount: 6, notes: "QA group request.", status: "OFFERED" } });
  await prisma.liveInGroupOffer.upsert({ where: { id: liveInGroupOfferId }, update: {}, create: { id: liveInGroupOfferId, groupRequestId: liveInGroupRequestId, merchantUserId: users[2].id, offeredCheckIn: new Date("2026-10-10"), offeredCheckOut: new Date("2026-10-12"), offeredPax: 6, offeredPrice: 1200000, mealNotes: "Tiga kali makan untuk rombongan QA.", notes: "QA group offer.", expiresAt: new Date("2026-10-01T00:00:00.000Z"), status: "PENDING" } });
  for (const room of liveInRooms) await prisma.liveInGroupOfferRoom.upsert({ where: { groupOfferId_liveInRoomId: { groupOfferId: liveInGroupOfferId, liveInRoomId: room.id } }, update: {}, create: { groupOfferId: liveInGroupOfferId, liveInRoomId: room.id, priceSnapshot: room.pricePerNight, capacitySnapshot: room.capacity, mealsPerDaySnapshot: room.id === liveInRooms[1].id ? 3 : 2 } });

  // Canonical Review fixtures: one completed source per domain and one Merchant reply.
  const reviewOrderId = "71000000-0000-4000-8000-000000000001"; const reviewItemId = "72000000-0000-4000-8000-000000000001";
  await prisma.commerceOrder.upsert({ where: { id: reviewOrderId }, update: { fulfillmentStatus: "completed" }, create: { id: reviewOrderId, orderCode: "QA-REVIEW-PRODUCT-001", checkoutTransactionId: qaCheckoutId, customerUserId: users[1].id, storeId: "10000000-0000-4000-8000-000000000001", fulfillmentStatus: "completed", paymentStatus: "paid", paymentMethod: "COD", productTotal: 35000, deliveryFee: 0, courierTip: 0, totalAmount: 35000, distanceKm: 0, roundedDistanceKm: 0, deliveryRateSnapshot: 3500, recipientName: "Customer Kucur", recipientPhone: "081100000002", deliveryAddress: "Desa Kucur" } });
  await prisma.commerceOrderItem.upsert({ where: { id: reviewItemId }, update: {}, create: { id: reviewItemId, orderId: reviewOrderId, productId: products[0].id, productName: products[0].name, storeName: "Lapak Merchant A", unitPrice: 35000, quantity: 1, subtotal: 35000 } });
  await prisma.tourismBooking.update({ where: { id: tourismBookingId }, data: { status: "COMPLETED", completedAt: new Date("2026-08-24T03:00:00.000Z") } });
  await prisma.liveInBooking.update({ where: { id: liveInBookingId }, data: { bookingStatus: "COMPLETED", completedAt: new Date("2026-08-24T03:00:00.000Z") } });
  const fixtures = [{ id: "73000000-0000-4000-8000-000000000001", storeId: "10000000-0000-4000-8000-000000000001", rating: 5, comment: "Produk lokal sangat baik.", target: "product", sourceId: reviewItemId }, { id: "73000000-0000-4000-8000-000000000002", storeId: tourismStoreId, rating: 5, comment: "Pengalaman wisata edukasi menyenangkan.", target: "tourism", sourceId: tourismBookingId }, { id: "73000000-0000-4000-8000-000000000003", storeId: liveInStoreId, rating: 4, comment: "Pengalaman Live In nyaman.", target: "liveIn", sourceId: liveInBookingId }];
  for (const item of fixtures) { await prisma.review.upsert({ where: { id: item.id }, update: { rating: item.rating, comment: item.comment }, create: { id: item.id, customerUserId: users[1].id, storeId: item.storeId, rating: item.rating, comment: item.comment } }); if (item.target === "product") await prisma.productReviewTarget.upsert({ where: { commerceOrderItemId: item.sourceId }, update: { reviewId: item.id }, create: { reviewId: item.id, commerceOrderItemId: item.sourceId } }); if (item.target === "tourism") await prisma.tourismReviewTarget.upsert({ where: { tourismBookingId: item.sourceId }, update: { reviewId: item.id }, create: { reviewId: item.id, tourismBookingId: item.sourceId } }); if (item.target === "liveIn") await prisma.liveInReviewTarget.upsert({ where: { liveInBookingId: item.sourceId }, update: { reviewId: item.id }, create: { reviewId: item.id, liveInBookingId: item.sourceId } }); }
  await prisma.reviewReply.upsert({ where: { reviewId: fixtures[0].id }, update: { text: "Terima kasih atas ulasannya.", authorUserId: users[2].id }, create: { reviewId: fixtures[0].id, authorUserId: users[2].id, text: "Terima kasih atas ulasannya." } });
  const notifications = [
    { id: "74000000-0000-4000-8000-000000000001", userId: users[1].id, type: "COMMERCE_ORDER_STATUS_CHANGED", title: "Status pesanan diperbarui", body: "Pesanan QA Anda telah selesai.", entityType: "COMMERCE_ORDER", entityId: reviewOrderId, dedupeKey: `seed-commerce-completed:${reviewOrderId}:${users[1].id}` },
    { id: "74000000-0000-4000-8000-000000000002", userId: users[1].id, type: "TOURISM_GROUP_OFFER_CREATED", title: "Penawaran wisata tersedia", body: "Merchant telah mengirim penawaran wisata untuk Anda.", entityType: "TOURISM_GROUP_REQUEST", entityId: "56000000-0000-4000-8000-000000000001", dedupeKey: `seed-tourism-offer:56000000-0000-4000-8000-000000000001:${users[1].id}` },
    { id: "74000000-0000-4000-8000-000000000003", userId: users[1].id, type: "REVIEW_REPLIED", title: "Ulasan Anda dibalas", body: "Merchant membalas ulasan produk Anda.", entityType: "REVIEW", entityId: fixtures[0].id, dedupeKey: `seed-review-replied:${fixtures[0].id}:${users[1].id}` },
    { id: "74000000-0000-4000-8000-000000000004", userId: users[2].id, type: "COMMERCE_ORDER_CREATED", title: "Pesanan baru", body: "Lapak Anda menerima pesanan QA baru.", entityType: "COMMERCE_ORDER", entityId: reviewOrderId, dedupeKey: `seed-commerce-created:${reviewOrderId}:${users[2].id}` },
    { id: "74000000-0000-4000-8000-000000000005", userId: users[2].id, type: "TOURISM_BOOKING_CREATED", title: "Booking wisata baru", body: "Lapak wisata Anda menerima booking baru.", entityType: "TOURISM_BOOKING", entityId: tourismBookingId, dedupeKey: `seed-tourism-created:${tourismBookingId}:${users[2].id}` },
    { id: "74000000-0000-4000-8000-000000000006", userId: users[2].id, type: "REVIEW_CREATED", title: "Ulasan baru", body: "Customer memberikan ulasan baru.", entityType: "REVIEW", entityId: fixtures[0].id, dedupeKey: `seed-review-created:${fixtures[0].id}:${users[2].id}` },
  ];
  for (const item of notifications) await prisma.notification.upsert({ where: { dedupeKey: item.dedupeKey }, update: { title: item.title, body: item.body, metadata: { seed: true } }, create: { ...item, metadata: { seed: true } } });
  const adminId=users[0].id,customerId=users[1].id,merchantId=users[2].id,courierId=users[4].id;
  const chats=[
    {id:"75000000-0000-4000-8000-000000000001",type:"CUSTOMER_MERCHANT",openKey:`customer-merchant:${customerId}:${merchantId}:product:${products[0].id}`,subject:products[0].name,participants:[[customerId,"CUSTOMER"],[merchantId,"MERCHANT"]],context:{storeId:products[0].storeId,productId:products[0].id}},
    {id:"75000000-0000-4000-8000-000000000002",type:"CUSTOMER_MERCHANT",openKey:`customer-merchant:${customerId}:${merchantId}:order:${reviewOrderId}`,subject:"Pesanan QA-REVIEW-PRODUCT-001",participants:[[customerId,"CUSTOMER"],[merchantId,"MERCHANT"]],context:{storeId:products[0].storeId,commerceOrderId:reviewOrderId}},
    {id:"75000000-0000-4000-8000-000000000003",type:"SUPPORT",openKey:`support:${customerId}:CUSTOMER`,subject:"Bantuan Customer",participants:[[customerId,"CUSTOMER"],[adminId,"ADMIN"]]},
    {id:"75000000-0000-4000-8000-000000000004",type:"SUPPORT",openKey:`support:${merchantId}:MERCHANT`,subject:"Bantuan Merchant",participants:[[merchantId,"MERCHANT"],[adminId,"ADMIN"]]},
    {id:"75000000-0000-4000-8000-000000000005",type:"SUPPORT",openKey:`support:${courierId}:COURIER`,subject:"Bantuan Courier",participants:[[courierId,"COURIER"],[adminId,"ADMIN"]]},
    {id:"75000000-0000-4000-8000-000000000006",type:"SUPPORT",openKey:null,subject:"Support Selesai",status:"CLOSED",closedByUserId:customerId,closedAt:new Date("2026-08-25T04:00:00.000Z"),participants:[[customerId,"CUSTOMER"],[adminId,"ADMIN"]]},
  ];
  for(const chat of chats){await prisma.conversation.upsert({where:{id:chat.id},update:{subject:chat.subject},create:{id:chat.id,type:chat.type,status:chat.status||"OPEN",openKey:chat.openKey,subject:chat.subject,closedByUserId:chat.closedByUserId||null,closedAt:chat.closedAt||null,lastMessageAt:new Date("2026-08-25T03:00:00.000Z")}});for(const[userId,roleSnapshot]of chat.participants)await prisma.conversationParticipant.upsert({where:{conversationId_userId:{conversationId:chat.id,userId}},update:{roleSnapshot},create:{conversationId:chat.id,userId,roleSnapshot}});if(chat.context)await prisma.conversationContext.upsert({where:{conversationId:chat.id},update:chat.context,create:{conversationId:chat.id,...chat.context}});const senderId=chat.participants[0][0];const messageId=`76000000-0000-4000-8000-${String(chats.indexOf(chat)+1).padStart(12,"0")}`;await prisma.message.upsert({where:{id:messageId},update:{message:`Pesan QA untuk ${chat.subject}`},create:{id:messageId,conversationId:chat.id,senderUserId:senderId,message:`Pesan QA untuk ${chat.subject}`,createdAt:new Date("2026-08-25T03:00:00.000Z")}});if(chats.indexOf(chat)%2===0)await prisma.messageRead.upsert({where:{messageId_userId:{messageId,userId:chat.participants[1][0]}},update:{},create:{messageId,userId:chat.participants[1][0]}});}
  await prisma.courierProfile.upsert({where:{userId:courierId},update:{maxActiveDeliveries:20,isActive:true},create:{userId:courierId,maxActiveDeliveries:20,isActive:true}});
  await prisma.courierAvailability.upsert({where:{id:"77000000-0000-4000-8000-000000000001"},update:{},create:{id:"77000000-0000-4000-8000-000000000001",courierUserId:courierId,startAt:new Date("2026-08-01T01:00:00.000Z"),endAt:new Date("2026-08-01T10:00:00.000Z"),reason:"Riwayat QA tidak tersedia"}});
  const deliveryOrders=[
    {id:"78000000-0000-4000-8000-000000000001",code:"QA-DELIVERY-PLANNED",fulfillmentStatus:"readyForPickup"},
    {id:"78000000-0000-4000-8000-000000000002",code:"QA-DELIVERY-DONE",fulfillmentStatus:"completed"},
    {id:"78000000-0000-4000-8000-000000000003",code:"QA-DELIVERY-FAILED",fulfillmentStatus:"onDelivery"},
  ];
  for(const order of deliveryOrders)await prisma.commerceOrder.upsert({where:{id:order.id},update:{fulfillmentStatus:order.fulfillmentStatus},create:{id:order.id,orderCode:order.code,checkoutTransactionId:qaCheckoutId,customerUserId:customerId,storeId:products[0].storeId,fulfillmentStatus:order.fulfillmentStatus,paymentStatus:"paid",paymentMethod:"COD",productTotal:50000,deliveryFee:10000,courierTip:5000,totalAmount:65000,distanceKm:2.5,roundedDistanceKm:3,deliveryRateSnapshot:3500,recipientName:"Customer Kucur",recipientPhone:"081100000002",deliveryAddress:"Desa Kucur",createdAt:new Date("2026-08-27T06:00:00.000Z")}});
  const deliveryBatches=[
    {id:"79000000-0000-4000-8000-000000000001",order:deliveryOrders[0],status:"PLANNED",orderStatus:"WAITING_PICKUP"},
    {id:"79000000-0000-4000-8000-000000000002",order:deliveryOrders[1],status:"COMPLETED",orderStatus:"DELIVERED"},
    {id:"79000000-0000-4000-8000-000000000003",order:deliveryOrders[2],status:"COMPLETED",orderStatus:"FAILED"},
  ];
  for(const fixture of deliveryBatches){await prisma.deliveryBatch.upsert({where:{id:fixture.id},update:{status:fixture.status},create:{id:fixture.id,courierUserId:courierId,deliveryDate:new Date("2026-08-27T00:00:00.000Z"),cutoffAt:new Date("2026-08-27T09:00:00.000Z"),dispatchAt:new Date("2026-08-27T10:00:00.000Z"),status:fixture.status,startedAt:fixture.status==="COMPLETED"?new Date("2026-08-27T10:00:00.000Z"):null,completedAt:fixture.status==="COMPLETED"?new Date("2026-08-27T12:00:00.000Z"):null}});await prisma.deliveryBatchOrder.upsert({where:{deliveryBatchId_commerceOrderId:{deliveryBatchId:fixture.id,commerceOrderId:fixture.order.id}},update:{status:fixture.orderStatus},create:{id:`7a000000-0000-4000-8000-${String(deliveryBatches.indexOf(fixture)+1).padStart(12,"0")}`,deliveryBatchId:fixture.id,commerceOrderId:fixture.order.id,pickupSequence:1,deliverySequence:1,status:fixture.orderStatus}});await prisma.deliveryActivity.upsert({where:{id:`7b000000-0000-4000-8000-${String(deliveryBatches.indexOf(fixture)+1).padStart(12,"0")}`},update:{status:fixture.orderStatus},create:{id:`7b000000-0000-4000-8000-${String(deliveryBatches.indexOf(fixture)+1).padStart(12,"0")}`,commerceOrderId:fixture.order.id,courierUserId:courierId,status:fixture.orderStatus,note:"Fixture delivery canonical"}});}
  await prisma.deliveryProof.upsert({where:{commerceOrderId:deliveryOrders[1].id},update:{photoUrl:"https://example.test/proofs/delivery-qa.jpg"},create:{id:"7c000000-0000-4000-8000-000000000001",commerceOrderId:deliveryOrders[1].id,courierUserId:courierId,photoUrl:"https://example.test/proofs/delivery-qa.jpg",recipientName:"Customer Kucur",note:"Bukti QA",deliveredAt:new Date("2026-08-27T12:00:00.000Z")}});
}

seed().then(() => console.log("Development seed completed.")).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
