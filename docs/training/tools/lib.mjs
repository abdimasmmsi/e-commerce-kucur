import { createRequire } from "node:module";
const require = createRequire("D:/kucur-platform/frontend/package.json");
export const { chromium } = require("@playwright/test");
export const BASE = process.env.BASE ?? "https://localhost:5175";
export const ROOT = "D:/kucur-platform/docs/training";
export const VP = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 },
};
export async function open(vk, email = "admin@kucur.test") {
  const browser = await chromium.launch({ channel: "chrome", args: ["--ignore-certificate-errors"] });
  const context = await browser.newContext({ ...VP[vk], locale: "id-ID", ignoreHTTPSErrors: true });
  await context.addInitScript(() => { try { sessionStorage.setItem("kucur:batch-reminder-snooze", String(Date.now() + 86400000)); } catch { /* */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password|Kata Sandi/i).fill("KucurDev123!");
  await page.getByRole("button", { name: /Login|Masuk/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 });
  await page.locator("main").first().waitFor();
  return { browser, context, page };
}
export const settle = async (page, ms = 900) => { await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(ms); };
export const go = async (page, route) => { await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }); await page.locator("main, .page-container").first().waitFor({ timeout: 15000 }).catch(() => {}); await settle(page); };
