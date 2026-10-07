// Uji rebutan stok: banyak pembeli BERBEDA checkout pada detik yang sama untuk stok yang sedikit.
// Jalankan (backend harus hidup): node scripts/concurrencyCheck.js
// Memakai database dari .env (e2e `kucur`). Membuat produk sementara + pembeli sementara, lalu membersihkan.
// Yang diperiksa: jumlah pesanan yang lolos == stok awal, stok akhir tidak pernah negatif, tidak ada pesanan ganda.
const crypto = require("node:crypto");
require("dotenv").config({ quiet: true });
const { getPrisma } = require("../config/prisma");

const API = (process.env.CHECK_API || "http://localhost:3000") + "/api";
const STORE_ID = process.env.CHECK_STORE_ID || "10000000-0000-4000-8000-000000000002"; // lapak QA (Merchant B)
const BUYERS = Number(process.env.CHECK_BUYERS || 8);
const prisma = getPrisma();

async function call(method, path, token, body, headers = {}) {
  const response = await fetch(API + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await response.json(); } catch { /* bukan JSON */ }
  return { status: response.status, body: json };
}

async function newBuyer(index) {
  const email = `rebutan.${index}@kucur.test`; // akun tetap, dipakai ulang (tidak menumpuk di database)
  const password = "KucurTest123!";
  const address = { label: "Rumah", recipientName: `Pembeli ${index}`, phone: "081200000000", address: "Jl. Uji Rebutan No. 1, Desa Kucur", latitude: -7.9605, longitude: 112.5452 };
  const registered = await call("POST", "/auth/register", null, { fullName: `Pembeli Rebutan ${index}`, email, phone: "081200000000", password, confirmPassword: password, address });
  if (registered.status >= 300 && registered.status !== 409) throw new Error(`register gagal ${registered.status} ${JSON.stringify(registered.body)}`);
  const session = await call("POST", "/auth/login", null, { email, password });
  if (session.status !== 200) throw new Error(`login gagal ${session.status}`);
  return { email, token: session.body.data?.token ?? session.body.token, address };
}

const checkoutBody = (productId, quantity, address) => ({ items: [{ productId, quantity }], paymentMethod: "COD", delivery: { address: address.address, recipientName: address.recipientName, recipientPhone: address.phone, location: { latitude: address.latitude, longitude: address.longitude } } });
const reason = (r) => r.body?.code || r.body?.error?.code || "";
const summary = (results) => results.reduce((acc, r) => { const key = `${r.status}${reason(r) ? ` ${reason(r)}` : ""}`; acc[key] = (acc[key] || 0) + 1; return acc; }, {});

let failures = 0;
const verdict = (ok, text) => { if (!ok) failures += 1; console.log(`  ${ok ? "LOLOS" : "GAGAL"}  ${text}`); };

async function scenario(title, buyers, { stock, quantity = 1, viaCart = false }) {
  console.log(`\n== ${title}`);
  const productId = crypto.randomUUID();
  await prisma.targetProduct.create({ data: { id: productId, storeId: STORE_ID, name: `UJI REBUTAN ${title}`, productType: "SIMPLE", price: 1000, stock, images: [], options: [], status: "ACTIVE" } });
  const keyOf = () => `rebutan-${crypto.randomUUID()}`;
  let results;
  if (viaCart) {
    const cartItemIds = [];
    for (const buyer of buyers) {
      const added = await call("POST", "/cart/items", buyer.token, { productId, quantity });
      const cart = await call("GET", "/cart", buyer.token);
      cartItemIds.push((cart.body?.data?.items ?? []).find((item) => String(item.productId) === productId)?.id);
      if (added.status >= 300) console.log("  (keranjang menolak:", added.status, reason(added), ")");
    }
    results = await Promise.all(buyers.map((buyer, index) => call("POST", "/checkout/orders", buyer.token, { cartItemIds: [cartItemIds[index]].filter(Boolean), paymentMethod: "COD", delivery: checkoutBody(productId, 1, buyer.address).delivery }, { "Idempotency-Key": keyOf() })));
  } else {
    results = await Promise.all(buyers.map((buyer) => call("POST", "/checkout/orders", buyer.token, checkoutBody(productId, quantity, buyer.address), { "Idempotency-Key": keyOf() })));
  }
  const success = results.filter((r) => r.status === 201 || r.status === 200).length;
  const orders = await prisma.targetCommerceOrder.findMany({ where: { items: { some: { productId } } }, include: { items: true } });
  const sold = orders.flatMap((order) => order.items.filter((item) => item.productId === productId)).reduce((sum, item) => sum + item.quantity, 0);
  const after = (await prisma.targetProduct.findUnique({ where: { id: productId } })).stock;
  const expected = Math.floor(stock / quantity);
  console.log(`  ${buyers.length} pembeli serentak, stok awal ${stock}, jumlah/pesanan ${viaCart ? 1 : quantity} → hasil:`, JSON.stringify(summary(results)));
  verdict(success === Math.min(expected, buyers.length), `pesanan yang lolos = ${success} (seharusnya ${Math.min(expected, buyers.length)})`);
  verdict(after >= 0, `stok akhir = ${after} (tidak boleh negatif)`);
  verdict(stock - after === sold, `stok berkurang ${stock - after} = barang di pesanan ${sold} (tidak ada barang hilang/ganda)`);
  verdict(orders.length === success, `jumlah pesanan di database ${orders.length} = respons sukses ${success}`);
  // Bersihkan: batalkan agar stok kembali, lalu arsipkan produk.
  for (const order of orders) {
    const owner = buyers.find((buyer, index) => results[index].status < 300 && JSON.stringify(results[index].body).includes(order.id));
    if (owner) await call("POST", `/orders/${order.id}/cancel`, owner.token, { reason: "uji rebutan" });
  }
  const restored = (await prisma.targetProduct.findUnique({ where: { id: productId } })).stock;
  verdict(restored === stock, `setelah dibatalkan stok kembali ke ${restored} (awal ${stock})`);
  await prisma.targetProduct.update({ where: { id: productId }, data: { status: "ARCHIVED" } }).catch(() => prisma.targetProduct.update({ where: { id: productId }, data: { status: "INACTIVE" } }));
}

(async () => {
  console.log(`API ${API}, ${BUYERS} pembeli uji, DB ${String(process.env.DATABASE_URL || "").replace(/:\/\/[^@]*@/, "://***@")}`);
  const buyers = [];
  for (let index = 1; index <= BUYERS; index += 1) buyers.push(await newBuyer(index));
  await scenario("stok 1, Beli Sekarang", buyers, { stock: 1 });
  await scenario("stok 1, lewat keranjang", buyers, { stock: 1, viaCart: true });
  await scenario("stok 3 diperebutkan semua", buyers, { stock: 3 });
  await scenario("stok 4, masing-masing beli 2", buyers, { stock: 4, quantity: 2 });
  console.log(failures ? `\n${failures} pemeriksaan GAGAL` : "\nSemua pemeriksaan rebutan stok LOLOS");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
})().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
