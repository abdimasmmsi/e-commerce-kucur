const DB_NAME = "kucur-product-images";
const STORE_NAME = "images";
const DB_VERSION = 1;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MIN_DIMENSION = 800;
const MAX_DIMENSION = 1600;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Gambar gagal diproses.")),
    type,
    quality,
  ));
}

export async function saveProductImage(file) {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Format harus JPG, PNG, atau WebP.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Ukuran gambar maksimal 8 MB.");

  const bitmap = await createImageBitmap(file);
  if (bitmap.width < MIN_DIMENSION || bitmap.height < MIN_DIMENSION) {
    bitmap.close();
    throw new Error("Resolusi gambar terlalu rendah. Gunakan gambar minimal 800 × 800 px.");
  }
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.round((bitmap.width - sourceSize) / 2);
  const sourceY = Math.round((bitmap.height - sourceSize) / 2);
  const outputSize = Math.min(sourceSize, MAX_DIMENSION);
  const width = outputSize;
  const height = outputSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    width,
    height,
  );
  bitmap.close();

  const outputType = file.type === "image/png" ? "image/webp" : file.type;
  let quality = 0.85;
  let blob = await canvasToBlob(canvas, outputType, quality);
  while (blob.size > 1024 * 1024 && quality > 0.65) {
    quality -= 0.05;
    blob = await canvasToBlob(canvas, outputType, quality);
  }
  const id = `IMG-${Date.now()}-${crypto.randomUUID()}`;
  const storageKey = `product-image-${id}`;
  await withStore("readwrite", (store) => store.put(blob, storageKey));
  return { id, storageKey, isPrimary: false, width, height, mimeType: blob.type, size: blob.size };
}

export function getProductImage(storageKey) {
  return withStore("readonly", (store) => store.get(storageKey));
}

export function deleteProductImage(storageKey) {
  if (!storageKey) return Promise.resolve();
  return withStore("readwrite", (store) => store.delete(storageKey));
}

export function getPrimaryProductImage(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  return images.find((image) => image.isPrimary) ?? images[0] ?? (product?.image ? { id: "legacy", url: product.image, isPrimary: true } : null);
}
