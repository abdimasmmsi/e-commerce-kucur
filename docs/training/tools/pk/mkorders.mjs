import { apiLogin, api } from "./lib.mjs";
const c = await apiLogin("customer@kucur.test");
const me = await api(c, "/auth/me"); const addr = me.data.user?.addresses?.[0] ?? me.data.addresses?.[0];
console.log("addr", addr?.address, addr?.latitude);
const prods = await api(c, "/products?storeId=832ac337-9e6f-4640-847c-e4421fee2243");
const list = Array.isArray(prods.data) ? prods.data : prods.data.items; console.log(list.map((p) => [p.id, p.name, p.hasVariants, p.stock, p.storeId].join("|")));
const n = Number(process.argv[2] ?? 0);
for (let i = 0; i < n; i++) {
  const p = list.find((x) => !x.hasVariants && x.stock > 5 && x.storeId === "832ac337-9e6f-4640-847c-e4421fee2243");
  const body = { items: [{ productId: p.id, quantity: 2 }], paymentMethod: "COD", recipientName: addr.recipientName, recipientPhone: addr.phone, delivery: { address: addr.address, recipientName: addr.recipientName, recipientPhone: addr.phone, location: { latitude: addr.latitude, longitude: addr.longitude } }, idempotencyKey: crypto.randomUUID() };
  const r = await api(c, "/checkout/orders", { method: "POST", body }); console.log(r.status, JSON.stringify(r.data).slice(0, 200));
}
