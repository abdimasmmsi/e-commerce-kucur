import { assertNoHorizontalOverflow, expect, loginThroughUi, qaScreenshot, test, setPreferences } from "./fixtures.js";

const storeId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const variantProductId = "20000000-0000-4000-8000-000000000002";
const editPath = `/merchant/stores/${storeId}/products/${productId}/edit`;

async function openEditProduct(page) {
  await page.goto(editPath);
  await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".merchant-edit-product")).toBeVisible();
}

test("merchant edit product layout is responsive and keeps sticky actions visible", async ({ qaPage: page }) => {
  await loginThroughUi(page, "merchant");
  await openEditProduct(page);

  for (const width of [360, 390, 430, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 900 : 960 });
    await assertNoHorizontalOverflow(page);
    if (width <= 768) {
      await expect(page.locator(".merchant-sidebar")).not.toHaveClass(/\bopen\b/);
      await expect.poll(() => page.locator(".merchant-sidebar").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    }
    await expect(page.locator(".merchant-edit-product__actions")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save Changes|Simpan Perubahan/i })).toBeVisible();
    if (width >= 768) {
      const [workspaceBox, pageBox] = await Promise.all([
        page.locator(".store-workspace-header").boundingBox(),
        page.locator(".merchant-edit-product").boundingBox(),
      ]);
      expect(Math.abs(workspaceBox.x - pageBox.x)).toBeLessThan(2);
      expect(Math.abs(workspaceBox.width - pageBox.width)).toBeLessThan(2);
    }
    if ([390, 1440].includes(width)) {
      await qaScreenshot(page, "merchant-product-refinement", `edit-product-${width}`);
    }
  }
});

test("merchant edit product controls preserve validation, images, variants, status, and submit payload", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await loginThroughUi(page, "merchant");
  await openEditProduct(page);

  const nameInput = page.getByLabel(/Product Name|Nama Produk/i);
  const originalName = await nameInput.inputValue();
  await nameInput.fill("");
  await page.getByRole("button", { name: /Save Changes|Simpan Perubahan/i }).click();
  await expect(page.locator("#product-name-error")).toBeVisible();
  await nameInput.fill(originalName);

  const imageBuffer = await page.screenshot({ type: "png" });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Choose from Gallery|Pilih dari Galeri/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "merchant-product-qa.png", mimeType: "image/png", buffer: imageBuffer });
  await expect(page.locator(".merchant-edit-product__image-tile")).toHaveCount(1, { timeout: 10_000 });
  await page.locator(".merchant-edit-product__remove-image").click();
  await expect(page.locator(".merchant-edit-product__image-tile")).toHaveCount(0);

  const variantSwitch = page.getByRole("switch", { name: /Product has variants|Produk memiliki varian/i });
  await page.locator(".merchant-edit-product__switch").click();
  await expect(variantSwitch).toBeChecked();
  await expect(page.locator(".merchant-edit-product__variant-editor")).toBeVisible();
  await page.locator(".merchant-edit-product__switch").click();
  await expect(variantSwitch).not.toBeChecked();

  let submittedPayload;
  await page.route(`**/api/products/${productId}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    submittedPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: productId, storeId, ...submittedPayload } }),
    });
  });
  await page.locator(".merchant-edit-product__status-section select[name='status']").selectOption("inactive");
  await page.getByRole("button", { name: /Save Changes|Simpan Perubahan/i }).click();
  await expect(page).toHaveURL(new RegExp(`/merchant/stores/${storeId}/products$`));
  expect(submittedPayload?.name).toBe(originalName);
  expect(submittedPayload?.status).toBe("inactive");
});

test("merchant edit product remains readable in ID/EN and light/dark", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await loginThroughUi(page, "merchant");
  await openEditProduct(page);

  for (const language of ["id", "en"]) {
    for (const theme of ["light", "dark"]) {
      await setPreferences(page, { language, theme });
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".merchant-edit-product__section").first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }

  await setPreferences(page, { language: "en", theme: "light" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("existing product variants load in the refined editor without changing their data", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await loginThroughUi(page, "merchant");
  await page.goto(`/merchant/stores/${storeId}/products/${variantProductId}/edit`);
  await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("switch", { name: /Product has variants|Produk memiliki varian/i })).toBeChecked();
  await expect(page.locator(".merchant-edit-product__variant-group")).toHaveCount(2);
  await expect(page.locator(".merchant-edit-product__variant-card")).toHaveCount(3);
  await assertNoHorizontalOverflow(page);
});

test("product cards and edit routes remain scoped to their owning store", async ({ page }) => {
  const financeStoreId = "11000000-0000-4000-8000-000000000002";
  await loginThroughUi(page, "merchant");

  await page.goto(`/merchant/stores/${financeStoreId}/products`);
  await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".merchant-product-card")).toHaveCount(0);
  await expect(page.locator(`a[href*="${variantProductId}"]`)).toHaveCount(0);

  await page.goto(`/merchant/stores/${financeStoreId}/products/${variantProductId}/edit`);
  await expect(page.getByRole("heading", { name: /Product not found|Produk tidak ditemukan/i })).toBeVisible();

  await page.goto(`/merchant/stores/${storeId}/products`);
  await expect(page.locator(`a[href="/merchant/stores/${storeId}/products/${variantProductId}/edit"]`)).toBeVisible();
});

test("merchant add product form fits a phone and keeps the save button reachable", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginThroughUi(page, "merchant");
  await page.goto("/merchant/stores/10000000-0000-4000-8000-000000000001/products/add");
  await expect(page.getByRole("heading", { level: 1, name: /Tambah Produk|Add Product/i })).toBeVisible();
  const save = page.getByRole("button", { name: /Simpan Produk|Save Product/i });
  await expect(save).toBeVisible();
  const box = await save.boundingBox();
  const nav = await page.locator(".merchant-bottom-nav").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
  await assertNoHorizontalOverflow(page);
});
