import { expect, loginThroughUi, test } from "./fixtures.js";

test("Admin rejection requires reason and persists dedicated fixture history", async ({ page }) => {
  await loginThroughUi(page, "admin");
  await page.goto("/admin/merchant-approval/12000000-0000-4000-8000-000000000001");
  await expect(page.locator(".page-container h1", { hasText: "E2E Approval Store" })).toBeVisible();
  await expect(page.getByText(/^(Menunggu Persetujuan|Menunggu review|Pending|Pending review)$/i).first()).toBeVisible();
  await page.getByRole("button", { name: /Tolak Pengajuan|Reject Application/i }).click();
  await page.getByRole("button", { name: /Konfirmasi Penolakan|Confirm Rejection/i }).click();
  await expect(page.getByRole("alert")).toContainText(/wajib diisi|required/i);
  const reason = `Ditolak oleh browser E2E ${Date.now()}`;
  await page.getByLabel(/Alasan Penolakan|Rejection reason/i).fill(reason);
  await page.getByRole("button", { name: /Konfirmasi Penolakan|Confirm Rejection/i }).click();
  await expect(page.getByText(/^(Ditolak|Rejected)$/i).first()).toBeVisible();
  await page.reload();
  await expect(page.locator(".merchant-business-info").filter({ hasText: /Alasan Penolakan|Rejection reason/i }).getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByText(/^(Ditolak|Rejected)$/i).first()).toBeVisible();
  await expect(page.getByText(/Pengajuan.*selesai|application.*reviewed/i)).toBeVisible();
});
