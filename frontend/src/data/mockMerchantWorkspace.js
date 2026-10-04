const workspaceByStoreId = {
  "1": {
    type: "product",
    metrics: {
      totalProducts: 48,
      newOrders: 7,
      processingOrders: 12,
      lowStockProducts: 5,
      revenueToday: 2850000,
    },
    activities: [
      { id: "ACT-P-1", title: "Pesanan KUC-1048 masuk", detail: "3 produk • Rp 375.000", time: "10 menit lalu" },
      { id: "ACT-P-2", title: "Stok Keripik Apel hampir habis", detail: "Tersisa 4 unit", time: "45 menit lalu" },
    ],
  },
  "2": {
    type: "educational-tourism",
    metrics: {
      bookingsToday: 6,
      waitingApproval: 3,
      visitorsToday: 28,
      availableSlots: 42,
      revenueToday: 4200000,
    },
    activities: [
      { id: "ACT-T-1", title: "Booking wisata baru", detail: "BK-WST-2026-031 • 8 peserta", time: "18 menit lalu" },
      { id: "ACT-T-2", title: "Kapasitas Sabtu diperbarui", detail: "Maksimum 60 pengunjung", time: "1 jam lalu" },
    ],
  },
  "3": {
    type: "live-in",
    metrics: {
      totalRooms: 9,
      availableRooms: 4,
      activeBookings: 5,
      checkInsToday: 2,
      revenueToday: 3500000,
    },
    activities: [
      { id: "ACT-L-1", title: "Tamu selesai check-in", detail: "Booking LIV-2026-018 • Kamar Melati", time: "25 menit lalu" },
      { id: "ACT-L-2", title: "Booking Live In dikonfirmasi", detail: "3 malam • 4 tamu", time: "2 jam lalu" },
    ],
  },
};

const typeDefaults = {
  product: {
    totalProducts: 12,
    newOrders: 2,
    processingOrders: 3,
    lowStockProducts: 1,
    revenueToday: 750000,
  },
  "educational-tourism": {
    bookingsToday: 2,
    waitingApproval: 1,
    visitorsToday: 10,
    availableSlots: 25,
    revenueToday: 1250000,
  },
  "live-in": {
    totalRooms: 4,
    availableRooms: 2,
    activeBookings: 2,
    checkInsToday: 1,
    revenueToday: 1100000,
  },
};

export function getStoreWorkspaceData(store) {
  const seeded = workspaceByStoreId[String(store?.id)];
  if (seeded?.type === store?.type) return seeded;

  return {
    type: store?.type,
    metrics: { ...(typeDefaults[store?.type] ?? {}) },
    activities: [
      {
        id: `ACT-${store?.id ?? "STORE"}`,
        title: "Workspace lapak siap digunakan",
        detail: "Belum ada aktivitas baru hari ini",
        time: "Hari ini",
      },
    ],
  };
}

export function getMerchantOverview(stores) {
  return stores.reduce(
    (overview, store) => {
      const { metrics } = getStoreWorkspaceData(store);
      overview.totalStores += 1;
      overview.activeOrders += (metrics.newOrders ?? 0) + (metrics.processingOrders ?? 0);
      overview.activeBookings += (metrics.activeBookings ?? 0) + (metrics.bookingsToday ?? 0) + (metrics.waitingApproval ?? 0);
      overview.revenueToday += metrics.revenueToday ?? 0;
      overview.pendingActions += (metrics.newOrders ?? 0) + (metrics.waitingApproval ?? 0) + (metrics.lowStockProducts ?? 0) + (metrics.checkInsToday ?? 0);
      return overview;
    },
    { totalStores: 0, activeOrders: 0, activeBookings: 0, revenueToday: 0, pendingActions: 0 },
  );
}

export function getMerchantActivities(stores) {
  return stores.flatMap((store) =>
    getStoreWorkspaceData(store).activities.map((activity) => ({
      ...activity,
      storeId: store.id,
      storeName: store.name,
      storeType: store.type,
    })),
  );
}
