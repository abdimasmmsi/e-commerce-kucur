import { expect, loginThroughUi, qaScreenshot, test, setPreferences } from "./fixtures.js";

test.describe.serial("canonical cross-role commerce", () => {
  test("Customer to Merchant to Admin to Courier to Customer, then Review", async ({ browser }) => {
    test.setTimeout(240_000);
    const runId = `e2e-${Date.now()}`;
    const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -7.9839, longitude: 112.6214 }, permissions: ["geolocation"] });
    const merchantContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const courierContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const customer = await customerContext.newPage();
    const merchant = await merchantContext.newPage();
    const admin = await adminContext.newPage();
    const courier = await courierContext.newPage();

    await loginThroughUi(customer, "customer");
    await setPreferences(customer, { language: "id" });
    await customer.goto("/cart");
    while (await customer.getByRole("button", { name: /Hapus|Remove/i }).count()) {
      await customer.getByRole("button", { name: /Hapus|Remove/i }).first().click();
    }
    await customer.goto("/products");
    const productName = "Madu Kucur QA B";
    const productCard = customer.locator("article").filter({ hasText: productName });
    await productCard.getByRole("link", { name: productName }).click();
    await expect(customer.getByRole("heading", { name: productName })).toBeVisible();
    await customer.getByRole("button", { name: /Tambah.*Keranjang|Add.*Cart|\+\s*Cart|Keranjang/i }).first().click();
    await expect(customer.getByRole("status")).toContainText(/ditambahkan|added/i);
    await customer.goto("/cart");
    await expect(customer.getByText(productName)).toBeVisible();
    await customer.getByRole("link", { name: /Checkout/i }).click();
    // Akun QA bisa punya alamat tersimpan; test ini memakai alur alamat manual + GPS.
    await expect(customer.getByRole("heading", { name: /Data Penerima|Recipient Details/i })).toBeVisible();
    const currentLocation = customer.getByRole("radio", { name: /Lokasi saya sekarang|My current location/i });
    if (await currentLocation.count()) await currentLocation.check();
    await customer.getByLabel(/Alamat Pengiriman|Delivery Address/i).fill(`Alamat QA ${runId}, Desa Kucur`);
    // Total dihitung otomatis setelah alamat terisi dan lokasi terdeteksi.
    await expect(customer.getByText(/^(Ongkir|Delivery Fee)$/i)).toBeVisible();
    await expect(customer.locator("text=/^(Total bayar|Total to pay)$/ >> visible=true")).toBeVisible();
    const createOrderResponse = customer.waitForResponse((response) => response.url().includes("/api/checkout") && response.request().method() === "POST");
    await customer.getByRole("button", { name: /Buat Pesanan|Create Order/i }).click();
    const createOrderResult = await createOrderResponse;
    expect(createOrderResult.ok()).toBeTruthy();
    const createdOrders = (await createOrderResult.json()).data?.orders ?? [];
    const orderLink = customer.locator('a[href^="/orders/"]').first();
    await expect(orderLink).toBeVisible();
    const orderHref = await orderLink.getAttribute("href");
    const orderId = orderHref.split("/").at(-1);
    const orderCode = createdOrders.find((order) => order.id === orderId)?.orderCode;
    expect(orderId).toBeTruthy();
    expect(orderCode).toBeTruthy();
    await orderLink.click();
    await expect(customer.getByRole("heading", { level: 1, name: new RegExp(orderCode.slice(-4)) })).toBeVisible();
    await expect(customer.getByText(orderCode, { exact: true })).toBeVisible();
    await qaScreenshot(customer, "final/customer/id-light", `checkout-order-${runId}`);

    await loginThroughUi(merchant, "merchantB");
    await merchant.goto("/merchant/stores/10000000-0000-4000-8000-000000000002/orders");
    const merchantOrder = merchant.getByRole("link").filter({ hasText: orderCode });
    await expect(merchantOrder).toBeVisible();
    await merchantOrder.click();
    await expect(merchant).toHaveURL(/\/orders\/[^/]+$/);
    await expect(merchant.getByRole("heading", { level: 1, name: /^(Pesanan|Order) #/ })).toBeVisible();
    for (const action of [/Konfirmasi Pesanan/i, /Mulai Kemas/i, /Siap Diambil Kurir/i]) {
      await merchant.getByRole("button", { name: action }).click();
      await merchant.getByRole("dialog").getByRole("button", { name: /Ya, Lanjutkan/i }).click();
      await expect(merchant.getByRole("dialog")).toHaveCount(0);
    }
    await expect(merchant.getByText(/Ready for Pickup|Siap Diambil Kurir/i).first()).toBeVisible();
    await qaScreenshot(merchant, "final/merchant/id-light", `ready-${runId}`);

    await loginThroughUi(admin, "admin");
    await admin.goto("/admin/delivery-batches");
    // Batch dari draf otomatis: cari pesanan ini (hari ini atau besok, tergantung cutoff), jadwalkan ke kurir QA,
    // keluarkan pesanan lain dari draf supaya tes hanya menyetujui pesanan ini.
    const draftPanel = admin.locator("section", { has: admin.getByRole("heading", { name: /Draf jadwal otomatis|Automatic schedule draft/ }) });
    const shortCode = `#${orderCode.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;
    const draftOrder = draftPanel.locator("li", { hasText: shortCode });
    const dateInput = draftPanel.getByLabel(/Tanggal pengiriman|Delivery date/);
    await expect(draftPanel.getByText(/^(Batas pesan|Order cutoff)$/)).toBeVisible();
    const foundToday = await draftOrder.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
    if (!foundToday) {
      const current = await dateInput.inputValue();
      const next = new Date(`${current}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      await dateInput.fill(next.toISOString().slice(0, 10));
    }
    await expect(draftOrder).toBeVisible();
    await draftOrder.getByRole("combobox").selectOption({ label: "Courier Kucur" });
    // Pesanan lain dikeluarkan satu per satu (daftar berubah setiap kali satu pesanan dipindah).
    for (let guard = 0; guard < 50; guard += 1) {
      const others = draftPanel.locator("li").filter({ hasNotText: shortCode });
      let moved = false;
      for (let index = 0; index < await others.count(); index += 1) {
        const select = others.nth(index).getByRole("combobox");
        if (await select.inputValue()) { await select.selectOption({ value: "" }); moved = true; break; }
      }
      if (!moved) break;
    }
    await draftPanel.getByRole("button", { name: /Setujui 1 pesanan|Approve 1 orders/i }).click();
    const batchResponsePromise = admin.waitForResponse((response) => response.url().includes("/api/admin/delivery/drafts/approve") && response.request().method() === "POST");
    await admin.getByRole("dialog").getByRole("button", { name: /Setujui 1 pesanan|Approve 1 orders/i }).click();
    const batchResponse = await batchResponsePromise;
    expect(batchResponse.ok()).toBeTruthy();
    const batchPayload = await batchResponse.json();
    const batchId = batchPayload.data?.batches?.[0]?.id;
    expect(batchId).toBeTruthy();
    await qaScreenshot(admin, "final/admin/id-light", `batch-${runId}`);

    await loginThroughUi(courier, "courier");
    await courier.goto(`/courier/batches/${batchId}`);
    await expect(courier.getByText(orderCode).first()).toBeVisible();
    const start = courier.getByRole("button", { name: /Mulai pengiriman|Start delivery|Mulai Batch|Start Batch/i }).first();
    if (await start.isVisible()) await start.click();
    await courier.getByRole("button", { name: /Konfirmasi Ambil Barang|Confirm Pickup/i }).click();
    await expect(courier.getByText(/PICKED_UP|Picked Up|Sudah diambil/i).first()).toBeVisible();
    await courier.getByRole("button", { name: /Mulai Antar|Start Delivery/i }).click();
    await expect(courier.getByText(/OUT_FOR_DELIVERY|Out for Delivery|Sedang diantar/i).first()).toBeVisible();
    // Kurir memotret barang yang diterima; foto diunggah sebagai bukti antar.
    const proofPhoto = await courier.screenshot({ type: "png" });
    await courier.getByLabel(/Foto & selesaikan|Take photo & finish/i).setInputFiles({ name: "bukti-antar.png", mimeType: "image/png", buffer: proofPhoto });
    await Promise.all([
      courier.waitForResponse((response) => /\/proof$/.test(response.url()) && response.request().method() !== "GET" && response.ok()),
      courier.getByRole("button", { name: /Selesaikan dengan Bukti|Complete with Proof/i }).click(),
    ]);
    await expect(courier.getByText(/DELIVERED|Terkirim/i).first()).toBeVisible();
    await qaScreenshot(courier, "final/courier/id-light", `delivered-${runId}`);

    await customer.goto(`/orders/${orderId}`);
    await expect(customer.getByText(/Terkirim|Selesai|Completed/i).first()).toBeVisible();
    await expect(customer.getByRole("heading", { name: /Bukti Pengiriman/i })).toBeVisible();
    const proofImage = customer.getByRole("img", { name: /Bukti pesanan|Proof that the order/i });
    await expect(proofImage).toBeVisible();
    expect(await proofImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBeTruthy();
    await qaScreenshot(customer, "final/customer/id-light", `completed-${runId}`);
    await customer.getByRole("button", { name: "5 bintang" }).click();
    const reviewText = `Review browser ${runId}`;
    await customer.getByLabel(/Ceritakan pengalaman/i).fill(reviewText);
    await customer.getByRole("button", { name: /Kirim Ulasan/i }).click();
    // Setelah terkirim, form diganti tanda "Sudah diulas" sehingga ulasan tidak bisa dikirim dua kali.
    await expect(customer.getByText(/Sudah diulas|Reviewed/i).first()).toBeVisible();
    await expect(customer.getByRole("button", { name: /Kirim Ulasan/i })).toHaveCount(0);

    await merchant.goto("/merchant/reviews");
    const reviewCard = merchant.locator("article.merchant-review-card").filter({ hasText: reviewText });
    await expect(reviewCard).toHaveCount(1);
    await reviewCard.getByRole("button", { name: /Balas Ulasan|Reply to Review/i }).click();
    const replyText = `Balasan merchant ${runId}`;
    const replyDialog = merchant.getByRole("dialog");
    await replyDialog.getByRole("textbox").fill(replyText);
    await replyDialog.getByRole("button", { name: /Simpan Balasan|Save Reply/i }).click();
    await customer.goto("/my-reviews");
    await expect(customer.getByText(replyText)).toBeVisible();

    await Promise.all([customerContext.close(), merchantContext.close(), adminContext.close(), courierContext.close()]);
  });
});
