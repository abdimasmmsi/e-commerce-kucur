import { launch, ctx, login, BASE, ROOT } from "./pb-lib.mjs";
const b = await launch(); const c = await ctx(b, "m"); const p = await c.newPage();
await p.goto(`${BASE}/products/eac7a642-9869-4573-ae28-d1b57acd5705`); await p.waitForTimeout(2500);
await p.evaluate(()=>window.scrollTo(0,600)); await p.waitForTimeout(500);
await p.screenshot({ path: `${ROOT}/audit/var-m.png` });
await b.close();
