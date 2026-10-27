import { openBrowser, newCtx, go, settle, shot, audit } from "./lib.mjs";
const B = "/courier/batches/62dc5508-3fe8-4a53-8cfe-45dca435cd7a";
const b = await openBrowser();
const ctx = {}; for (const vk of ["m", "d"]) ctx[vk] = await newCtx(b, vk, "courier@kucur.test");
const m = ctx.m.page, d = ctx.d.page;
m.on("response", async (r) => { if (r.request().method() !== "GET" && /\/api\//.test(r.url())) { const t = await r.text().catch(() => ""); console.log("  >>", r.request().method(), new URL(r.url()).pathname, r.status(), /passwordHash/.test(t) ? "LEAK" : "", r.status() >= 400 ? t.slice(0, 150) : ""); } });
const snap = async (name) => { for (const vk of ["m", "d"]) { const p = ctx[vk].page; await settle(p, 500); await shot(p, "kurir", name, vk); await audit(p, `${name}-${vk}`); } };
await go(m, B); await go(d, B);
await m.getByRole("button", { name: /Mulai Antar/ }).click(); await settle(m, 1200);
await go(m, B); await go(d, B);
await snap("sedang-diantar");
console.log("buttons", await m.getByRole("button").allInnerTexts(), "files", await m.locator("input[type=file]").count());
// dialog gagal antar (hanya dibuka)
for (const p of [m, d]) { await p.getByRole("button", { name: /Gagal antar/ }).click(); await p.waitForTimeout(500); }
await snap("gagal-antar-dialog");
for (const p of [m, d]) await p.keyboard.press("Escape");
await m.waitForTimeout(400); await d.waitForTimeout(400);
console.log("dialog masih?", await m.locator("[aria-modal=true]").count());
await b.close();
