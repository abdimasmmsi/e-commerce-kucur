import { login, call } from "./api.mjs";
const t = await login("customer@kucur.test");
const r = await call(t, "/orders");
const list = Array.isArray(r.data) ? r.data : r.data.orders ?? r.data.items ?? [];
console.log(r.status, list.length);
for (const o of list) console.log(o.id.slice(0,8), o.status, o.paymentStatus, o.storeName ?? o.store?.name, (o.items??[]).map(i=>i.productName??i.name).join(","), o.createdAt?.slice(0,10));
const rv = await call(t, "/reviews/mine"); console.log("reviews", rv.status, JSON.stringify(rv.data).slice(0,200));
