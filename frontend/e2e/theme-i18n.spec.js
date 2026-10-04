import { assertNoHorizontalOverflow, expect, loginThroughUi, qaScreenshot, setPreferences, test } from "./fixtures.js";

const roles = {
  customer: "/notifications",
  merchant: "/merchant/orders",
  courier: "/courier/batches",
  admin: "/admin/products",
};

for (const [role, route] of Object.entries(roles)) {
  test(`${role} authenticated ID/EN and Light/Dark matrix`, async ({ qaPage: page }) => {
    await page.setViewportSize({ width: role === "courier" ? 360 : role === "merchant" ? 430 : 390, height: role === "courier" ? 800 : role === "merchant" ? 932 : 844 });
    await loginThroughUi(page, role);
    for (const [language, theme] of [["id", "light"], ["id", "dark"], ["en", "light"], ["en", "dark"]]) {
      await page.goto("/settings");
      await setPreferences(page, { language, theme });
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await page.getByText("Memuat halaman...", { exact: true }).waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      await expect(page.locator("main").first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await qaScreenshot(page, `final/${role}/${language}-${theme}`, `${role}-${route.split("/").filter(Boolean).at(-1) || "home"}`);
    }

    // Do not leave the shared QA account in the last matrix combination.
    // EN + light is the product default for a new/clean Kucur session.
    await page.goto("/settings");
    await setPreferences(page, { language: "en", theme: "light" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
}
