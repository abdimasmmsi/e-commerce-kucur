import { apiLogin, api } from "./lib.mjs";
const c = await apiLogin("customer@kucur.test");
const r = await api(c, "/conversations/customer-merchant", { method: "POST", body: { productId: "e99e6999-0277-46fe-b3ad-5125bea26f63" } });
console.log(r.status, r.data.id);
const s = await api(c, `/conversations/${r.data.id}/messages`, { method: "POST", body: { message: "Selamat siang, yogurt plain masih ada untuk besok pagi?" } });
console.log(s.status, JSON.stringify(s.data).slice(0, 150));
