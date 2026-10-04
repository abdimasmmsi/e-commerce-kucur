const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 390 * 1024;
const MIN_DIMENSION = 160;
const OUTPUT_DIMENSION = 512;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(
  (blob) => blob ? resolve(blob) : reject(new Error("PROFILE_IMAGE_PROCESS_FAILED")),
  "image/webp",
  quality,
));

export async function inspectProfileImage(file) {
  if (!ACCEPTED_TYPES.has(file?.type)) throw new Error("PROFILE_IMAGE_FORMAT");
  if (file.size > MAX_SOURCE_SIZE) throw new Error("PROFILE_IMAGE_SIZE");
  const bitmap = await createImageBitmap(file);
  if (Math.min(bitmap.width, bitmap.height) < MIN_DIMENSION) {
    bitmap.close();
    throw new Error("PROFILE_IMAGE_DIMENSION");
  }
  return bitmap;
}

export function drawProfileCrop(bitmap, canvas, crop, outputDimension = OUTPUT_DIMENSION) {
  if (!bitmap || !canvas) return;
  const context = canvas.getContext("2d");
  const zoom = Math.max(1, Number(crop.zoom) || 1);
  const sourceSize = Math.min(bitmap.width, bitmap.height) / zoom;
  const sourceX = (bitmap.width - sourceSize) * ((Number(crop.focusX) || 0) / 100);
  const sourceY = (bitmap.height - sourceSize) * ((Number(crop.focusY) || 0) / 100);
  canvas.width = outputDimension;
  canvas.height = outputDimension;
  // Preserve alpha from PNG/WebP sources. The shared Avatar surface supplies
  // the theme-aware neutral background at render time.
  context.clearRect(0, 0, outputDimension, outputDimension);
  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputDimension, outputDimension);
}

export async function exportProfileCrop(bitmap, crop) {
  const canvas = document.createElement("canvas");
  drawProfileCrop(bitmap, canvas, crop);
  let quality = 0.88;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_UPLOAD_SIZE && quality > 0.5) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_UPLOAD_SIZE) throw new Error("PROFILE_IMAGE_PROCESSED_SIZE");
  return blob;
}

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("PROFILE_IMAGE_READ_FAILED"));
  reader.readAsDataURL(blob);
});
