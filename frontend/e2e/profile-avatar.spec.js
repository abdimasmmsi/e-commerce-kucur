import { assertNoHorizontalOverflow, expect, loginThroughUi, test } from "./fixtures.js";
import { Buffer } from "node:buffer";

async function imageFixture(page, { height, mimeType, name, transparent = false, width }) {
  const dataUrl = await page.evaluate(({ height: imageHeight, mimeType: type, transparent: hasAlpha, width: imageWidth }) => {
    const canvas = document.createElement("canvas");
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, imageWidth, imageHeight);
    if (!hasAlpha) {
      context.fillStyle = "#dff7dc";
      context.fillRect(0, 0, imageWidth, imageHeight);
    }
    context.fillStyle = "#0b2a12";
    context.beginPath();
    context.arc(imageWidth / 2, imageHeight * 0.38, Math.min(imageWidth, imageHeight) * 0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#2bd41f";
    context.fillRect(imageWidth * 0.28, imageHeight * 0.58, imageWidth * 0.44, imageHeight * 0.25);
    return canvas.toDataURL(type, 0.9);
  }, { height, mimeType, transparent, width });
  return { name, mimeType, buffer: Buffer.from(dataUrl.split(",")[1], "base64") };
}

async function uploadAndUse(page, fixture) {
  const renderedAvatar = page.locator(".account-profile-avatar .user-avatar__image");
  const previousSource = await renderedAvatar.count() ? await renderedAvatar.getAttribute("src") : null;
  await page.evaluate(({ base64, mimeType, name }) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const input = document.querySelector('input[type="file"][aria-label]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: mimeType }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { base64: fixture.buffer.toString("base64"), mimeType: fixture.mimeType, name: fixture.name });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Gunakan foto|Use photo/i }).click();
  await expect(renderedAvatar).toBeVisible();
  await expect.poll(() => renderedAvatar.getAttribute("src")).not.toBe(previousSource);
}

const fixtures = [
  { name: "portrait.jpg", mimeType: "image/jpeg", width: 240, height: 360 },
  { name: "portrait.png", mimeType: "image/png", width: 240, height: 360 },
  { name: "transparent.png", mimeType: "image/png", width: 320, height: 320, transparent: true },
  { name: "landscape.webp", mimeType: "image/webp", width: 360, height: 240 },
];

test.describe.serial("profile avatar", () => {
  for (const definition of fixtures) test(`uploads and crops ${definition.name}`, async ({ qaPage: page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await loginThroughUi(page, "customer");
    await page.goto("/profile");
    await uploadAndUse(page, await imageFixture(page, definition));
    const profileAvatar = page.locator(".account-profile-avatar");
    const box = await profileAvatar.boundingBox();
    expect(Math.round(box.width)).toBe(92);
    expect(Math.round(box.height)).toBe(92);

    if (definition.transparent) {
      const cornerAlpha = await page.locator(".account-profile-avatar .user-avatar__image").evaluate(async (image) => {
        const response = await fetch(image.src);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        const alpha = context.getImageData(0, 0, 1, 1).data[3];
        bitmap.close();
        return alpha;
      });
      expect(cornerAlpha).toBeLessThan(16);
    }
  });

  test("keeps shared sizing and responsive photo actions", async ({ qaPage: page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await loginThroughUi(page, "customer");
  await page.goto("/profile");
  const navbarAvatar = page.locator(".profile-menu-trigger .user-avatar");
  const navbarBox = await navbarAvatar.boundingBox();
  expect(Math.round(navbarBox.width)).toBe(36);
  expect(Math.round(navbarBox.height)).toBe(36);
  await expect(navbarAvatar.locator("img")).toHaveCSS("object-fit", "cover");

  const desktopFileInput = page.locator('.account-avatar-hover-actions input[type="file"]');
  await desktopFileInput.focus();
  await expect(page.locator(".account-avatar-hover-actions")).toHaveCSS("opacity", "1");

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.locator(".account-avatar-mobile-trigger").click();
  await expect(page.locator(".account-avatar-mobile-menu")).toBeVisible();
  await page.getByRole("button", { name: /Hapus foto|Remove photo/i }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();

  await page.locator(".account-avatar-mobile-trigger").click();
  await page.getByRole("button", { name: /Hapus foto|Remove photo/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Hapus foto|Remove photo/i }).click();
  await expect(page.locator(".account-profile-avatar .user-avatar__initials")).toHaveText("CK");
  });
});
