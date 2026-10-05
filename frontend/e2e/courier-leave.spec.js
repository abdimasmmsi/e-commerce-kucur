import { expect, loginThroughUi, test } from "./fixtures.js";

// Cuti kurir wajib disetujui Admin: kurir mengajukan, admin menolak (dengan alasan) lalu menyetujui pengajuan berikutnya.
const localInput = (daysAhead, hour) => { const date = new Date(Date.now() + daysAhead * 86400000); date.setHours(hour, 0, 0, 0); const pad = (value) => String(value).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`; };

async function requestLeave(page, daysAhead, reason) {
  await page.goto("/courier/availability");
  await page.getByLabel(/^Mulai$/).fill(localInput(daysAhead, 8));
  await page.getByLabel(/Selesai \(opsional\)/).fill(localInput(daysAhead + 1, 20));
  await page.getByLabel(/^Alasan$/).fill(reason);
  await page.getByRole("button", { name: "Kirim pengajuan" }).click();
  await expect(page.getByText(/Pengajuan terkirim/)).toBeVisible();
}

test("courier leave needs admin approval and the courier sees the result", async ({ qaPage: page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 900 });
  await loginThroughUi(page, "courier");
  await requestLeave(page, 20, "Acara keluarga QA");
  await expect(page.getByText("Menunggu Admin").first()).toBeVisible();
  await requestLeave(page, 30, "Kontrol kesehatan QA");

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const admin = await adminContext.newPage();
  await loginThroughUi(admin, "admin");
  await admin.goto("/admin/couriers");
  const leaveSection = admin.locator("section", { has: admin.getByRole("heading", { name: "Pengajuan cuti" }) });
  await expect(leaveSection.getByText("Acara keluarga QA")).toBeVisible();
  const rejectItem = leaveSection.locator("li", { hasText: "Kontrol kesehatan QA" });
  await rejectItem.getByRole("button", { name: "Tolak" }).click();
  const dialog = admin.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Tolak" })).toBeDisabled();
  await dialog.getByLabel("Alasan penolakan").fill("Kurir lain juga cuti di tanggal itu");
  await dialog.getByRole("button", { name: "Tolak" }).click();
  await leaveSection.locator("li", { hasText: "Acara keluarga QA" }).getByRole("button", { name: "Setujui" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Setujui" }).click();
  await expect(leaveSection.getByText("Tidak ada pengajuan cuti yang menunggu.")).toBeVisible();
  await expect(admin.locator(".header-chat-shortcut")).toBeVisible();
  await adminContext.close();

  await page.goto("/courier/availability");
  await expect(page.locator("li", { hasText: "Acara keluarga QA" }).getByText("Disetujui")).toBeVisible();
  const rejected = page.locator("li", { hasText: "Kontrol kesehatan QA" });
  await expect(rejected.getByText("Ditolak", { exact: true })).toBeVisible();
  await expect(rejected.getByText(/Kurir lain juga cuti/)).toBeVisible();
});
