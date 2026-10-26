// Akun contoh untuk server UAT, diisi saat build lewat VITE_UAT_ACCOUNTS (JSON: [{ label, email, password }]).
// Hanya berisi akun penjual contoh berhak rendah; akun admin sengaja tidak pernah dimasukkan ke sini.
function parse() {
  try {
    const list = JSON.parse(import.meta.env.VITE_UAT_ACCOUNTS || "[]");
    return Array.isArray(list) ? list.filter((item) => item && typeof item.email === "string" && typeof item.password === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export const uatAccounts = parse();
