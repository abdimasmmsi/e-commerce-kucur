import { expect, test } from "./fixtures.js";

test.use({ viewport: { width: 390, height: 844 } });

test("registering with an existing email offers a shortcut to log in", async ({ qaPage: page }) => {
  await page.goto("/register");
  await page.locator("input[name=email]").fill("customer@kucur.test");
  await page.locator("input[name=phone]").click();
  const notice = page.getByRole("alert").filter({ hasText: "Email ini sudah terdaftar" });
  await expect(notice).toBeVisible();
  await notice.getByRole("link", { name: /Masuk dengan email ini/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel(/Email/i)).toHaveValue("customer@kucur.test");
  // Kolom cari dan tombol Masuk di header tidak ditampilkan di halaman Masuk/Daftar.
  await expect(page.locator(".customer-mobile-search")).toHaveCount(0);
});
