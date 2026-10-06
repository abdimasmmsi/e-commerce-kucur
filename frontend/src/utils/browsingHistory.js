import { apiData } from "../services/apiClient";

// Riwayat pencarian & produk dilihat. HANYA untuk pengguna login (pengunjung tidak disimpan).
// Disimpan di akun (PUT /api/users/me/history) supaya sama di semua perangkat; salinan lokal per akun
// dipakai agar panel langsung tampil. Bukan data otoritatif, aman bila kosong.
export const HISTORY_EVENT = "kucur:history-changed";
const MAX_STORED = 20;
let owner = null;
let saveTimer = null;

const key = (kind) => `kucur:${kind}:${owner}`;
const read = (kind) => { if (!owner) return []; try { const value = JSON.parse(localStorage.getItem(key(kind)) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const store = (kind, list) => { try { localStorage.setItem(key(kind), JSON.stringify(list.slice(0, MAX_STORED))); } catch { /* penyimpanan tidak tersedia */ } };
const notify = () => window.dispatchEvent(new Event(HISTORY_EVENT));
const syncLater = () => { window.clearTimeout(saveTimer); const current = owner; saveTimer = window.setTimeout(() => { if (owner === current) void apiData("/api/users/me/history", { method: "PUT", body: { searches: getSearches(), viewed: getViewed() } }).catch(() => {}); }, 800); };
const write = (kind, list) => { if (!owner) return; store(kind, list); notify(); syncLater(); };

// Dipanggil saat login/logout. Riwayat lama pengunjung (versi sebelumnya) dibersihkan.
export function setHistoryOwner(userId) {
  owner = userId ? String(userId) : null;
  try { localStorage.removeItem("kucur:searches:guest"); localStorage.removeItem("kucur:viewed:guest"); } catch { /* abaikan */ }
  notify();
  if (!owner) return;
  const current = owner;
  apiData("/api/users/me/history").then((history) => {
    if (owner !== current || !history) return;
    const merge = (server, local, id) => [...new Map([...(server ?? []), ...local].map((item) => [id(item), item])).values()];
    store("searches", merge(history.searches, getSearches(), (item) => String(item).toLowerCase()).slice(0, MAX_STORED));
    store("viewed", merge(history.viewed, getViewed(), (item) => item.id).sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt)).slice(0, MAX_STORED));
    notify();
  }).catch(() => {});
}
export const historyEnabled = () => Boolean(owner);

export const getSearches = () => read("searches");
export function addSearch(text) {
  const query = String(text ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (query.length < 2) return;
  write("searches", [query, ...getSearches().filter((item) => item.toLowerCase() !== query.toLowerCase())]);
}
export const removeSearch = (query) => write("searches", getSearches().filter((item) => item !== query));
export const clearSearches = () => write("searches", []);

export const getViewed = () => read("viewed");
export function addViewed(product) {
  if (!product?.id) return;
  const snapshot = { id: String(product.id), name: product.name, category: product.category ?? null, price: product.price ?? null, image: product.images?.find?.((image) => image.isPrimary)?.url ?? product.images?.[0]?.url ?? product.image ?? null, viewedAt: new Date().toISOString() };
  write("viewed", [snapshot, ...getViewed().filter((item) => item.id !== snapshot.id)]);
}
export const removeViewed = (id) => write("viewed", getViewed().filter((item) => item.id !== String(id)));
export const clearViewed = () => write("viewed", []);

// Rekomendasi "Untuk kamu": produk yang kategorinya sering dilihat atau cocok dengan kata yang pernah dicari.
// Tanpa riwayat (mis. pengunjung) → urut dari yang paling laris 30 hari terakhir.
export function personalize(products, { searches = getSearches(), viewed = getViewed() } = {}) {
  const categoryWeight = new Map();
  viewed.forEach((item, index) => { if (item.category) categoryWeight.set(item.category, (categoryWeight.get(item.category) ?? 0) + Math.max(1, 5 - index)); });
  const terms = searches.slice(0, 10).flatMap((query) => query.toLowerCase().split(/\s+/)).filter((word) => word.length >= 3);
  const viewedIds = new Set(viewed.slice(0, 3).map((item) => item.id));
  const score = (product) => {
    const text = `${product.name} ${product.category ?? ""} ${product.store?.name ?? ""}`.toLowerCase();
    return (categoryWeight.get(product.category) ?? 0) * 3 + terms.filter((word) => text.includes(word)).length * 4 + Math.min(Number(product.soldRecent || 0), 10) * 0.2 - (viewedIds.has(String(product.id)) ? 2 : 0);
  };
  return [...products].map((product) => ({ product, score: score(product) })).sort((a, b) => b.score - a.score).map((row) => row.product);
}
