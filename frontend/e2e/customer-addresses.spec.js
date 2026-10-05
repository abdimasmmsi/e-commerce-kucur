import { assertNoHorizontalOverflow, expect, loginThroughUi, setPreferences, test } from "./fixtures.js";

test.use({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -7.9562, longitude: 112.5447 }, permissions: ["geolocation"] });

async function removeAllAddresses(page) {
  const removeButton = page.getByRole("button", { name: "Hapus", exact: true });
  while (await removeButton.count()) {
    await removeButton.first().click();
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/users/me/addresses") && response.ok()),
      page.getByRole("button", { name: "Ya, hapus" }).click(),
    ]);
  }
}

async function addAddress(page, label, address) {
  await page.getByRole("button", { name: "+ Tambah alamat" }).click();
  await page.getByLabel("Label alamat (mis. Rumah, Kantor)").fill(label);
  await page.getByLabel("Alamat lengkap dan patokan").fill(address);
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).click();
  await expect(page.getByText(/Koordinat:/)).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/users/me/addresses") && response.ok()),
    page.getByRole("button", { name: "Simpan alamat" }).click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Alamat tersimpan." })).toBeVisible();
}

test("customer manages saved addresses and checkout uses the main one", async ({ qaPage: page }) => {
  await loginThroughUi(page, "customer");
  await setPreferences(page, { language: "id" });
  await page.goto("/addresses");
  await expect(page.getByRole("heading", { name: "Alamat Saya" })).toBeVisible();
  await removeAllAddresses(page);

  await addAddress(page, "Rumah QA", "Dusun Krajan RT 01, dekat masjid");
  const home = page.locator("article").filter({ hasText: "Rumah QA" });
  await expect(home.getByText("Utama", { exact: true })).toBeVisible();

  await addAddress(page, "Kantor QA", "Balai Desa Kucur");
  const office = page.locator("article").filter({ hasText: "Kantor QA" });
  await expect(office.getByText("Utama", { exact: true })).toHaveCount(0);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/users/me/addresses") && response.ok()),
    office.getByRole("button", { name: "Jadikan utama" }).click(),
  ]);
  await expect(office.getByText("Utama", { exact: true })).toBeVisible();
  await expect(home.getByText("Utama", { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await page.goto("/checkout?productId=20000000-0000-4000-8000-000000000003&quantity=1");
  await expect(page.getByRole("radio", { name: /Kantor QA/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Lokasi saya sekarang/ })).toBeVisible();
  await page.getByRole("radio", { name: /Lokasi saya sekarang/ }).check();
  await expect(page.getByRole("textbox", { name: /Alamat/ })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  // Tambah alamat dari checkout: form langsung terbuka, lalu otomatis kembali ke checkout dengan alamat baru terpilih.
  await page.getByRole("link", { name: "+ Tambah alamat" }).click();
  await expect(page).toHaveURL(/\/addresses$/);
  await expect(page.getByRole("heading", { name: "Alamat baru" })).toBeVisible();
  await page.getByLabel("Label alamat (mis. Rumah, Kantor)").fill("Kebun QA");
  await page.getByLabel("Alamat lengkap dan patokan").fill("Kebun kopi Kucur");
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).click();
  await expect(page.getByText(/Koordinat:/)).toBeVisible();
  await page.getByRole("button", { name: "Simpan alamat" }).click();
  await expect(page).toHaveURL(/\/checkout\?productId=/);
  await expect(page.getByRole("radio", { name: /Kebun QA/ })).toBeChecked();

  await page.goto("/addresses");
  await expect(page.locator("article").filter({ hasText: "Kantor QA" })).toBeVisible();
  await removeAllAddresses(page);
  await expect(page.getByText("Belum ada alamat")).toBeVisible();
});
