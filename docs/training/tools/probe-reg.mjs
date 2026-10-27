import { launch, ctx, BASE } from "./pb-lib.mjs";
const b = await launch(); const c = await ctx(b, "m"); const p = await c.newPage();
await p.goto(`${BASE}/register`); await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>[...document.querySelectorAll("form input, form button, form textarea, form select, form label")].map(e=>`${e.tagName} ${e.type||""} name=${e.name||""} id=${e.id} ph=${e.placeholder||""} "${(e.innerText||"").slice(0,50).replace(/\n/g," ")}"`).join("\n")));
await b.close();
