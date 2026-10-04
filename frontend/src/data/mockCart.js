export const CART_STORAGE_KEY = "kucur_customer_carts";
export const CART_UPDATED_EVENT = "kucur-cart-updated";

const readCarts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export function getCartItems(customerId) {
  if (!customerId) return [];
  const items = readCarts()[customerId];
  return Array.isArray(items) ? items : [];
}

export function saveCartItems(customerId, items) {
  const carts = readCarts();
  const normalizedItems = items.map((item) => ({
    productId: String(item.productId),
    storeId: String(item.storeId),
    merchantUserId: item.merchantUserId,
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    ...(item.variantId ? { variantId: String(item.variantId), selectedOptions: item.selectedOptions ?? {} } : {}),
  }));
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ ...carts, [customerId]: normalizedItems }));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { customerId } }));
  return normalizedItems;
}

export function addCartItem(customerId, item, quantity = 1) {
  const items = getCartItems(customerId);
  const existing = items.find((cartItem) => String(cartItem.productId) === String(item.productId)
    && String(cartItem.variantId ?? "") === String(item.variantId ?? ""));
  const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  if (existing) {
    return saveCartItems(customerId, items.map((cartItem) => (
      String(cartItem.productId) === String(item.productId) && String(cartItem.variantId ?? "") === String(item.variantId ?? "")
        ? { ...cartItem, quantity: cartItem.quantity + nextQuantity }
        : cartItem
    )));
  }
  return saveCartItems(customerId, [...items, {
    productId: item.productId,
    storeId: item.storeId,
    merchantUserId: item.merchantUserId,
    variantId: item.variantId,
    selectedOptions: item.selectedOptions,
    quantity: nextQuantity,
  }]);
}

export function removeCartItem(customerId, productId, variantId = null) {
  return saveCartItems(
    customerId,
    getCartItems(customerId).filter((item) => !(String(item.productId) === String(productId)
      && String(item.variantId ?? "") === String(variantId ?? ""))),
  );
}

export function clearPurchasedCartItems(customerId, purchasedItems) {
  const purchased = new Set(purchasedItems.map((item) => `${item.productId}:${item.variantId ?? ""}`));
  return saveCartItems(
    customerId,
    getCartItems(customerId).filter((item) => !purchased.has(`${item.productId}:${item.variantId ?? ""}`)),
  );
}
