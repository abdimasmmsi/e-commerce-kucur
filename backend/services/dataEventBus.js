// Sinyal "data berubah" untuk tampilan realtime. Ditunda sebentar dan digabung supaya transaksi sempat selesai
// sebelum klien memuat ulang, dan banyak perubahan beruntun hanya memicu satu sinyal.
const listeners = new Set();
const DELAY_MS = 500;
let pending = null;
let timer = null;

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

const flush = () => {
  const batch = pending;
  pending = null;
  timer = null;
  if (!batch) return;
  const payload = { userIds: [...batch.userIds], roles: [...batch.roles] };
  for (const listener of listeners) { try { listener(payload); } catch { /* pendengar tidak boleh menggagalkan aksi */ } }
};

const publish = ({ userIds = [], roles = [] } = {}) => {
  if (!userIds.length && !roles.length) return;
  pending ??= { userIds: new Set(), roles: new Set() };
  for (const id of userIds) if (id) pending.userIds.add(String(id));
  for (const role of roles) if (role) pending.roles.add(String(role));
  if (!timer) { timer = setTimeout(flush, DELAY_MS); timer.unref?.(); }
};

module.exports = { publish, subscribe, flush };
