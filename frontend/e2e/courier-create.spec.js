import { expect, loginThroughUi, test } from "./fixtures.js";

test.use({ viewport: { width: 390, height: 844 } });

// Admin membuat akun kurir; kurir baru masuk dengan kata sandi awal standar dan langsung diminta menggantinya.
test("admin creates a courier account that must change its initial password", async ({ qaPage: page, browser }) => {
  test.setTimeout(90_000);
  const email = `kurir.e2e.${Date.now()}@kucur.test`;
  await loginThroughUi(page, "admin");
  await page.goto("/admin/couriers");
  await page.getByRole("button", { name: "+ Tambah kurir" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nama lengkap").fill("Kurir Uji Coba");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Nomor WhatsApp").fill("081234567890");
  await form.getByRole("button", { name: "Buat akun" }).click();
  const done = page.getByRole("dialog", { name: "Akun kurir dibuat" });
  await expect(done.getByText(email)).toBeVisible();
  await expect(done.getByText("KurirKucur123!")).toBeVisible();
  await done.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("heading", { name: "Kurir Uji Coba" })).toBeVisible();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const courier = await context.newPage();
  await courier.goto("/login");
  await courier.getByLabel(/Email/i).fill(email);
  await courier.getByLabel(/Password|Kata Sandi/i).fill("KurirKucur123!");
  await courier.getByRole("button", { name: /^(Login|Masuk)$/i }).click();
  await expect(courier.getByRole("alertdialog")).toBeVisible();
  await context.close();
});
