import { assertNoHorizontalOverflow, expect, loginThroughUi, setPreferences, test } from "./fixtures.js";

test.use({ viewport: { width: 390, height: 844 } });

test("visitor asks the FAQ bot in their own words and gets a confirmed answer", async ({ qaPage: page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buka bantuan" }).click();
  const bot = page.getByRole("dialog", { name: "Bantuan Kucur" });
  await expect(bot.getByText("Pertanyaan populer")).toBeVisible();
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("gmn cara beli barang");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/Maksud kamu:/)).toBeVisible();
  await bot.getByRole("button", { name: "Ya", exact: true }).click();
  await expect(bot.getByText("Bayar tunai ke kurir saat barang sampai.", { exact: false })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  // Aplikasi berbahasa Indonesia, tapi pertanyaan berbahasa Inggris → balasan berbahasa Inggris.
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("how much is the delivery fee");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/Do you mean:/)).toBeVisible();
  await bot.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(bot.getByText(/per km/).last()).toContainText("Delivery fee");
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("gimana cara beli");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/Maksud kamu:/).last()).toBeVisible();
  await bot.getByRole("button", { name: "Ya", exact: true }).last().click();
  await bot.getByRole("button", { name: /Lihat produk/ }).last().click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(bot).toHaveCount(0);
});

test("customer typo question, rejecting a guess, and opening the bot from the Account menu", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await setPreferences(page, { language: "id" });
  await page.goto("/");
  await page.getByRole("button", { name: "Buka bantuan" }).click();
  const bot = page.getByRole("dialog", { name: "Bantuan Kucur" });
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("min gmn caranya cancle pesnan");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/Bagaimana cara membatalkan pesanan/).last()).toBeVisible();
  await bot.getByRole("button", { name: "Bukan", exact: true }).click();
  await expect(bot.getByText(/Coba tulis ulang/)).toBeVisible();
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("halo apa kabar");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/belum paham/)).toBeVisible();
  await expect(bot.getByRole("button", { name: "Chat Admin" }).last()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bot).toHaveCount(0);

  // Halaman dengan tombol aksi bawah: tombol bot disembunyikan, tapi bisa dibuka dari Akun.
  await page.goto("/checkout?productId=20000000-0000-4000-8000-000000000003&quantity=1");
  await expect(page.getByRole("button", { name: "Buka bantuan" })).toHaveCount(0);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Bantuan (FAQ)" }).first().click();
  await expect(page.getByRole("dialog", { name: "Bantuan Kucur" }).getByText(/Bagaimana cara membatalkan pesanan/)).toBeVisible();
});
