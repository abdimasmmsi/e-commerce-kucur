import { openBrowser, newCtx, BASE, settle, shot } from "./lib.mjs";
const [, , email, vk, ...urls] = process.argv;
const b = await openBrowser();
const { page } = await newCtx(b, vk, email);
for (const u of urls) { const [path, name] = u.split("="); await page.goto(BASE + path); await settle(page); await page.screenshot({ path: `D:/kucur-platform/docs/training/audit/x-${name}-${vk}.png` }); console.log(name, page.url(), page.errors.splice(0)); }
await b.close();
