import { expect, loginThroughUi, test } from "./fixtures.js";

test("Customer notification read state, navigation, and mark-all persist", async ({ page }) => {
  await loginThroughUi(page, "customer");
  await page.goto("/notifications");
  const unread = page.locator("article.unified-notification-card.unread");
  await expect(unread.first()).toBeVisible();
  const first = unread.first();
  const firstTitle = await first.getByRole("heading").textContent();
  await first.getByRole("button", { name: /Tandai Dibaca|Mark as Read/i }).click();
  await expect(first).toHaveClass(/read/);
  await page.reload();
  await expect(page.locator("article.unified-notification-card.unread").filter({ hasText: firstTitle })).toHaveCount(0);

  const navigable = page.locator("article.unified-notification-card").filter({ has: page.getByRole("link", { name: /Buka Detail|Open Details/i }) }).first();
  await expect(navigable).toBeVisible();
  const target = await navigable.getByRole("link", { name: /Buka Detail|Open Details/i }).getAttribute("href");
  await navigable.getByRole("link", { name: /Buka Detail|Open Details/i }).click();
  await expect(page).toHaveURL(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  await page.goto("/notifications");
  const markAll = page.getByRole("button", { name: /Tandai Semua Dibaca|Mark All as Read/i });
  if (await markAll.isEnabled()) await markAll.click();
  await page.reload();
  await expect(page.locator("article.unified-notification-card.unread")).toHaveCount(0);
});
