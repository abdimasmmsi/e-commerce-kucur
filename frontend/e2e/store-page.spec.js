import { assertNoHorizontalOverflow, expect, test } from "./fixtures.js";

const productId = "20000000-0000-4000-8000-000000000003";
const storeId = "10000000-0000-4000-8000-000000000002";

for (const width of [360, 1024]) {
  test(`visitor sees ratings, sold counts and the store page at ${width}px`, async ({ qaPage: page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/products");
    const card = page.locator("article").filter({ hasText: "Madu Kucur QA B" });
    await expect(card.getByText(/\d+ terjual/)).toBeVisible();

    await page.goto(`/products/${productId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Madu Kucur QA B" })).toBeVisible();
    await expect(page.locator("#product-reviews").or(page.getByText(/\d+ terjual/)).first()).toBeVisible();
    await page.getByRole("link", { name: /Kunjungi lapak/ }).click();

    await expect(page).toHaveURL(new RegExp(`/stores/${storeId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Lapak Merchant B" })).toBeVisible();
    await expect(page.getByText("Terjual", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Produk dari lapak ini" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Madu Kucur QA B" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ulasan pembeli" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}

test("public review and store APIs never expose private customer data", async ({ request }) => {
  const api = globalThis.process?.env.E2E_API_URL ?? "http://localhost:3000";
  for (const path of [`/api/stores/${storeId}/reviews`, `/api/products/${productId}/reviews`, `/api/stores/${storeId}/public`]) {
    const response = await request.get(`${api}${path}`);
    expect(response.ok(), path).toBe(true);
    expect(await response.text(), path).not.toMatch(/passwordHash|"email"|deliveryAddress|recipientPhone|"addresses"/);
  }
});

test("unknown store shows a friendly empty state", async ({ page }) => {
  await page.goto("/stores/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByText("Lapak tidak ditemukan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lihat semua produk" })).toBeVisible();
});
