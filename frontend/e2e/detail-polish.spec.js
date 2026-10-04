import { assertNoHorizontalOverflow, expect, loginThroughUi, test } from "./fixtures.js";

const widths = [360, 390, 430, 768, 1024, 1366, 1440];
const storeId = "10000000-0000-4000-8000-000000000001";

async function verifyDetailAtSupportedWidths(page, path) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 960 });
    await page.goto(path);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[class*="max-w-[1440px]"]').first()).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Unexpected Application Error|Application error/i);
    await assertNoHorizontalOverflow(page);
  }
}

test("customer order detail uses the shared responsive detail system", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await page.goto("/orders");
  const href = await page.locator('a[href^="/orders/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await verifyDetailAtSupportedWidths(page, href);
  await expect(page.locator("ol[aria-label]").first()).toBeVisible();
});

test("merchant order and product edit details use the shared responsive grid", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  await page.goto(`/merchant/stores/${storeId}/orders`);
  const orderHref = await page.locator(`a[href^="/merchant/stores/${storeId}/orders/"]`).first().getAttribute("href");
  expect(orderHref).toBeTruthy();
  await verifyDetailAtSupportedWidths(page, orderHref);
  await page.goto(`/merchant/stores/${storeId}/products`);
  const productHref = await page.locator(`a[href^="/merchant/stores/${storeId}/products/"][href$="/edit"]`).first().getAttribute("href");
  expect(productHref).toBeTruthy();
  await verifyDetailAtSupportedWidths(page, productHref);
});

test("courier batch detail uses the shared responsive timeline", async ({ qaPage: page }) => {
  await loginThroughUi(page, "courier");
  await page.goto("/courier/batches");
  const href = await page.locator('a[href^="/courier/batches/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await verifyDetailAtSupportedWidths(page, href);
  await expect(page.locator("ol[aria-label]").first()).toBeVisible();
});

test("admin order detail uses the shared responsive detail system", async ({ qaPage: page }) => {
  await loginThroughUi(page, "admin");
  await page.goto("/admin/transactions");
  const href = await page.locator('a[href^="/admin/orders/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await verifyDetailAtSupportedWidths(page, href);
  await expect(page.locator("ol[aria-label]").first()).toBeVisible();
});
