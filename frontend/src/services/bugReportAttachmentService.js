export const BUG_SCREENSHOT_MAX_COUNT = 3;
export const BUG_SCREENSHOT_MAX_BYTES = 1024 * 1024;
export const BUG_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Screenshot tidak dapat dibaca."));
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

const compressImage = (dataUrl, file) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onerror = () => reject(new Error(`Format ${file.name} tidak dapat diproses.`));
  image.onload = () => {
    try {
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser tidak mendukung pemrosesan screenshot.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({
        id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: "image/jpeg",
        size: file.size,
        dataUrl: canvas.toDataURL("image/jpeg", .76),
      });
    } catch (error) {
      reject(error);
    }
  };
  image.src = dataUrl;
});

export async function prepareBugReportScreenshots(files, existingCount = 0) {
  const selected = Array.from(files ?? []);
  if (selected.length + existingCount > BUG_SCREENSHOT_MAX_COUNT) throw new Error(`Maksimal ${BUG_SCREENSHOT_MAX_COUNT} screenshot per laporan.`);
  for (const file of selected) {
    if (!BUG_SCREENSHOT_TYPES.includes(file.type)) throw new Error(`${file.name}: format harus PNG, JPG, JPEG, atau WEBP.`);
    if (file.size > BUG_SCREENSHOT_MAX_BYTES) throw new Error(`${file.name}: ukuran maksimal 1 MB.`);
  }
  return Promise.all(selected.map(async (file) => compressImage(await readFile(file), file)));
}
