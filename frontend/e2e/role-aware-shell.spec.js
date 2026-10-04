import { assertNoHorizontalOverflow, expect, loginThroughUi, qaScreenshot, test } from "./fixtures.js";

const sharedAccountRoutes = ["/profile", "/settings", "/messages"];
const storeId = "10000000-0000-4000-8000-000000000001";
const merchantRoutes = [
  "/merchant",
  "/merchant/stores",
  `/merchant/stores/${storeId}/products`,
  `/merchant/stores/${storeId}/orders`,
  "/merchant/pickup",
  `/merchant/stores/${storeId}/stock`,
  "/merchant/reviews",
  `/merchant/stores/${storeId}/finance`,
  "/merchant/finance",
  ...sharedAccountRoutes,
];

for (const [role, label, home] of [
  ["courier", /Courier|Kurir/i, "/courier"],
  ["admin", /Admin/i, "/admin"],
]) {
  test(`${role} account routes preserve the active workspace shell`, async ({ qaPage: page }) => {
    await loginThroughUi(page, role);
    await expect(page.locator(".app-brand")).toContainText("Kucur Local Market");
    await expect(page.locator(".app-workspace-context")).toContainText(label);
    await expect(page.locator(".app-header .app-nav-links")).toHaveCount(0);
    await expect(page.locator(`.${role}-sidebar .layout-session-controls`)).toHaveCount(0);

    for (const route of sharedAccountRoutes) {
      await page.goto(route);
      await expect(page.locator(".app-workspace-context")).toContainText(label);
      await expect(page.locator(".app-header .app-nav-links")).toHaveCount(0);
      await page.getByRole("button", { name: /Account|Akun/i }).click();
      await expect(page.locator(".profile-workspace-summary .active")).toContainText(label);
      await page.keyboard.press("Escape");
    }

    await page.locator(".app-brand").click();
    await expect(page).toHaveURL(new RegExp(`${home.replace("/", "\\/")}$`));
  });
}

for (const [role, routes] of [
  ["courier", ["/courier", "/courier/active-deliveries", "/courier/assignments", "/courier/batches", "/courier/history", "/courier/availability"]],
  ["admin", ["/admin", "/admin/merchant-approval", "/admin/users", "/admin/couriers", "/admin/transactions", "/admin/products", "/admin/delivery-batches", "/admin/reviews", "/admin/finance", "/admin/settings", "/admin/support-chats", "/admin/notifications"]],
]) {
  test(`${role} workspace uses the shared content grid at every supported viewport`, async ({ qaPage: page }) => {
    test.setTimeout(180_000);
    await loginThroughUi(page, role);
    for (const width of [360, 390, 430, 768, 1024, 1366, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 960 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.locator(".page-container").first()).toBeVisible();
        await assertNoHorizontalOverflow(page);
      }
    }
  });
}

test("merchant account routes preserve the active workspace shell and allow switching back", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  await expect(page).toHaveURL(/\/merchant/);
  await expect(page.locator(".app-brand")).toContainText("Kucur Local Market");
  await expect(page.locator(".app-workspace-context")).toContainText(/Merchant|Workspace Merchant/i);
  await expect(page.locator(".app-header .app-nav-links")).toHaveCount(0);

  for (const route of sharedAccountRoutes) {
    await page.goto(route);
    await expect(page.locator(".app-workspace-context")).toContainText(/Merchant|Workspace Merchant/i);
    await expect(page.locator(".app-header .app-nav-links")).toHaveCount(0);
  }

  await page.getByRole("button", { name: /Account|Akun/i }).click();
  const workspaceSummary = page.locator(".profile-workspace-summary");
  await expect(workspaceSummary).toContainText(/Merchant/);
  await expect(workspaceSummary).toContainText(/Customer|Pelanggan/);
  await expect(workspaceSummary.getByRole("button", { name: /Merchant/i })).toHaveAttribute("aria-pressed", "true");
  await workspaceSummary.getByRole("button", { name: /Customer|Pelanggan/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(workspaceSummary).toHaveCount(0);
  await expect(page.locator(".app-nav-links")).toContainText(/Home|Beranda/);

  await page.getByRole("button", { name: /Account|Akun/i }).click();
  await expect(page.locator(".profile-workspace-summary").getByRole("button", { name: /Customer|Pelanggan/i })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".profile-workspace-summary").getByRole("button", { name: /Merchant/i }).click();
  await expect(page).toHaveURL(/\/merchant$/);
  await expect(page.locator(".profile-workspace-summary")).toHaveCount(0);
  await expect(page.locator(".app-workspace-context")).toContainText(/Merchant|Workspace Merchant/i);
});

test("customer storefront always reconciles a stale merchant workspace role", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  await expect(page).toHaveURL(/\/merchant/);

  await page.goto("/");
  await expect(page.locator(".app-nav-links")).toContainText(/Home|Beranda/);
  await expect(page.locator(".profile-trigger-copy small")).toHaveText(/Customer|Pelanggan/i);

  await page.getByRole("button", { name: /Account|Akun/i }).click();
  await expect(page.locator(".profile-workspace-summary").getByRole("button", { name: /Customer|Pelanggan/i })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator(".profile-trigger-copy small")).toHaveText(/Customer|Pelanggan/i);
});

test("store finance can select and clear every unpaid charge in the filtered result", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  await page.goto(`/merchant/stores/${storeId}/finance`);

  const selectAll = page.getByRole("checkbox", { name: /Select all unpaid charges|Pilih semua tagihan belum dibayar/i });
  const obligationCheckboxes = page.locator(".finance-obligation input[type=checkbox]:not(:disabled)");
  await expect(selectAll).toBeVisible();
  await expect(obligationCheckboxes.first()).toBeVisible();

  await selectAll.check();
  await expect(selectAll).toBeChecked();
  const selectedCount = await obligationCheckboxes.count();
  for (let index = 0; index < selectedCount; index += 1) await expect(obligationCheckboxes.nth(index)).toBeChecked();

  await selectAll.uncheck();
  for (let index = 0; index < selectedCount; index += 1) await expect(obligationCheckboxes.nth(index)).not.toBeChecked();
});

test("merchant product card shows edit and status as two direct actions", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await loginThroughUi(page, "merchant");
  await page.goto(`/merchant/stores/${storeId}/products`);
  const card = page.locator(".merchant-product-card").first();
  await expect(card).toBeVisible();
  await expect(card.locator(".merchant-product-edit")).toHaveAttribute("href", /\/edit$/);
  await assertNoHorizontalOverflow(page);

  const statusAction = card.locator(".merchant-product-status-action");
  const [editBox, statusBox] = await Promise.all([card.locator(".merchant-product-edit").boundingBox(), statusAction.boundingBox()]);
  expect(Math.abs(editBox.y - statusBox.y)).toBeLessThan(4);
  expect(Math.abs(editBox.width - statusBox.width)).toBeLessThan(4);
  await expect(card.locator(".product-actions-menu-button")).toHaveCount(0);
  await qaScreenshot(page, "merchant-product-refinement", "product-actions-360");

  const wasActive = /Nonaktifkan|Deactivate/i.test(await statusAction.textContent());
  await statusAction.click();
  await expect(statusAction).toHaveText(wasActive ? /Aktifkan|Activate/i : /Nonaktifkan|Deactivate/i);
  await statusAction.click();

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/merchant/stores/${storeId}/products`);
  await expect(page.locator(".merchant-product-card").first()).toBeVisible();
  await page.getByRole("button", { name: /Account|Akun/i }).click();
  await qaScreenshot(page, "merchant-product-refinement", "product-cards-role-chips-1440");
});

test("a single-role account shows a non-interactive current-role badge", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await page.getByRole("button", { name: /Account|Akun/i }).click();
  const workspaceSummary = page.locator(".profile-workspace-summary");
  await expect(workspaceSummary).toBeVisible();
  await expect(workspaceSummary.locator("button[aria-pressed]")).toHaveCount(0);
  await expect(workspaceSummary.locator("span.active")).toContainText(/Customer|Pelanggan/i);
});

test("role-aware account header remains usable at supported compact widths", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(page.getByRole("button", { name: /Account|Akun/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("merchant workspace remains responsive at every supported viewport", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  const representativeRoutes = [
    "/merchant",
    "/merchant/stores",
    `/merchant/stores/${storeId}/orders`,
  ];

  for (const width of [360, 390, 430, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 960 });
    for (const route of representativeRoutes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 10_000 });
      await assertNoHorizontalOverflow(page);
      if ([390, 1440].includes(width)) {
        await qaScreenshot(page, "merchant-refinement", `${width}-${route.split("/").filter(Boolean).at(-1) ?? "dashboard"}`);
      }
    }
  }
});

test("all refined merchant and shared-account routes retain the merchant shell", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await loginThroughUi(page, "merchant");

  for (const route of merchantRoutes) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator(".app-brand")).toContainText("Kucur Local Market");
    await expect(page.locator(".app-workspace-context")).toContainText(/Merchant|Workspace Merchant/i);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  }
});
