const { errors } = require("../errors/AppError");
const { requiredString, storeTypes, validateLocation } = require("../validation/sharedValidation");

const normalizeStoreType = (value) => String(value).toLowerCase();

function createStoreService(repository) {
  const validateInput = (input, partial = false) => {
    const result = {};
    if (!partial || input.name !== undefined) result.name = requiredString(input.name, "name", { max: 160 });
    if (!partial || input.type !== undefined) {
      result.type = normalizeStoreType(input.type);
      if (!storeTypes.includes(result.type)) throw errors.validation({ type: `Harus salah satu: ${storeTypes.join(", ")}.` });
    }
    if (!partial || input.description !== undefined) result.description = requiredString(input.description, "description", { max: 2000 });
    if (input.phone !== undefined) result.phone = input.phone == null || input.phone === "" ? null : requiredString(input.phone, "phone", { max: 20 });
    if (input.image !== undefined) result.image = input.image == null || input.image === "" ? null : requiredString(input.image, "image", { max: 1000 });
    if (input.location !== undefined) {
      const location = validateLocation(input.location);
      const source = input.location.source === "lentera" ? "lentera" : "local";
      result.location = { ...location, source, locationRef: input.location.locationRef == null ? null : requiredString(input.location.locationRef, "locationRef", { max: 255 }) };
    }
    return result;
  };
  return {
    async listFor(user) { return (await repository.stores.list()).filter((store) => user.roles.includes("admin") || store.merchantUserId === user.id); },
    async get(storeId, user) {
      const store = await repository.stores.findById(storeId);
      if (!store) throw errors.notFound("Store tidak ditemukan.");
      if (!user.roles.includes("admin") && store.merchantUserId !== user.id) throw errors.forbidden("Store bukan milik pengguna ini.");
      return store;
    },
    async create(input, actor) {
      const timestamp = new Date().toISOString();
      return repository.transaction(async (tx) => {
        const store = await tx.stores.create({ ...validateInput(input), merchantUserId: actor.id, status: "pending_initial_payment", approvalStatus: "PENDING", createdAt: timestamp, updatedAt: timestamp });
        if (tx.finance) await tx.finance.createStatusHistory({ storeId: store.id, oldStatus: "new", newStatus: "pending_initial_payment", reason: "Menunggu setup dan pembayaran pertama Iuran Pokok.", changedByUserId: actor.id, metadata: { process: "store-creation" } });
        await tx.audits.append({ entityType: "store", entityId: store.id, actorId: actor.id, actorRole: actor.roles.includes("merchant") ? "merchant" : "customer", activityType: "STORE_CREATED", previousStatus: null, nextStatus: store.status, description: `Store ${store.name} dibuat.`, reason: null, isSystem: false });
        return store;
      });
    },
    async update(store, input, actor) {
      const allowed = validateInput(input, true);
      return repository.transaction(async (tx) => {
        const updated = await tx.stores.update(store.id, { ...allowed, updatedAt: new Date().toISOString() });
        await tx.audits.append({ entityType: "store", entityId: store.id, actorId: actor.id, actorRole: actor.roles.includes("admin") ? "admin" : "merchant", activityType: "STORE_UPDATED", previousStatus: store.status, nextStatus: updated.status, description: `Store ${updated.name} diperbarui.`, reason: null, isSystem: false });
        return updated;
      });
    },
    async setAvailability(store, input, actor) {
      if (typeof input.acceptingOrders !== "boolean") throw errors.validation({ acceptingOrders: "Status penerimaan pesanan wajib dipilih." });
      const currentStatus = String(store.status || "").toLowerCase();
      if (!["active", "inactive"].includes(currentStatus)) throw errors.conflict("Status lapak sedang dikendalikan oleh proses persetujuan atau keuangan dan tidak dapat diubah Merchant.");
      const nextStatus = input.acceptingOrders ? "active" : "inactive";
      if (nextStatus === currentStatus) return store;
      return repository.transaction(async (tx) => {
        const updated = await tx.stores.update(store.id, { status: nextStatus, updatedAt: new Date().toISOString() });
        if (tx.finance) await tx.finance.createStatusHistory({ storeId: store.id, oldStatus: currentStatus, newStatus: nextStatus, reason: input.acceptingOrders ? "Merchant kembali menerima pesanan." : "Merchant meliburkan lapak sementara.", changedByUserId: actor.id, metadata: { process: "merchant-availability" } });
        await tx.audits.append({ entityType: "store", entityId: store.id, actorId: actor.id, actorRole: "merchant", activityType: input.acceptingOrders ? "STORE_REOPENED" : "STORE_TEMPORARILY_CLOSED", previousStatus: currentStatus, nextStatus, description: input.acceptingOrders ? `Lapak ${store.name} kembali menerima pesanan.` : `Lapak ${store.name} diliburkan sementara.`, reason: null, isSystem: false });
        return updated;
      });
    },
    async listApplications(actor) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      return repository.stores.listApplications();
    },
    async getApplication(storeId, actor) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      const store = await repository.stores.findApplication(storeId);
      if (!store) throw errors.notFound("Pengajuan lapak tidak ditemukan.");
      return store;
    },
    async reviewApplication(storeId, input, actor) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      const nextStatus = String(input.status || "").toUpperCase();
      if (!["APPROVED", "REJECTED"].includes(nextStatus)) throw errors.validation({ status: "Pilih APPROVED atau REJECTED." });
      const reason = input.reason == null ? "" : String(input.reason).trim();
      if (nextStatus === "REJECTED" && !reason) throw errors.validation({ reason: "Alasan penolakan wajib diisi." });
      return repository.transaction(async (tx) => {
        const store = await tx.stores.findApplication(storeId);
        if (!store) throw errors.notFound("Pengajuan lapak tidak ditemukan.");
        if (store.approvalStatus !== "PENDING") throw errors.conflict("Pengajuan lapak ini sudah selesai ditinjau.");
        const updated = await tx.stores.update(storeId, { approvalStatus: nextStatus, rejectionReason: nextStatus === "REJECTED" ? reason : null, reviewedAt: new Date(), reviewedByUserId: actor.id });
        if (nextStatus === "APPROVED" && tx.users?.addRole) await tx.users.addRole(store.merchantUserId, "merchant");
        if (tx.finance) await tx.finance.createStatusHistory({ storeId, oldStatus: "PENDING", newStatus: nextStatus, reason: nextStatus === "REJECTED" ? reason : "Pengajuan lapak disetujui Admin.", changedByUserId: actor.id, metadata: { process: "store-approval" } });
        await tx.audits.append({ entityType: "store", entityId: storeId, actorId: actor.id, actorRole: "admin", activityType: nextStatus === "APPROVED" ? "STORE_APPROVED" : "STORE_REJECTED", previousStatus: "PENDING", nextStatus, description: nextStatus === "APPROVED" ? `Lapak ${store.name} disetujui.` : `Lapak ${store.name} ditolak.`, reason: reason || null, isSystem: false });
        return { ...updated, merchant: store.merchant, statusHistory: store.statusHistory };
      });
    },
  };
}

module.exports = { createStoreService, normalizeStoreType };
