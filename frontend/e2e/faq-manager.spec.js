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
