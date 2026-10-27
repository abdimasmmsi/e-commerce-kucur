const crypto = require("node:crypto");
const { errors } = require("../errors/AppError");
const { assertInServiceArea } = require("./serviceArea");

const MAX_ADDRESSES = 5;
const phonePattern = /^\+?[0-9][0-9\s-]{7,19}$/;

const text = (value, max) => (typeof value === "string" ? value.trim() : "").slice(0, max + 1);

// Validasi daftar alamat customer (maks 5, tepat satu alamat utama, titik peta wajib untuk menghitung ongkir).
function normalizeAddresses(list) {
  if (!Array.isArray(list)) throw errors.validation({ addresses: "Daftar alamat tidak valid." });
  if (list.length > MAX_ADDRESSES) throw errors.validation({ addresses: `Maksimal ${MAX_ADDRESSES} alamat.` });
  const rows = list.map((item, index) => {
    const label = text(item?.label, 40);
    const recipientName = text(item?.recipientName, 120);
    const phone = text(item?.phone, 20);
    const address = text(item?.address, 500);
    const latitude = Number(item?.latitude);
    const longitude = Number(item?.longitude);
    const field = (name) => `addresses.${index}.${name}`;
    if (!label || label.length > 40) throw errors.validation({ [field("label")]: "Label alamat wajib diisi (maks 40 karakter)." });
    if (!recipientName || recipientName.length > 120) throw errors.validation({ [field("recipientName")]: "Nama penerima wajib diisi." });
    if (!phonePattern.test(phone)) throw errors.validation({ [field("phone")]: "Nomor HP penerima tidak valid." });
    if (!address || address.length > 500) throw errors.validation({ [field("address")]: "Alamat lengkap wajib diisi (maks 500 karakter)." });
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) throw errors.validation({ [field("location")]: "Tandai titik alamat di peta." });
    assertInServiceArea(latitude, longitude, field("location"));
    return { id: typeof item?.id === "string" && item.id.length <= 40 ? item.id : crypto.randomUUID(), label, recipientName, phone, address, latitude, longitude, isPrimary: Boolean(item?.isPrimary) };
  });
  if (rows.length) {
    const primaryIndex = Math.max(0, rows.findIndex((row) => row.isPrimary));
    rows.forEach((row, index) => { row.isPrimary = index === primaryIndex; });
  }
  return rows;
}

module.exports = { MAX_ADDRESSES, normalizeAddresses };
