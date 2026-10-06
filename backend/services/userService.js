const { normalizeAddresses } = require("../validation/addressValidation");
const { errors } = require("../errors/AppError");
const { requiredString, validateEmail, validatePhone } = require("../validation/sharedValidation");
const { hashPassword, publicUser, verifyPassword } = require("./authService");
const { removeProfileImage, saveProfileImage } = require("./profileImageService");

// Kata sandi awal akun kurir baru (permintaan Steven 2026-10-06); kurir dipaksa menggantinya setelah masuk.
const COURIER_INITIAL_PASSWORD = "KurirKucur123!";
const forbiddenProfileFields = ["id", "roles", "status", "password", "passwordHash", "preferences", "language", "theme"];
function createUserService(repository) {
  const audit = (tx, user, activityType, description) => tx.audits.append({ entityType: "user", entityId: user.id, actorId: user.id, actorRole: user.roles[0] || null, activityType, description, isSystem: false });
  const assertCurrentPassword = async (user, value) => {
    const currentPassword = requiredString(value, "currentPassword", { max: 128 });
    const stored = await repository.users.findById(user.id);
    if (!stored || !(await verifyPassword(currentPassword, stored.passwordHash))) throw errors.validation({ currentPassword: "Kata sandi saat ini salah." });
  };
  return {
    async updateAvatar(user, input) {
      const stored = await repository.users.findById(user.id);
      if (!stored) throw errors.notFound("Pengguna tidak ditemukan.");
      const avatarUrl = await saveProfileImage(input.dataUrl);
      try {
        const updated = await repository.transaction(async (tx) => {
          const row = await tx.users.update(user.id, { avatarUrl });
          await audit(tx, user, "USER_AVATAR_UPDATED", "Pengguna memperbarui foto profil.");
          return row;
        });
        await removeProfileImage(stored.avatarUrl);
        return publicUser(updated);
      } catch (error) {
        await removeProfileImage(avatarUrl);
        throw error;
      }
    },
    async removeAvatar(user) {
      const stored = await repository.users.findById(user.id);
      if (!stored) throw errors.notFound("Pengguna tidak ditemukan.");
      const updated = await repository.transaction(async (tx) => {
        const row = await tx.users.update(user.id, { avatarUrl: null });
        await audit(tx, user, "USER_AVATAR_REMOVED", "Pengguna menghapus foto profil.");
        return row;
      });
      await removeProfileImage(stored.avatarUrl);
      return publicUser(updated);
    },
    async updateProfile(user, input) {
      const forbidden = forbiddenProfileFields.find((field) => Object.hasOwn(input, field));
      if (forbidden) throw errors.validation({ [forbidden]: "Field ini tidak dapat diubah melalui profil." });
      const changes = {
        fullName: requiredString(input.fullName, "fullName", { max: 120 }),
        email: validateEmail(input.email),
        phone: validatePhone(input.phone),
      };
      const owner = await repository.users.findByEmail(changes.email);
      if (owner && owner.id !== user.id) throw errors.conflict("Email sudah digunakan.");
      try {
        return await repository.transaction(async (tx) => {
          const updated = await tx.users.update(user.id, changes);
          await audit(tx, user, "USER_PROFILE_UPDATED", "Pengguna memperbarui informasi profil.");
          return publicUser(updated);
        });
      } catch (error) {
        if (error?.code === "P2002") throw errors.conflict("Email sudah digunakan.");
        throw error;
      }
    },
    async verifyCurrentPassword(user, input) {
      await assertCurrentPassword(user, input.currentPassword);
      return { valid: true };
    },
    async updatePassword(user, input) {
      await assertCurrentPassword(user, input.currentPassword);
      const passwordHash = await hashPassword(input.newPassword);
      const passwordChangedAt = new Date();
      await repository.transaction(async (tx) => {
        await tx.users.update(user.id, { passwordHash, passwordChangedAt, passwordResetRequired: false });
        await audit(tx, user, "USER_PASSWORD_UPDATED", "Pengguna memperbarui kata sandi.");
      });
      return { message: "Kata sandi berhasil diperbarui.", currentSessionValid: true };
    },
    async listUsers(actor) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      return (await repository.users.list()).map(publicUser);
    },
    // Akun kurir dibuat Admin dengan kata sandi awal standar; kurir wajib menggantinya saat pertama masuk.
    async createCourier(actor, input = {}) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      const email = validateEmail(input.email);
      if (await repository.users.findByEmail(email)) throw errors.conflict("Email sudah terdaftar. Gunakan email lain untuk akun kurir.");
      const maxActiveDeliveries = input.maxActiveDeliveries === undefined || input.maxActiveDeliveries === "" ? 10 : Number(input.maxActiveDeliveries);
      if (!Number.isInteger(maxActiveDeliveries) || maxActiveDeliveries < 1 || maxActiveDeliveries > 100) throw errors.validation({ maxActiveDeliveries: "Kapasitas pengiriman aktif harus 1–100." });
      const timestamp = new Date().toISOString();
      const user = await repository.users.create({ fullName: requiredString(input.fullName, "fullName", { max: 120 }), email, phone: validatePhone(input.phone), passwordHash: await hashPassword(COURIER_INITIAL_PASSWORD), passwordChangedAt: timestamp, passwordResetRequired: true, status: "active", language: "id", theme: "light", roles: ["courier"], createdAt: timestamp, updatedAt: timestamp });
      await repository.delivery.upsertProfile(user.id, { maxActiveDeliveries, isActive: true, availabilityHistory: [] });
      await repository.audits.append({ entityType: "user", entityId: user.id, actorId: actor.id, actorRole: "admin", activityType: "ADMIN_COURIER_CREATED", description: "Admin membuat akun kurir dengan kata sandi awal standar.", isSystem: false });
      return { user: publicUser(user), initialPassword: COURIER_INITIAL_PASSWORD };
    },
    // Riwayat pencarian & produk dilihat ikut akun (dipakai di semua perangkat).
    async getHistory(user) { const row = await repository.users.findById(user.id); return row?.browsingHistory ?? { searches: [], viewed: [] }; },
    async saveHistory(user, input = {}) {
      const text = (value, max) => String(value ?? "").trim().slice(0, max);
      const searches = [...new Set((Array.isArray(input.searches) ? input.searches : []).map((item) => text(item, 80)).filter((item) => item.length >= 2))].slice(0, 20);
      const viewed = (Array.isArray(input.viewed) ? input.viewed : []).filter((item) => /^[0-9a-f-]{36}$/i.test(String(item?.id ?? ""))).slice(0, 20).map((item) => ({ id: String(item.id), name: text(item.name, 180), category: item.category ? text(item.category, 100) : null, price: Number.isFinite(Number(item.price)) ? Number(item.price) : null, image: item.image && /^(https?:|\/)/.test(String(item.image)) ? text(item.image, 2000) : null, viewedAt: Number.isFinite(Date.parse(item.viewedAt)) ? new Date(item.viewedAt).toISOString() : new Date().toISOString() }));
      const history = { searches, viewed, updatedAt: new Date().toISOString() };
      await repository.users.update(user.id, { browsingHistory: history });
      return history;
    },
    // Langganan notifikasi push per perangkat (maks 10 perangkat per akun).
    async addPushSubscription(user, input = {}) {
      const endpoint = String(input.endpoint ?? "");
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !input.keys?.p256dh || !input.keys?.auth) throw errors.validation({ subscription: "Langganan notifikasi tidak valid." });
      const row = await repository.users.findById(user.id);
      const current = (row?.pushSubscriptions ?? []).filter((item) => item.endpoint !== endpoint);
      const next = [...current, { endpoint, keys: { p256dh: String(input.keys.p256dh).slice(0, 200), auth: String(input.keys.auth).slice(0, 100) }, createdAt: new Date().toISOString() }].slice(-10);
      await repository.users.update(user.id, { pushSubscriptions: next });
      return { subscribed: true, devices: next.length };
    },
    async removePushSubscription(user, input = {}) {
      const row = await repository.users.findById(user.id);
      const next = (row?.pushSubscriptions ?? []).filter((item) => item.endpoint !== String(input.endpoint ?? ""));
      await repository.users.update(user.id, { pushSubscriptions: next });
      return { subscribed: false, devices: next.length };
    },
    async adminResetPassword(actor, userId, input) {
      if (!actor.roles.includes("admin")) throw errors.forbidden();
      await assertCurrentPassword(actor, input.adminPassword);
      if (actor.id === userId) throw errors.validation({ userId: "Gunakan pengaturan akun untuk mengganti kata sandi Admin." });
      const target = await repository.users.findById(userId);
      if (!target) throw errors.notFound("Pengguna tidak ditemukan.");
      const passwordHash = await hashPassword(input.temporaryPassword);
      const passwordChangedAt = new Date();
      const updated = await repository.transaction(async (tx) => {
        const row = await tx.users.update(userId, { passwordHash, passwordChangedAt, passwordResetRequired: true });
        await tx.sessions.revokeAllForUser(userId);
        await tx.audits.append({ entityType: "user", entityId: userId, actorId: actor.id, actorRole: "admin", activityType: "ADMIN_USER_PASSWORD_RESET", description: "Admin mengatur kata sandi sementara dan mencabut seluruh sesi pengguna.", isSystem: false });
        return row;
      });
      return { user: publicUser(updated), message: "Kata sandi sementara tersimpan. Seluruh sesi pengguna telah dicabut." };
    },
    async updateAddresses(user, input) {
      const addresses = normalizeAddresses(input.addresses);
      return repository.transaction(async (tx) => {
        const updated = await tx.users.update(user.id, { addresses });
        await audit(tx, user, "USER_ADDRESSES_UPDATED", "Pengguna memperbarui daftar alamat pengiriman.");
        return publicUser(updated);
      });
    },
    async updatePreferences(user, input) {
      const language = input.language;
      const theme = input.theme;
      if (!['id', 'en'].includes(language)) throw errors.validation({ language: "Bahasa harus id atau en." });
      if (!['light', 'dark'].includes(theme)) throw errors.validation({ theme: "Tema harus light atau dark." });
      return repository.transaction(async (tx) => {
        const updated = await tx.users.update(user.id, { language, theme });
        await audit(tx, user, "USER_PREFERENCES_UPDATED", "Pengguna memperbarui preferensi bahasa dan tema.");
        return publicUser(updated);
      });
    },
  };
}

module.exports = { createUserService };
