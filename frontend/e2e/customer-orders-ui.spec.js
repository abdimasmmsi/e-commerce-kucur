import { assertNoHorizontalOverflow, expect, loginThroughUi, qaScreenshot, test, setPreferences } from "./fixtures.js";

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
  await setPreferences(page, { language });
}

async function setTheme(page, theme) {
  await setPreferences(page, { theme });
}

test("customer order history remains responsive and functional", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await setLanguage(page, "id");
  await setTheme(page, "light");

  for (const [label, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Saya" })).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.locator('section[aria-live="polite"] article').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await qaScreenshot(page, "customer/orders", `orders-${label}-id-light`);
  }

  await page.getByRole("tab", { name: /^Selesai/ }).click();
  const completedCards = page.locator('section[aria-live="polite"] article');
  await expect(completedCards.first()).toContainText("Selesai");
  for (let index = 0; index < await completedCards.count(); index += 1) await expect(completedCards.nth(index)).toContainText("Selesai");

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
