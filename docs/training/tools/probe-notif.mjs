import { launch, ctx, login, BASE } from "./pb-lib.mjs";
const b = await launch(); const c = await ctx(b, "m"); const p = await c.newPage();
await login(p, "customer@kucur.test");
await p.goto(`${BASE}/notifications`); await p.waitForTimeout(2500);
const t = await p.evaluate(() => document.body.innerText);
console.log(t.split("\n").filter((l, i, a) => /undefined/.test(l) || /undefined/.test(a[i-1]||"")).join("\n"));
console.log(await p.evaluate(()=>[...document.querySelectorAll("main *")].filter(e=>e.children.length==0 && /undefined/.test(e.textContent)).map(e=>e.parentElement.outerHTML.slice(0,400))));
await b.close();
