// Pembantu Playwright untuk panduan Pengunjung + Pembeli.
import { createRequire } from "node:module";
const require = createRequire("D:/kucur-platform/frontend/package.json");
export const { chromium } = require("@playwright/test");
export const BASE = process.env.BASE ?? "https://localhost:5175";
export const ROOT = "D:/kucur-platform/docs/training";
export const PASSWORD = "KucurDev123!";
export const VP = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 },
};
export const launch = () => chromium.launch({ channel: "chrome", args: ["--ignore-certificate-errors"] });
export async function ctx(browser, k) {
  return browser.newContext({ ...VP[k], locale: "id-ID", ignoreHTTPSErrors: true, geolocation: { latitude: -7.9551, longitude: 112.5489 }, permissions: ["geolocation"] });
}
export async function login(page, email, pw = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password|Kata Sandi/i).fill(pw);
  await page.getByRole("button", { name: /Login|Masuk/i }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 });
  await page.locator("main").first().waitFor();
}
