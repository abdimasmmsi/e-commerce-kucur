const { errors } = require("../errors/AppError");

const roles = ["customer", "merchant", "courier", "admin"];
const storeTypes = ["product"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]{7,19}$/;

const requiredString = (value, field, { max = 255 } = {}) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > max) throw errors.validation({ [field]: `Wajib diisi dan maksimal ${max} karakter.` });
  return normalized;
};

const validateEmail = (value) => {
  const email = requiredString(value, "email", { max: 254 }).toLowerCase();
  if (!emailPattern.test(email)) throw errors.validation({ email: "Format email tidak valid." });
  return email;
};

const validatePhone = (value) => {
  const phone = requiredString(value, "phone", { max: 20 });
  if (!phonePattern.test(phone)) throw errors.validation({ phone: "Format nomor telepon tidak valid." });
  return phone;
};

const validateLocation = (location) => {
  if (location == null) return { label: null, address: null, latitude: null, longitude: null };
  const latitude = location.latitude == null || location.latitude === "" ? null : Number(location.latitude);
  const longitude = location.longitude == null || location.longitude === "" ? null : Number(location.longitude);
  if ((latitude == null) !== (longitude == null)) throw errors.validation({ location: "Latitude dan longitude harus diisi bersama." });
  if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw errors.validation({ latitude: "Latitude harus antara -90 dan 90." });
  if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw errors.validation({ longitude: "Longitude harus antara -180 dan 180." });
  return {
    label: location.label == null ? null : String(location.label).trim().slice(0, 160) || null,
    address: location.address == null ? null : String(location.address).trim().slice(0, 500) || null,
    latitude,
    longitude,
  };
};

module.exports = { roles, storeTypes, requiredString, validateEmail, validatePhone, validateLocation };
