const { errors } = require("../errors/AppError");

const quantity = (value) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw errors.validation({ quantity: "Quantity minimal 1." }); return parsed; };
const sellable = (product, productVariantId, requested) => {
  if (!product || product.status !== "active" || product.store?.status !== "active") throw errors.validation({ productId: "Produk tidak tersedia." });
  if (product.hasVariants) {
    if (!productVariantId) throw errors.validation({ productVariantId: "Varian wajib dipilih." });
    const variant = product.variants.find((item) => item.id === productVariantId);
    if (!variant || variant.status !== "active") throw errors.validation({ productVariantId: "Varian tidak tersedia untuk produk ini." });
    if (variant.stock < requested) throw errors.validation({ quantity: "Stok varian tidak mencukupi.", availableStock: variant.stock });
    return variant;
  }
  if (productVariantId) throw errors.validation({ productVariantId: "Produk sederhana tidak menerima varian." });
  if (product.stock < requested) throw errors.validation({ quantity: "Stok produk tidak mencukupi.", availableStock: product.stock });
  return null;
};

function createCartService(repository) {
  return {
    async get(actor) { return (await repository.commerce.getCart(actor.id)) || repository.commerce.ensureCart(actor.id); },
    async add(input, actor) {
      const requested = quantity(input.quantity); const cart = await repository.commerce.ensureCart(actor.id);
      const product = await repository.products.findById(String(input.productId || ""));
      const variantId = input.productVariantId ? String(input.productVariantId) : null;
      const existing = await repository.commerce.findCartItem(cart.id, product?.id, variantId);
      const nextQuantity = requested + (existing?.quantity || 0); sellable(product, variantId, nextQuantity);
      if (existing) await repository.commerce.updateCartItem(existing.id, nextQuantity);
      else await repository.commerce.addCartItem({ cartId: cart.id, productId: product.id, productVariantId: variantId, quantity: requested });
      return repository.commerce.getCart(actor.id);
    },
    async update(cartItemId, input, actor) {
      const cart = await repository.commerce.ensureCart(actor.id); const item = cart.items.find((row) => row.id === cartItemId);
      if (!item) throw errors.notFound("Item Cart tidak ditemukan."); const requested = quantity(input.quantity);
      sellable(item.product, item.productVariantId, requested); await repository.commerce.updateCartItem(item.id, requested);
      return repository.commerce.getCart(actor.id);
    },
    async remove(cartItemId, actor) {
      const cart = await repository.commerce.ensureCart(actor.id); const item = cart.items.find((row) => row.id === cartItemId);
      if (!item) throw errors.notFound("Item Cart tidak ditemukan."); await repository.commerce.deleteCartItem(item.id);
      return repository.commerce.getCart(actor.id);
    },
  };
}
module.exports = { createCartService, quantity, sellable };
