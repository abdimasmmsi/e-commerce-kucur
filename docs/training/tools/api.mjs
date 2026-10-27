// Pembantu API demo (http://localhost:3001) untuk memeriksa data sebelum mengambil screenshot.
const API = process.env.API ?? "http://localhost:3001";
export async function login(email) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "KucurDev123!" }) });
  return (await r.json()).data.token;
}
export async function call(token, path, opt = {}) {
  const r = await fetch(`${API}/api${path}`, { method: opt.method ?? "GET", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, data: j?.data ?? j };
}
