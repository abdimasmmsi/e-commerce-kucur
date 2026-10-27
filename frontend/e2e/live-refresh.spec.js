import { expect, loginThroughUi, test } from "./fixtures.js";

// Tampilan realtime: halaman yang sedang terbuka di perangkat lain ikut segar tanpa refresh manual.
const localInput = (daysAhead, hour) => { const date = new Date(Date.now() + daysAhead * 86400000); date.setHours(hour, 0, 0, 0); const pad = (value) => String(value).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`; };

test("admin sees a courier leave request, and the courier sees the decision, without reloading", async ({ qaPage: courier, browser }) => {
  test.setTimeout(120_000);
  const reason = `Realtime QA ${Date.now()}`;
  const daysAhead = 120 + Math.floor(Math.random() * 200);

  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminContext.newPage();
  await loginThroughUi(admin, "admin");
  await admin.goto("/admin/couriers");
  const leaveSection = admin.locator("section", { has: admin.getByRole("heading", { name: "Pengajuan cuti" }) });
  await expect(leaveSection).toBeVisible();

  await courier.setViewportSize({ width: 390, height: 900 });
  await loginThroughUi(courier, "courier");
  await courier.goto("/courier/availability");
  await courier.getByLabel(/^Mulai$/).fill(localInput(daysAhead, 8));
  await courier.getByLabel(/Selesai \(opsional\)/).fill(localInput(daysAhead + 1, 20));
  await courier.getByLabel(/^Alasan$/).fill(reason);
  await courier.getByRole("button", { name: "Kirim pengajuan" }).click();
  await expect(courier.getByText(/Pengajuan terkirim/)).toBeVisible();

  // Admin tidak memuat ulang halaman: pengajuan muncul sendiri lewat sinyal realtime.
  await expect(leaveSection.getByText(reason)).toBeVisible({ timeout: 15_000 });
  await leaveSection.locator("li", { hasText: reason }).getByRole("button", { name: "Setujui" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Setujui" }).click();

  // Kurir juga tidak memuat ulang: status berubah sendiri.
  await expect(courier.locator("li", { hasText: reason }).getByText("Disetujui")).toBeVisible({ timeout: 15_000 });
  await adminContext.close();
});

test("the admin draft panel does not offer delivery dates before today", async ({ qaPage: admin }) => {
  await loginThroughUi(admin, "admin");
  await admin.goto("/admin/delivery-batches");
  const dateInput = admin.locator('input[type="date"]').first();
  await expect(dateInput).toHaveAttribute("min", /^\d{4}-\d{2}-\d{2}$/);
});
