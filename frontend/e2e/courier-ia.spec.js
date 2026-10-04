import { assertNoHorizontalOverflow, expect, loginThroughUi, test } from "./fixtures.js";

const routes = ["/courier", "/courier/active-deliveries", "/courier/assignments", "/courier/batches", "/courier/history", "/courier/availability"];

test("courier information architecture routes always reach a terminal UI state", async ({ qaPage: page }) => {
  test.setTimeout(120_000);
  await loginThroughUi(page, "courier");
  for (const width of [360, 390, 430, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 960 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator(".page-container").first()).toBeVisible();
      await expect(page.getByText(/Memuat halaman|Loading page/i)).toHaveCount(0, { timeout: 20_000 });
      await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 20_000 });
      await assertNoHorizontalOverflow(page);
    }
  }
  await page.goto("/courier/batches");
  const firstBatch = page.getByRole("link", { name: /Lihat Batch|View Batch/i }).first();
  if (await firstBatch.count()) {
    await firstBatch.click();
    await expect(page).toHaveURL(/\/courier\/batches\/.+/);
    await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator(".page-container").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("courier delivery classification separates active upcoming and terminal work", async ({ qaPage: page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { classifyCourierDeliveries } = await import("/src/pages/courier/courierDeliveryModel.js");
    const now = Date.now();
    const order = (id, status) => ({ id, commerceOrderId: id, status, commerceOrder: { id, orderCode: id } });
    const batches = [
      { id: "current", dispatchAt: new Date(now - 60000).toISOString(), status: "IN_PROGRESS", orders: [order("active", "WAITING_PICKUP")] },
      { id: "future", dispatchAt: new Date(now + 86400000).toISOString(), status: "PLANNED", orders: [order("upcoming", "WAITING_PICKUP")] },
      { id: "done", dispatchAt: new Date(now - 86400000).toISOString(), status: "COMPLETED", orders: [order("history", "DELIVERED")] },
    ];
    const classified = classifyCourierDeliveries(batches, now);
    return { active: classified.active.map((item) => item.id), upcoming: classified.upcomingBatches.map((item) => item.id), history: classified.history.map((item) => item.id) };
  });
  expect(result).toEqual({ active: ["active"], upcoming: ["future"], history: ["history"] });
});
