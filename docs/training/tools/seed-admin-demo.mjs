// Membuat 2 pengajuan lapak contoh (status Menunggu) untuk bahan panduan Admin. Aman dijalankan ulang (lewati yang sudah ada).
const B = process.env.API ?? "http://localhost:3001/api";
const PASS = "KucurDev123!";
const post = async (p, body, token) => { const r = await fetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const people = [
  { fullName: "Tinah Wulandari", email: "tinah.rempeyek@kucur.test", phone: "081230003101", store: "Rempeyek Bu Tinah", desc: "Rempeyek kacang dan teri buatan rumah, digoreng segar setiap hari.", addr: "Dusun Krajan RT 02/RW 01, Desa Kucur, Kec. Dau, Kab. Malang", lat: -7.9571, lng: 112.5452 },
  { fullName: "Joko Santoso", email: "joko.tahu@kucur.test", phone: "081230003102", store: "Tahu Bakso Pak Joko", desc: "Tahu bakso dan siomay beku siap kukus.", addr: "Dusun Sumberbendo RT 01/RW 03, Desa Kucur, Kec. Dau, Kab. Malang", lat: -7.9640, lng: 112.5371 },
];
for (const p of people) {
  const address = { label: "Rumah", recipientName: p.fullName, phone: p.phone, address: p.addr, latitude: p.lat, longitude: p.lng };
  const reg = await post("/auth/register", { fullName: p.fullName, email: p.email, phone: p.phone, password: PASS, address });
  console.log(p.email, "register", reg.status);
  const login = await post("/auth/login", { email: p.email, password: PASS });
  const token = login.json.data?.token; if (!token) { console.log("login gagal", login.json); continue; }
  const st = await post("/stores", { name: p.store, type: "product", description: p.desc, phone: p.phone, location: { address: p.addr, latitude: p.lat, longitude: p.lng } }, token);
  console.log(p.store, st.status, st.json.error?.message ?? st.json.message ?? "");
}
