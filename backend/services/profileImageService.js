const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { errors } = require("../errors/AppError");

const uploadDirectory = path.resolve(__dirname, "../uploads/profiles");
const MAX_IMAGE_BYTES = 420 * 1024;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const hasValidSignature = (mimeType, bytes) => {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
};

function decodeProfileImage(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || ""));
  const mimeType = match?.[1]?.toLowerCase();
  if (!match || !extensions[mimeType]) throw errors.validation({ avatar: "Format foto harus JPG, PNG, atau WebP." });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw errors.validation({ avatar: "Ukuran foto setelah diproses maksimal 420 KB." });
  if (!hasValidSignature(mimeType, bytes)) throw errors.validation({ avatar: "Isi file foto tidak valid." });
  return { bytes, extension: extensions[mimeType] };
}

async function saveProfileImage(dataUrl) {
  const { bytes, extension } = decodeProfileImage(dataUrl);
  await fs.mkdir(uploadDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadDirectory, filename), bytes, { flag: "wx" });
  return `/uploads/profiles/${filename}`;
}

async function removeProfileImage(avatarUrl) {
  const filename = path.basename(String(avatarUrl || ""));
  if (!filename || avatarUrl !== `/uploads/profiles/${filename}`) return;
  await fs.unlink(path.join(uploadDirectory, filename)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

module.exports = { removeProfileImage, saveProfileImage, uploadDirectory };
