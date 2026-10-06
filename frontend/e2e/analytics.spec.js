import { expect, loginThroughUi, test } from "./fixtures.js";

// Admin menyusun laporan sendiri dari laporan bawaan, menyimpannya, lalu mengekspor PDF dan Excel.
test("admin customises an analytics report and exports PDF and Excel", async ({ qaPage: page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginThroughUi(page, "admin");
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Ringkasan Penjualan" })).toBeVisible();
  await expect(page.getByText("Pendapatan produk").first()).toBeVisible();

  await page.getByRole("button", { name: "Ubah laporan" }).click();
  await page.getByLabel("Nama laporan").fill("Laporan uji e2e");
  await page.getByRole("button", { name: "+ Tabel" }).click();
  await page.getByRole("textbox", { name: "Judul" }).fill("Produk terlaris e2e");
  const settingsPanel = page.getByRole("region", { name: "Atur widget" });
  await settingsPanel.getByRole("combobox").nth(0).selectOption("itemsSold");
  await settingsPanel.getByRole("combobox").nth(1).selectOption("product");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Laporan tersimpan.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Laporan uji e2e" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Produk terlaris e2e" })).toBeVisible();

  await page.getByRole("button", { name: "Ekspor" }).click();
  let download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Unduh PDF" }).click();
  expect((await download).suggestedFilename()).toBe("kucur-laporan-uji-e2e.pdf");
  await page.getByRole("button", { name: "Ekspor" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Excel \(\.xlsx\)/ }).click();
  download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Unduh Excel" }).click();
  expect((await download).suggestedFilename()).toBe("kucur-laporan-uji-e2e.xlsx");
});
