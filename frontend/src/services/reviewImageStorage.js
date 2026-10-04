const DB_NAME = "kucur-review-images";
const STORE_NAME = "images";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_DIMENSION = 1800;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const openDatabase = () => new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const withStore = async (mode, operation) => { const database = await openDatabase(); return new Promise((resolve, reject) => { const transaction = database.transaction(STORE_NAME, mode); const request = operation(transaction.objectStore(STORE_NAME)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); transaction.oncomplete = () => database.close(); transaction.onerror = () => reject(transaction.error); }); };
const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Foto gagal diproses.")), type, quality));

export async function saveReviewImage(file) {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Format foto harus JPG, PNG, atau WebP.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran foto maksimal 8 MB.");
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)); const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale)); const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height); bitmap.close(); const blob = await canvasToBlob(canvas, "image/webp", .86); const id = `REVIMG-${Date.now()}-${crypto.randomUUID()}`; const storageKey = `review-image-${id}`; await withStore("readwrite", (store) => store.put(blob, storageKey)); return { id, storageKey, width, height, mimeType: blob.type, size: blob.size };
}
export const getReviewImage = (storageKey) => withStore("readonly", (store) => store.get(storageKey));
export const deleteReviewImage = (storageKey) => storageKey ? withStore("readwrite", (store) => store.delete(storageKey)) : Promise.resolve();
