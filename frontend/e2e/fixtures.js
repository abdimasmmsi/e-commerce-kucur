import { expect, test as base } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export const qaAccounts = {
  customer: "customer@kucur.test",
  merchant: "merchant.a@kucur.test",
  merchantB: "merchant.b@kucur.test",
  courier: "courier@kucur.test",
  admin: "admin@kucur.test",
};

const password = "KucurDev123!";
const artifactRoot = path.resolve("../artifacts/playwright-qa");

export async function attachDiagnostics(page, testInfo) {
  const diagnostics = { consoleErrors: [], warnings: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  page.on("console", (message) => {
    const row = `${message.type()}: ${message.text()}`;
    if (message.type() === "error") diagnostics.consoleErrors.push(row);
    if (message.type() === "warning") diagnostics.warnings.push(row);
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.stack ?? error.message));
  page.on("requestfailed", (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/api\//i.test(response.url())) diagnostics.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return async () => {
    const folder = path.join(artifactRoot, "diagnostics");
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, `${testInfo.testId.replace(/[^a-z0-9_-]+/gi, "-")}.json`), JSON.stringify(diagnostics, null, 2));
    expect(diagnostics.pageErrors, "uncaught browser exceptions").toEqual([]);
    const requiredFailures = diagnostics.failedRequests.filter((row) => /\/api\/|socket\.io/i.test(row) && !/ERR_ABORTED/i.test(row));
    expect(requiredFailures, "failed required API or Socket.IO requests").toEqual([]);
    expect(diagnostics.httpErrors, "HTTP errors from required APIs").toEqual([]);
  };
}

export async function loginThroughUi(page, role) {
  const workspaceRole = role === "merchantB" ? "merchant" : role;
  await page.goto(`/login?redirect=/${workspaceRole === "customer" ? "" : workspaceRole}`);
  await page.getByLabel(/Email/i).fill(qaAccounts[role]);
  await page.getByLabel(/Password|Kata Sandi/i).fill(password);
  await page.getByRole("button", { name: /Login|Masuk/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("main").first()).toBeVisible();
}

export async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth, `horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.width + 2);
}

export async function qaScreenshot(page, area, name) {
  const folder = path.join(artifactRoot, area);
  await fs.mkdir(folder, { recursive: true });
  await page.screenshot({ path: path.join(folder, `${name}.png`), fullPage: true });
}

export const test = base.extend({
  qaPage: async ({ page }, provide, testInfo) => {
    const finish = await attachDiagnostics(page, testInfo);
    await provide(page);
    await finish();
  },
});

export { expect };

// Bahasa & tema untuk pengguna login diubah di halaman Pengaturan akun (bukan di header).
export async function setPreferences(page, { language, theme } = {}) {
  const returnTo = page.url();
  const html = page.locator("html");
  if (!new URL(returnTo).pathname.startsWith("/settings")) await page.goto("/settings");
  const rows = page.locator(".account-preference-row");
  const change = async (trigger) => {
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/users/me/preferences") && response.request().method() === "PATCH"),
      trigger.click(),
    ]);
    await expect(page.locator(".preference-transition-overlay")).toHaveCount(0);
  };
  if (language && await html.getAttribute("lang") !== language) {
    await change(rows.getByRole("button", { name: language.toUpperCase(), exact: true }));
    await expect(html).toHaveAttribute("lang", language);
  }
  if (theme && await html.getAttribute("data-theme") !== theme) {
    await change(rows.getByRole("button", { name: theme === "dark" ? /Mode gelap|Dark mode/i : /Mode terang|Light mode/i }));
    await expect(html).toHaveAttribute("data-theme", theme);
  }
  if (!new URL(returnTo).pathname.startsWith("/settings")) await page.goto(returnTo);
}
