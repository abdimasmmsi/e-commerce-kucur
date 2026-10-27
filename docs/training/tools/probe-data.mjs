import { login, call } from "./api.mjs";
const m = await login("merchant.a@kucur.test");
const o = await call(m, "/orders?scope=merchant&limit=200");
const list = o.data?.items ?? o.data; console.log(Object.keys(list[0]).join(","));
const c = {}; list.forEach((x) => { const k = x.orderStatus ?? x.fulfillmentStatus; c[k] = (c[k] || 0) + 1; }); console.log(c);
const k = await login("courier@kucur.test");
const b = await call(k, "/courier/batches");
b.data.forEach((x) => console.log(x.id, x.status, x.deliveryDate?.slice(0, 10), x.orders.map((y) => y.status + "/" + y.commerceOrder?.orderStatus).join(",")));
const pr = await call(m, "/stores/832ac337-9e6f-4640-847c-e4421fee2243"); console.log(pr.status, Object.keys(pr.data));
