import { expect, loginThroughUi, test } from "./fixtures.js";

test("Customer and Merchant exchange realtime messages and reconnect without duplicates", async ({ browser }) => {
  test.setTimeout(75_000);
  const runId = `e2e-chat-${Date.now()}`;
  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const merchantContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const customer = await customerContext.newPage();
  const merchant = await merchantContext.newPage();
  await Promise.all([loginThroughUi(customer, "customer"), loginThroughUi(merchant, "merchant")]);
  await merchant.goto("/merchant");
  const initialInboxResponse = merchant.waitForResponse((response) => new URL(response.url()).pathname === "/api/conversations" && response.request().method() === "GET");
  await merchant.reload();
  const inboxResponse = await initialInboxResponse;
  expect(inboxResponse.ok()).toBeTruthy();
  const inboxPayload = await inboxResponse.json();
  const initialUnread = (inboxPayload.data?.items || []).reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
  const unreadBadge = merchant.locator(".chat-unread-badge");
  const openMerchantProfile = async () => {
    if (!(await merchant.locator(".profile-dropdown").isVisible().catch(() => false))) {
      await merchant.getByRole("button", { name: /Akun|Account/i }).click();
    }
  };
  await openMerchantProfile();
  await expect.poll(async () => unreadBadge.count() ? Number(await unreadBadge.textContent()) : 0).toBe(initialUnread);
  await customer.goto("/orders");
  const merchantOrder = customer.locator("article").filter({ hasText: "Lapak Merchant A" }).first();
  await merchantOrder.getByRole("link", { name: /Lihat pesanan|View order/i }).click();
  await customer.getByRole("button", { name: /Chat Penjual|Chat.*Seller/i }).click();
  await expect(customer).toHaveURL(/\/messages\//);
  const customerMessage = `Pesan ${runId}`;
  await customer.getByPlaceholder(/Ketik pesan|Type a message/i).fill(customerMessage);
  await customer.getByRole("button", { name: /^(Kirim|Send)$/i }).click();
  await expect(customer.getByText(customerMessage, { exact: true })).toHaveCount(1);
  await expect.poll(async () => unreadBadge.count() ? Number(await unreadBadge.textContent()) : 0).toBe(initialUnread + 1);
  await merchant.getByRole("link", { name: /Pesan & Bantuan|Messages & Help|Chat & Bantuan|Chat & Help/i }).click();
  await expect(merchant.getByText(customerMessage, { exact: true })).toBeVisible();
  await merchant.getByText(customerMessage, { exact: true }).click();
  await expect(merchant).toHaveURL(/\/messages\//);
  await merchant.goto("/merchant");
  await openMerchantProfile();
  await expect.poll(async () => unreadBadge.count() ? Number(await unreadBadge.textContent()) : 0).toBeLessThan(initialUnread + 1);
  const persistedUnread = await unreadBadge.count() ? Number(await unreadBadge.textContent()) : 0;
  await merchant.reload();
  await openMerchantProfile();
  await expect.poll(async () => unreadBadge.count() ? Number(await unreadBadge.textContent()) : 0).toBe(persistedUnread);
  await merchant.goto("/messages");
  await merchant.getByText(customerMessage, { exact: true }).click();
  const merchantReply = `Balasan ${runId}`;
  await merchant.getByPlaceholder(/Ketik pesan|Type a message/i).fill(merchantReply);
  await merchant.getByRole("button", { name: /^(Kirim|Send)$/i }).click();
  await expect(customer.getByText(merchantReply, { exact: true })).toBeVisible();
  await expect(customer.getByText(merchantReply, { exact: true })).toHaveCount(1);
  await customer.reload();
  await expect(customer.getByText(customerMessage, { exact: true })).toHaveCount(1);
  await expect(customer.getByText(merchantReply, { exact: true })).toHaveCount(1);
  await Promise.all([customerContext.close(), merchantContext.close()]);
});
