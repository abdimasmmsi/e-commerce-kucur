import { assertNoHorizontalOverflow, expect, loginThroughUi, setPreferences, test } from "./fixtures.js";

test.use({ viewport: { width: 360, height: 740 } });

test("visitor opens About from the login footer and sees developer, supervisor and links", async ({ qaPage: page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Tentang", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tentang Kucur Local Market" })).toBeVisible();
  await expect(page.getByText("Steven Danendra").first()).toBeVisible();
  await expect(page.getByText("Meme Susilowati, S.Kom, MMSI")).toBeVisible();
  // Email pengembang hanya teks biasa, tanpa tautan atau tombol pintasan.
  await expect(page.getByText("stevendanendra16@gmail.com")).toBeVisible();
  await expect(page.locator("a[href^='mailto:']")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  // Halaman ini memakai header publik, bukan layout panel kerja.
  await expect(page.locator(".workspace-shell, .workspace-sidebar")).toHaveCount(0);

  await page.getByRole("button", { name: "Bantuan (FAQ)" }).click();
  await expect(page.getByRole("dialog", { name: "Bantuan Kucur" })).toBeVisible();
  await page.getByRole("button", { name: "Tutup" }).first().click().catch(() => {});

  await page.goto("/about");
  await page.getByRole("link", { name: "Kebijakan Privasi" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("register footer links to About", async ({ qaPage: page }) => {
  await page.goto("/register");
  await page.getByRole("link", { name: "Tentang", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test("customer finds About in the Account menu and the page follows English", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await setPreferences(page, { language: "id" });
  await page.goto("/profile");
  await page.getByRole("link", { name: /^Tentang/ }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByText("Steven Danendra").first()).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await setPreferences(page, { language: "en" });
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "About Kucur Local Market" })).toBeVisible();
  await expect(page.getByText("Supervisor and partners")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  await setPreferences(page, { language: "id" });
});
