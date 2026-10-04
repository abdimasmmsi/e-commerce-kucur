import { expect, loginThroughUi, test } from "./fixtures.js";

test("Customer notification read state, navigation, and mark-all persist", async ({ page }) => {
  await loginThroughUi(page, "customer");
  await page.goto("/notifications");
  const unread = page.locator("article.unified-notification-card.unread");
  await expect(unread.first()).toBeVisible();

  // Membuka notifikasi lewat kartunya sekaligus menandainya sudah dibaca.
  const navigable = unread.filter({ has: page.getByRole("link") }).first();
  await expect(navigable).toBeVisible();
  const link = navigable.getByRole("link").first();
  const target = await link.getAttribute("href");
  const openedTitle = (await link.textContent()).trim();
  await link.click();
  await expect(page).toHaveURL(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await page.goto("/notifications");
  await expect(page.locator("article.unified-notification-card.unread").filter({ hasText: openedTitle })).toHaveCount(0);

  // Tab Belum dibaca hanya menampilkan yang belum dibaca.
  await page.getByRole("tab", { name: /Belum Dibaca|Unread/i }).click();
  await expect(page.locator("article.unified-notification-card.read")).toHaveCount(0);

  const markAll = page.getByRole("button", { name: /Tandai Semua Dibaca|Mark All as Read/i });
  if (await markAll.isEnabled()) await markAll.click();
  await page.reload();
  await expect(page.locator("article.unified-notification-card.unread")).toHaveCount(0);
});
