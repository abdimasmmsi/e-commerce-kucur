// Tautan chat WhatsApp (wa.me) dari nomor HP Indonesia: 08xx / +62 / 62 → 62xx. Nomor tidak valid → null.
export function whatsappNumber(phone) {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

export function whatsappLink(phone, text = "") {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}
