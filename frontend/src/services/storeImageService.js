import { apiData } from "./apiClient";

const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 620 * 1024;
const MIN_DIMENSION = 600;
const OUTPUT_DIMENSION = 1000;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(
  (blob) => blob ? resolve(blob) : reject(new Error("STORE_IMAGE_PROCESS_FAILED")),
  "image/webp",
  quality,
));

export async function processStoreImage(file) {
  if (!ACCEPTED_TYPES.has(file?.type)) throw new Error("STORE_IMAGE_FORMAT");
  if (file.size > MAX_SOURCE_SIZE) throw new Error("STORE_IMAGE_SIZE");
  const bitmap = await createImageBitmap(file);
  if (Math.min(bitmap.width, bitmap.height) < MIN_DIMENSION) {
    bitmap.close();
    throw new Error("STORE_IMAGE_DIMENSION");
  }
  const cropSize = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.round((bitmap.width - cropSize) / 2);
  const sourceY = Math.round((bitmap.height - cropSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_DIMENSION;
  canvas.height = OUTPUT_DIMENSION;
  canvas.getContext("2d").drawImage(bitmap, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_DIMENSION, OUTPUT_DIMENSION);
  bitmap.close();
  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_UPLOAD_SIZE && quality > 0.5) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_UPLOAD_SIZE) throw new Error("STORE_IMAGE_PROCESSED_SIZE");
  return blob;
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("STORE_IMAGE_READ_FAILED"));
  reader.readAsDataURL(blob);
});

// Produksi satu origin (VITE_API_BASE_URL kosong): simpan path relatif supaya ikut HTTPS dan lolos CSP img-src 'self'.
export async function uploadStoreImage(blob) {
  const dataUrl = await blobToDataUrl(blob);
  const data = await apiData("/api/stores/images", { method: "POST", body: { dataUrl }, timeoutMs: 30000 });
  return import.meta.env.VITE_API_BASE_URL === "" && data.path ? data.path : data.url;
}
