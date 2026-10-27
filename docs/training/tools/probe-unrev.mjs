import { launch, ctx, login, BASE } from "./pb-lib.mjs";
import { login as al, call } from "./api.mjs";
const t = await al("customer@kucur.test"); const r = await call(t, "/orders"); const l = (Array.isArray(r.data) ? r.data : r.data.orders).filter(o => o.fulfillmentStatus === "completed");
const b = await launch(); const c = await ctx(b, "m"); const p = await c.newPage(); await login(p, "customer@kucur.test");
for (const o of l) { await p.goto(`${BASE}/orders/${o.id}`); await p.waitForTimeout(1800); const txt = await p.locator("main").first().innerText(); console.log(o.id.slice(0,8), /Sudah diulas/.test(txt) ? "sudah" : "BELUM", await p.getByRole("link", { name: /Beri ulasan|Ulas/ }).count()); }
await b.close();
