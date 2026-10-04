// Foto bukti antar dari kamera HP: diperkecil (sisi terpanjang 1280px) dan dikompres agar di bawah batas upload backend.
const MAX_UPLOAD_SIZE = 620 * 1024;
const MAX_SIDE = 1280;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(
  (blob) => blob ? resolve(blob) : reject(new Error("PROOF_IMAGE_PROCESS_FAILED")),
  "image/jpeg",
  quality,
));

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("PROOF_IMAGE_READ_FAILED"));
  reader.readAsDataURL(blob);
});

export async function prepareProofPhoto(file) {
  if (!ACCEPTED_TYPES.has(file?.type)) throw new Error("PROOF_IMAGE_FORMAT");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_UPLOAD_SIZE && quality > 0.4) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_UPLOAD_SIZE) throw new Error("PROOF_IMAGE_SIZE");
  return blobToDataUrl(blob);
}
