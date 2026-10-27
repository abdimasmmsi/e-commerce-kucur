import { launch, ctx, login, BASE, ROOT } from "./pb-lib.mjs";
const b = await launch(); const c = await ctx(b, "m"); const p = await c.newPage();
await login(p, "customer@kucur.test");
const FULL = process.argv[2];



await p.goto(`${BASE}/orders/${FULL}`); await p.waitForTimeout(2500);
await p.screenshot({ path: `${ROOT}/audit/done-m.png`, fullPage: true });
await b.close();
