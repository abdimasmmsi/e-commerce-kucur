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

for (const [label, width, height] of viewports) {
  test(`public catalog is usable at ${label}`, async ({ qaPage: page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await qaScreenshot(page, "customer", `products-${label}-id-light`);
  });
}

test("language and theme controls persist through refresh", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await qaScreenshot(page, "en-light", "customer-home-390-en-light");
  await page.getByRole("button", { name: "ID" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await qaScreenshot(page, "id-light", "customer-home-390-id-light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await page.getByRole("button", { name: /Mode gelap/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await qaScreenshot(page, "id-dark", "customer-home-390-id-dark");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await qaScreenshot(page, "en-dark", "customer-home-390-en-dark");
  await page.getByRole("button", { name: /Light mode/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

const roleRoutes = {
  customer: ["/", "/products", "/cart", "/orders", "/notifications", "/profile"],
  merchant: ["/merchant", "/merchant/stores", "/merchant/orders", "/merchant/reviews", "/merchant/finance", "/merchant/notifications"],
  courier: ["/courier", "/courier/availability", "/courier/batches", "/courier/active-deliveries", "/courier/history", "/courier/notifications"],
  admin: ["/admin", "/admin/merchant-approval", "/admin/products", "/admin/transactions", "/admin/delivery-batches", "/admin/reviews", "/admin/finance", "/admin/notifications", "/admin/settings"],
};

for (const [role, routes] of Object.entries(roleRoutes)) {
  test(`${role} isolated authenticated route traversal`, async ({ qaPage: page }) => {
    await page.setViewportSize({ width: role === "courier" ? 360 : 390, height: role === "courier" ? 800 : 844 });
    await loginThroughUi(page, role);
    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await page.getByText("Memuat halaman...", { exact: true }).waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      await expect(page.locator("body")).not.toContainText(/Application error|Unexpected Application Error/i);
      await assertNoHorizontalOverflow(page);
    }
    await qaScreenshot(page, role, `${role}-mobile-id-light`);
  });
}

test("customer and merchant use independent simultaneous sessions", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const merchantContext = await browser.newContext();
  const customer = await customerContext.newPage();
  const merchant = await merchantContext.newPage();
  await Promise.all([loginThroughUi(customer, "customer"), loginThroughUi(merchant, "merchant")]);
  await Promise.all([customer.goto("/messages"), merchant.goto("/messages")]);
  await expect(customer).toHaveURL(/\/messages/);
  await expect(merchant).toHaveURL(/\/messages/);
  const [customerToken, merchantToken] = await Promise.all([
    customer.evaluate(() => localStorage.getItem("kucur_auth_token")),
    merchant.evaluate(() => localStorage.getItem("kucur_auth_token")),
  ]);
  expect(customerToken).toBeTruthy();
  expect(merchantToken).toBeTruthy();
  expect(customerToken).not.toBe(merchantToken);
  await customerContext.close();
  await merchantContext.close();
});

test("merchant workspace navigation is owned by the sidebar", async ({ qaPage: page }) => {
  const storeId = "10000000-0000-4000-8000-000000000001";
  const storeOrdersPath = `/merchant/stores/${storeId}/orders`;
  await loginThroughUi(page, "merchant");
  await page.goto(storeOrdersPath);

  await expect(page.locator(".app-header .app-nav-links")).toHaveCount(0);
  await expect(page.locator(`.merchant-sidebar a[href="${storeOrdersPath}"]`)).toHaveClass(/active/);
  await expect(page.getByRole("heading", { level: 1, name: /Orders|Pesanan/ })).toBeVisible();
});
