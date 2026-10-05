import { expect, loginThroughUi, test } from "./fixtures.js";

// Pengaturan operasional baru: kontak pengelola, jarak antar maksimum, dan skema cicilan yang benar-benar tersimpan.
const saveSettings = async (page) => {
  await page.getByRole("button", { name: /Simpan perubahan|Save changes/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /berhasil disimpan|saved successfully/i })).toBeVisible();
};

test("admin operational settings persist and the manager contact reaches the customer Account page", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginThroughUi(admin, "admin");

  await admin.goto("/admin/settings/system");
  await admin.locator('input[name="adminContactName"]').fill("Pengelola Desa QA");
  await admin.locator('input[name="adminContactPhone"]').fill("0812 3456 7890");
  await saveSettings(admin);

  await admin.goto("/admin/settings/delivery");
  await admin.locator('input[name="maxDeliveryDistanceKm"]').fill("25");
  await saveSettings(admin);
  await admin.reload();
  await expect(admin.locator('input[name="maxDeliveryDistanceKm"]')).toHaveValue("25");

  await admin.goto("/admin/settings/merchant/installments");
  const sixMonths = admin.locator('input[name="installment6MonthsEnabled"]');
  await sixMonths.uncheck();
  await saveSettings(admin);
  await admin.reload();
  await expect(admin.locator('input[name="installment6MonthsEnabled"]')).not.toBeChecked();

  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const customer = await customerContext.newPage();
  await loginThroughUi(customer, "customer");
  await customer.goto("/profile");
  await expect(customer.getByText("0812 3456 7890")).toBeVisible();
  await expect(customer.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890");

  // Kembalikan nilai agar test lain tidak terpengaruh.
  await admin.goto("/admin/settings/merchant/installments");
  await admin.locator('input[name="installment6MonthsEnabled"]').check();
  await saveSettings(admin);
  await admin.goto("/admin/settings/delivery");
  await admin.locator('input[name="maxDeliveryDistanceKm"]').fill("");
  await saveSettings(admin);
  await admin.goto("/admin/settings/system");
  await admin.locator('input[name="adminContactName"]').fill("");
  await admin.locator('input[name="adminContactPhone"]').fill("");
  await saveSettings(admin);

  await Promise.all([adminContext.close(), customerContext.close()]);
});
