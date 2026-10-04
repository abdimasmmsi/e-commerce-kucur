import { assertNoHorizontalOverflow, expect, loginThroughUi, qaScreenshot, test } from "./fixtures.js";

const viewports = [
  ["360", 360, 800],
  ["390", 390, 844],
  ["430", 430, 932],
  ["768", 768, 1024],
  ["1024", 1024, 768],
  ["1366", 1366, 768],
  ["1440", 1440, 900],
];

async function setLanguage(page, language) {
  if (await page.locator("html").getAttribute("lang") === language) return;
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/users/me/preferences") && response.request().method() === "PATCH"),
    page.getByRole("button", { name: language.toUpperCase(), exact: true }).click(),
  ]);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}

async function setTheme(page, theme) {
  if (await page.locator("html").getAttribute("data-theme") === theme) return;
  const buttonName = theme === "dark" ? /Dark mode|Mode gelap/i : /Light mode|Mode terang/i;
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/users/me/preferences") && response.request().method() === "PATCH"),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

test("customer order history remains responsive and functional", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await setLanguage(page, "id");
  await setTheme(page, "light");

  for (const [label, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Saya" })).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.locator('section[aria-live="polite"] article').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await qaScreenshot(page, "customer/orders", `orders-${label}-id-light`);
  }

  await page.getByLabel("Status").selectOption("completed");
  const completedCards = page.locator('section[aria-live="polite"] article');
  await expect(completedCards.first()).toContainText("Selesai");
  for (let index = 0; index < await completedCards.count(); index += 1) await expect(completedCards.nth(index)).toContainText("Selesai");

  await page.getByLabel("Status").selectOption("all");
  const detailLink = page.locator('a[href^="/orders/"]').first();
  const href = await detailLink.getAttribute("href");
  await detailLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));

  await page.goto("/orders");
  await setLanguage(page, "en");
  await expect(page.getByRole("heading", { level: 1, name: "My Orders" })).toBeVisible();
  await setTheme(page, "dark");
  await assertNoHorizontalOverflow(page);
  await qaScreenshot(page, "customer/orders", "orders-1440-en-dark");
});
