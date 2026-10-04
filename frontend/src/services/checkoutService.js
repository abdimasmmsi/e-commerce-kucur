import { clearPurchasedCartItems, getCartItems, saveCartItems } from "../data/mockCart";
import { getOrders, saveOrders } from "../data/mockOrders";
import { getProducts } from "../data/mockProducts";
import { getStores } from "../data/mockStores";
import { calculateDeliveryFee } from "./deliveryFeeService";
import { getMockStoreDistanceKm } from "./mockDeliveryDistanceService";
import { createNotification } from "./notificationService";
import { getDrivingDistanceKm } from "./openRouteService";
import { getPrimaryProductImage } from "./productImageStorage";
import { determineScheduledDeliveryDate, formatDeliveryDate } from "./deliverySchedulingService";
import { getOperationalSettings } from "../data/mockOperationalSettings";

export function prepareCheckout(customerId, ratePerKm, directItems = null, customerCoordinates = null) {
  const cartItems = Array.isArray(directItems) ? directItems : getCartItems(customerId);
  const products = getProducts();
  const stores = getStores();
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const storeMap = new Map(stores.map((store) => [String(store.id), store]));
  const errors = [];

  const resolvedItems = cartItems.map((cartItem) => {
    const product = productMap.get(String(cartItem.productId));
    const quantity = Math.floor(Number(cartItem.quantity));
    const variant = product?.hasVariants
      ? product.variants?.find((item) => String(item.id) === String(cartItem.variantId))
      : null;
    const currentStock = product?.hasVariants ? Number(variant?.stock) : Number(product?.stock);
    if (!product) errors.push({ productId: cartItem.productId, productName: `Produk ${cartItem.productId}`, reason: "Produk sudah tidak tersedia." });
    else if (product.status !== "active") errors.push({ productId: product.id, productName: product.name, reason: "Produk sedang tidak aktif." });
    else if (product.hasVariants && !variant) errors.push({ productId: product.id, productName: product.name, reason: "Varian produk sudah tidak tersedia." });
    else if (product.hasVariants && variant.status !== "active") errors.push({ productId: product.id, productName: product.name, reason: "Varian produk sedang tidak aktif." });
    else if (!Number.isInteger(quantity) || quantity <= 0) errors.push({ productId: product.id, productName: product.name, reason: "Jumlah produk harus lebih dari 0." });
    else if (quantity > currentStock) errors.push({ productId: product.id, productName: product.name, reason: `Stok tersisa ${currentStock}, sedangkan cart meminta ${quantity}.` });
    else if (String(product.storeId) !== String(cartItem.storeId) || product.merchantUserId !== cartItem.merchantUserId) errors.push({ productId: product.id, productName: product.name, reason: "Referensi lapak produk tidak valid." });
    return product ? { cartItem, product, variant, quantity, unitPrice: Number(variant?.price ?? product.price), currentStock } : null;
  }).filter(Boolean);

  const grouped = resolvedItems.reduce((result, item) => {
    const storeId = String(item.product.storeId);
    const store = storeMap.get(storeId);
    if (!store || store.type !== "product" || store.status !== "active") {
      errors.push({ productId: item.product.id, productName: item.product.name, reason: "Lapak produk sedang tidak tersedia." });
      return result;
    }
    if (!result[storeId]) result[storeId] = { store, items: [] };
    result[storeId].items.push(item);
    return result;
  }, {});

  const groups = Object.values(grouped).map((group) => {
    const hasCoordinates = Number.isFinite(group.store.coordinates?.lat)
      && Number.isFinite(group.store.coordinates?.lng)
      && Number.isFinite(customerCoordinates?.lat)
      && Number.isFinite(customerCoordinates?.lng);
    const delivery = calculateDeliveryFee({
      ratePerKm,
      sellerCoordinates: group.store.coordinates,
      customerCoordinates,
      mockDistanceKm: hasCoordinates ? undefined : getMockStoreDistanceKm(group.store),
    });
    const productTotal = group.items.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
    return { ...group, ...delivery, distanceSource: hasCoordinates ? "coordinates" : "mock", productTotal };
  });

  return { cartItems, products, groups, errors };
}

export async function createCheckoutOrders({ customer, recipientName, recipientPhone, deliveryAddress, deliveryLocation = null, paymentMethod = "COD", ratePerKm, tipsByStore = {}, directItems = null }) {
  const customerCoordinates = deliveryLocation ? {
    lat: Number(deliveryLocation.latitude),
    lng: Number(deliveryLocation.longitude),
  } : null;
  const prepared = prepareCheckout(customer?.id, ratePerKm, directItems, customerCoordinates);
  if (customerCoordinates) {
    await Promise.all(prepared.groups.map(async (group) => {
      try {
        const routedDistanceKm = await getDrivingDistanceKm(group.store.coordinates, customerCoordinates);
        if (!Number.isFinite(routedDistanceKm)) return;
        group.distanceKm = routedDistanceKm;
        group.roundedDistanceKm = Math.ceil(routedDistanceKm);
        group.deliveryFee = group.roundedDistanceKm * group.ratePerKm;
        group.distanceSource = "road-route";
      } catch {
        // Coordinate distance remains the fallback when routing is unavailable.
      }
    }));
  }
  const address = deliveryAddress?.trim();
  const name = recipientName?.trim();
  const phone = recipientPhone?.trim();
  const errors = [...prepared.errors];
  if (!prepared.cartItems.length) errors.push({ productName: "Cart", reason: "Cart masih kosong." });
  if (!address) errors.push({ productName: "Alamat", reason: "Alamat pengiriman wajib diisi." });
  if (!name) errors.push({ productName: "Penerima", reason: "Nama penerima wajib diisi." });
  if (!phone) errors.push({ productName: "Telepon", reason: "Nomor telepon penerima wajib diisi." });
  if (!["COD", "MIDTRANS"].includes(paymentMethod)) errors.push({ productName: "Pembayaran", reason: "Metode pembayaran tidak valid." });

  const tips = {};
  prepared.groups.forEach(({ store }) => {
    const tip = Number(tipsByStore[String(store.id)] ?? 0);
    if (!Number.isFinite(tip) || tip < 0) errors.push({ productName: store.name, reason: "Courier tip harus berupa angka 0 atau lebih." });
    else tips[String(store.id)] = Math.round(tip);
  });
  if (errors.length) return { success: false, errors, groups: prepared.groups };

  const createdAt = new Date().toISOString();
  const isOnlinePayment = paymentMethod === "MIDTRANS";
  const deliverySettings = getOperationalSettings();
  const existingOrders = getOrders();
  const scheduledOrders = [...existingOrders];
  const sequence = Date.now();
  const newOrders = prepared.groups.map((group, index) => {
    const courierTip = tips[String(group.store.id)] ?? 0;
    const items = group.items.map(({ product, variant, cartItem, quantity, unitPrice }) => {
      const visualGroup = product.variantGroups?.find((entry) => entry.id === product.variantImageGroupId);
      const legacyVariantImage = visualGroup && variant
        ? product.variantOptionImages?.[visualGroup.id]?.[variant.options?.[visualGroup.name]]
        : null;
      return ({
      productId: product.id,
      productName: product.name,
      image: variant?.image ?? legacyVariantImage ?? getPrimaryProductImage(product),
      variantId: variant?.id ?? null,
      selectedOptions: variant?.options ?? cartItem.selectedOptions ?? {},
      sku: variant?.sku ?? null,
      quantity,
      unitPrice,
      price: unitPrice,
      subtotal: unitPrice * quantity,
      });
    });
    const scheduledDeliveryDate = isOnlinePayment ? null : determineScheduledDeliveryDate({ orderCreatedAt: createdAt, cutoffTime: deliverySettings.deliveryOrderCutoffTime, maxDailyDeliveries: deliverySettings.maxDailyDeliveries, existingScheduledOrders: scheduledOrders });
    const createdOrder = {
      id: `ORDER-${sequence}-${index + 1}`,
      orderNumber: `KUC-${sequence}-${index + 1}`,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      storeId: String(group.store.id),
      storeName: group.store.name,
      merchantUserId: group.store.merchantUserId,
      items,
      productTotal: group.productTotal,
      deliveryFee: group.deliveryFee,
      courierTip,
      totalAmount: group.productTotal + group.deliveryFee + courierTip,
      distanceKm: group.distanceKm,
      distanceSource: group.distanceSource,
      storeCoordinatesSnapshot: group.store.coordinates ?? null,
      roundedDistanceKm: group.roundedDistanceKm,
      deliveryRatePerKmSnapshot: group.ratePerKm,
      paymentMethod,
      paymentStatus: "pending",
      stockReservationStatus: isOnlinePayment ? "reserved" : "finalized",
      recipientName: name,
      recipientPhone: phone,
      deliveryAddress: address,
      deliveryLocation: deliveryLocation ? {
        label: address,
        latitude: Number(deliveryLocation.latitude),
        longitude: Number(deliveryLocation.longitude),
        placeId: deliveryLocation.placeId ?? null,
        provider: deliveryLocation.provider ?? "manual",
      } : null,
      status: "pending",
      deliveryWorkflow: "daily-batch",
      scheduledDeliveryDate,
      deliveryCutoffSnapshot: deliverySettings.deliveryOrderCutoffTime,
      deliveryDispatchTimeSnapshot: deliverySettings.deliveryDispatchTime,
      maxDailyDeliveriesSnapshot: deliverySettings.maxDailyDeliveries,
      createdAt,
      updatedAt: createdAt,
      statusHistory: [{
        status: "pending",
        actorType: "customer",
        actorName: customer.fullName,
        timestamp: createdAt,
        oldStatus: null,
        newStatus: "pending",
      }, ...(scheduledDeliveryDate ? [{
        status: "pending",
        actorType: "system",
        actorName: "Kucur System",
        timestamp: createdAt,
        action: "Scheduled",
        description: `Dijadwalkan untuk pengiriman ${scheduledDeliveryDate} setelah pukul ${deliverySettings.deliveryDispatchTime}.`,
      }] : [{ status: "pending", actorType: "system", actorName: "Kucur System", timestamp: createdAt, action: "Payment Pending", description: "Stok dicadangkan sementara dan fulfillment menunggu pembayaran terverifikasi." }])],
    };
    if (scheduledDeliveryDate) scheduledOrders.push(createdOrder);
    return createdOrder;
  });

  // Compatibility-only order storage. Inventory is never written here: canonical
  // Product/SKU stock and reservation changes belong to the backend transaction.
  try {
    saveOrders([...existingOrders, ...newOrders]);
    if (!Array.isArray(directItems)) {
      clearPurchasedCartItems(customer.id, prepared.cartItems);
    }
  } catch {
    // Best-effort rollback keeps a localStorage write failure from losing cart data.
    saveOrders(existingOrders);
    if (!Array.isArray(directItems)) saveCartItems(customer.id, prepared.cartItems);
    return { success: false, errors: [{ productName: "Checkout", reason: "Penyimpanan gagal. Tidak ada order atau pengurangan stok yang diterapkan." }] };
  }
  newOrders.forEach((order) => {
    createNotification({ recipientUserId: order.merchantUserId, recipientRole: "merchant", type: "order", title: "Pesanan baru masuk", message: order.paymentMethod === "MIDTRANS" ? `${order.orderNumber} menunggu pembayaran online.` : `${order.orderNumber} dari ${order.customerName} siap ditinjau.`, link: `/merchant/stores/${order.storeId}/orders/${order.id}` });
    createNotification({ recipientUserId: order.customerId, recipientRole: "customer", type: "order", title: "Pesanan berhasil dibuat", message: order.paymentMethod === "MIDTRANS" ? `${order.orderNumber} dibuat. Selesaikan pembayaran melalui Midtrans.` : `${order.orderNumber} berhasil dibuat dan menunggu konfirmasi merchant.`, link: `/orders/${order.id}` });
    if (order.scheduledDeliveryDate) createNotification({ recipientUserId: order.customerId, recipientRole: "customer", type: "delivery-schedule", title: "Jadwal pengiriman", message: `Pesanan dijadwalkan untuk pengiriman ${formatDeliveryDate(order.scheduledDeliveryDate)} setelah pukul ${order.deliveryDispatchTimeSnapshot}.`, link: `/orders/${order.id}` });
  });
  return { success: true, orders: newOrders };
}
