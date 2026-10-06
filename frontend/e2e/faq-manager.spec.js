import { expect, loginThroughUi, test } from "./fixtures.js";

test.use({ viewport: { width: 390, height: 844 } });

// Admin menambah FAQ baru di menu FAQ Chatbot, lalu pengunjung langsung mendapat jawabannya dari chatbot.
test("admin adds a chatbot FAQ and a visitor gets it from the bot", async ({ qaPage: page, browser }) => {
  test.setTimeout(90_000);
  await loginThroughUi(page, "admin");
  await page.goto("/admin/faq");
  await page.getByRole("button", { name: "+ Tambah FAQ" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Pertanyaan (Indonesia)").fill("Apakah ada wifi di desa?");
  await form.getByLabel("Pertanyaan (Inggris)").fill("Is there wifi in the village?");
  await form.getByLabel("Jawaban (Indonesia)").fill("Ada, gratis di **balai desa**.\nPasswordnya tanya petugas.");
  await form.getByLabel("Jawaban (Inggris)").fill("Yes, free at the **village hall**.\nAsk the staff for the password.");
  await form.getByLabel("Pengunjung").check();
  await form.getByLabel("Kata kunci tambahan").fill("wifi, internet");
  await form.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("FAQ tersimpan")).toBeVisible();
  await page.getByPlaceholder(/Contoh: gimana/).fill("ada wifi gak");
  await expect(page.getByText("Chatbot menjawab:")).toBeVisible();

  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await visitorContext.newPage();
  await visitor.goto("/");
  await visitor.getByRole("button", { name: "Buka bantuan" }).click();
  const bot = visitor.getByRole("dialog", { name: "Bantuan Kucur" });
  await bot.getByPlaceholder(/Tulis pertanyaan/).fill("disini ada internet gak?");
  await bot.getByRole("button", { name: "Kirim" }).click();
  await expect(bot.getByText(/Apakah ada wifi di desa/)).toBeVisible();
  await bot.getByRole("button", { name: "Ya", exact: true }).click();
  await expect(bot.getByText(/balai desa/)).toBeVisible();
  await visitorContext.close();
});

// Ekspor/impor FAQ lewat Excel: file contoh menambah 1 FAQ dan menyembunyikan 1 FAQ bawaan;
// ekspor penuh lalu impor ulang tidak mengubah apa pun.
test("admin exports, imports, and round-trips chatbot FAQs through Excel", async ({ qaPage: page }) => {
  test.setTimeout(90_000);
  await loginThroughUi(page, "admin");
  await page.goto("/admin/faq");
  let download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh contoh" }).click();
  const template = await (await download).path();
  await page.locator('input[type="file"]').setInputFiles(template);
  const dialog = page.getByRole("dialog", { name: "Impor FAQ dari Excel" });
  await expect(dialog.getByText("1 FAQ baru")).toBeVisible();
  await expect(dialog.getByText("1 FAQ disembunyikan")).toBeVisible();
  await dialog.getByRole("button", { name: "Impor & simpan" }).click();
  await expect(page.getByText("FAQ dari Excel tersimpan")).toBeVisible();
  await expect(page.getByText("Apakah ada wifi di desa?").first()).toBeVisible();

  download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh Excel" }).click();
  const full = await (await download).path();
  await page.locator('input[type="file"]').setInputFiles(full);
  await expect(dialog.getByText("1 FAQ baru")).toBeVisible();
  await expect(dialog.getByText("0 FAQ bawaan diubah")).toBeVisible();
  await expect(dialog.getByText("1 FAQ disembunyikan")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Impor & simpan" })).toBeEnabled();
});

// Hapus FAQ masuk Sampah (bisa dipulihkan), hapus permanen dari Sampah.
test("deleted FAQs go to the trash and can be restored or purged", async ({ qaPage: page }) => {
  test.setTimeout(90_000);
  await loginThroughUi(page, "admin");
  await page.goto("/admin/faq");
  const item = page.locator("li", { hasText: "Bagaimana cara memesan produk?" });
  await item.getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByText("FAQ dipindah ke Sampah")).toBeVisible();
  await expect(item).toHaveCount(0);
  await page.getByRole("tab", { name: /Sampah/ }).click();
  await expect(page.getByText(/terhapus permanen dalam 30 hari/)).toBeVisible();
  await item.getByRole("button", { name: "Pulihkan" }).click();
  await expect(page.getByText("FAQ dipulihkan.")).toBeVisible();
  await page.getByRole("tab", { name: "Daftar FAQ" }).click();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Hapus" }).click();
  await page.getByRole("tab", { name: /Sampah/ }).click();
  await item.getByRole("button", { name: "Hapus permanen" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hapus permanen" }).click();
  await expect(page.getByText("FAQ dihapus permanen.")).toBeVisible();
  await page.getByRole("tab", { name: "Daftar FAQ" }).click();
  await expect(item.getByText("Disembunyikan")).toBeVisible();
});
