import { assertNoHorizontalOverflow, expect, loginThroughUi, test, setPreferences } from "./fixtures.js";

const viewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1366, 768], [1440, 900],
];
const routes = ["/products", "/profile", "/settings", "/messages", "/merchant/apply"];

test("customer refinement routes are responsive and stable", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginThroughUi(page, "customer");
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Unexpected Application Error|Application error/i);
      await assertNoHorizontalOverflow(page);
    }
  }
});

test("customer account pages support ID EN light and dark", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await loginThroughUi(page, "customer");
  await page.goto("/settings");
  await setPreferences(page, { language: "en" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await setPreferences(page, { theme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await setPreferences(page, { language: "id" });
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
