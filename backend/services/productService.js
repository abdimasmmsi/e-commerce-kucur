const { errors } = require("../errors/AppError");
const { requiredString } = require("../validation/sharedValidation");

const statuses = ["active", "inactive"];
const number = (value, field, { integer = false } = {}) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || (integer && !Number.isInteger(result))) throw errors.validation({ [field]: "Harus berupa angka non-negatif yang valid." });
  return result;
};
const status = (value, field = "status") => {
  const result = String(value || "active").toLowerCase();
  if (!statuses.includes(result)) throw errors.validation({ [field]: `Harus salah satu: ${statuses.join(", ")}.` });
  return result;
};
const combinationKey = (options, groups) => groups.map((group) => `${group.name.trim().toLowerCase()}=${String(options[group.name]).trim().toLowerCase()}`).join("|");

function validateProduct(input) {
  const hasVariants = Boolean(input.hasVariants);
  const result = {
    storeId: requiredString(input.storeId, "storeId", { max: 36 }),
    name: requiredString(input.name, "name", { max: 180 }),
    description: requiredString(input.description, "description", { max: 5000 }),
    category: requiredString(input.category, "category", { max: 100 }), status: status(input.status), hasVariants,
    price: hasVariants ? null : number(input.price, "price"), stock: hasVariants ? null : number(input.stock, "stock", { integer: true }),
  };
  const rawImages = Array.isArray(input.images) ? input.images : [];
  if (rawImages.length > 3) throw errors.validation({ images: "Maksimal tiga foto umum per produk." });
  if (rawImages.filter((item) => item?.isPrimary).length > 1) throw errors.validation({ images: "Hanya satu foto yang boleh menjadi foto utama." });
  result.images = rawImages.map((item, position) => ({ url: requiredString(item?.url, `images.${position}.url`, { max: 2000 }), storageKey: item?.storageKey ? requiredString(item.storageKey, `images.${position}.storageKey`, { max: 500 }) : null, position, isPrimary: rawImages.some((image) => image?.isPrimary) ? Boolean(item.isPrimary) : position === 0 }));
  const rawGroups = hasVariants && Array.isArray(input.variantGroups) ? input.variantGroups : [];
  if (hasVariants && (!rawGroups.length || rawGroups.length > 2)) throw errors.validation({ variantGroups: "Produk variasi memerlukan satu atau dua grup variasi." });
  result.variantGroups = rawGroups.map((group, position) => {
    const name = requiredString(group?.name, `variantGroups.${position}.name`, { max: 80 });
    const options = Array.isArray(group?.options) ? group.options.map((value, optionIndex) => requiredString(value, `variantGroups.${position}.options.${optionIndex}`, { max: 80 })) : [];
    if (!options.length || new Set(options.map((value) => value.toLowerCase())).size !== options.length) throw errors.validation({ variantGroups: "Setiap grup memerlukan opsi unik." });
    return { name, options, position };
  });
  if (new Set(result.variantGroups.map((group) => group.name.toLowerCase())).size !== result.variantGroups.length) throw errors.validation({ variantGroups: "Nama grup variasi harus unik." });
  const rawVariants = hasVariants && Array.isArray(input.variants) ? input.variants : [];
  if (hasVariants && !rawVariants.length) throw errors.validation({ variants: "Produk variasi memerlukan minimal satu SKU." });
  result.variants = rawVariants.map((variant, index) => {
    const options = {};
    for (const group of result.variantGroups) {
      const selected = requiredString(variant?.options?.[group.name], `variants.${index}.options.${group.name}`, { max: 80 });
      if (!group.options.includes(selected)) throw errors.validation({ variants: `Opsi ${selected} tidak terdaftar pada grup ${group.name}.` });
      options[group.name] = selected;
    }
    const image = variant?.image?.url ? { url: requiredString(variant.image.url, `variants.${index}.image.url`, { max: 2000 }), storageKey: variant.image.storageKey ? requiredString(variant.image.storageKey, `variants.${index}.image.storageKey`, { max: 500 }) : null } : null;
    return { sku: requiredString(variant?.sku, `variants.${index}.sku`, { max: 100 }), options, combinationKey: combinationKey(options, result.variantGroups), price: number(variant?.price, `variants.${index}.price`), stock: number(variant?.stock, `variants.${index}.stock`, { integer: true }), status: status(variant?.status, `variants.${index}.status`), image };
  });
  if (new Set(result.variants.map((item) => item.sku.toLowerCase())).size !== result.variants.length) throw errors.conflict("SKU harus unik dalam satu produk.");
  if (new Set(result.variants.map((item) => item.combinationKey)).size !== result.variants.length) throw errors.conflict("Kombinasi variasi duplikat tidak diperbolehkan.");
  return result;
}

function createProductService(repository) {
  const owned = async (product, actor) => {
    const store = await repository.stores.findById(product.storeId);
    if (!store) throw errors.notFound("Store produk tidak ditemukan.");
    if (!actor.roles.includes("admin") && store.merchantUserId !== actor.id) throw errors.forbidden("Produk bukan milik pengguna ini.");
    return store;
  };
  const withStores = async (products) => Promise.all(products.map(async (product) => ({ ...product, store: product.store || await repository.stores.findById(product.storeId) })));
  const emptyStats = { ratingAverage: null, ratingCount: 0, soldCount: 0, soldRecent: 0 };
  const loadStats = async () => (typeof repository.products.stats === "function" ? repository.products.stats() : { products: {}, stores: {} });
  const withStats = (product, stats) => ({ ...product, ...emptyStats, ...stats.products[product.id] });
  // Data lapak yang aman ditampilkan ke pembeli (tanpa email/HP pemilik dan data keuangan).
  const publicStoreFields = (store, stats) => ({
    id: store.id, name: store.name, description: store.description, image: store.image, status: store.status, createdAt: store.createdAt,
    location: { address: store.location?.address ?? null, latitude: store.location?.latitude ?? null, longitude: store.location?.longitude ?? null },
    ratingAverage: stats.stores[store.id]?.ratingAverage ?? null, ratingCount: stats.stores[store.id]?.ratingCount ?? 0,
  });
  return {
    async list(actor, manage = false, filters = {}) {
      let products = await repository.products.list();
      if (manage) {
        if (!actor) throw errors.unauthenticated();
        if (!actor.roles.some((role) => role === "merchant" || role === "admin")) throw errors.forbidden();
        if (!actor.roles.includes("admin")) { const stores = new Set((await repository.stores.list()).filter((item) => item.merchantUserId === actor.id).map((item) => item.id)); products = products.filter((item) => stores.has(item.storeId)); }
      }
      if (filters.storeId) products = products.filter((item) => String(item.storeId) === String(filters.storeId));
      const [hydrated, stats] = await Promise.all([withStores(products), loadStats()]);
      return (manage ? hydrated : hydrated.filter((item) => item.status === "active" && item.store?.status === "active")).map((item) => withStats(item, stats));
    },
    async get(productId, actor, manage = false, filters = {}) {
      const product = await repository.products.findById(productId);
      if (!product) throw errors.notFound("Produk tidak ditemukan.");
      if (filters.storeId && String(product.storeId) !== String(filters.storeId)) throw errors.notFound("Produk tidak ditemukan pada Store ini.");
      const store = product.store || await repository.stores.findById(product.storeId);
      if (manage) { if (!actor) throw errors.unauthenticated(); await owned(product, actor); }
      else if (product.status !== "active" || store?.status !== "active") throw errors.notFound("Produk tidak ditemukan.");
      return withStats({ ...product, store }, await loadStats());
    },
    // Halaman lapak untuk pembeli: profil lapak, rating, total terjual, dan produk aktifnya.
    async publicStore(storeId) {
      const store = await repository.stores.findById(storeId);
      if (!store || store.status !== "active") throw errors.notFound("Lapak tidak ditemukan atau sedang tutup.");
      const stats = await loadStats();
      const products = (await repository.products.list()).filter((item) => String(item.storeId) === String(store.id) && item.status === "active").map((item) => withStats({ ...item, store }, stats));
      return { ...publicStoreFields(store, stats), soldCount: products.reduce((sum, item) => sum + item.soldCount, 0), productCount: products.length, products: products.map((item) => ({ ...item, store: publicStoreFields(store, stats) })) };
    },
    async create(input, actor) {
      const normalized = validateProduct(input);
      const store = await repository.stores.findById(normalized.storeId);
      if (!store) throw errors.notFound("Store tidak ditemukan.");
      if (store.merchantUserId !== actor.id && !actor.roles.includes("admin")) throw errors.forbidden("Store bukan milik pengguna ini.");
      if (store.type !== "product") throw errors.validation({ storeId: "Produk hanya dapat dibuat pada Store bertipe product." });
      return repository.transaction(async (tx) => {
        const product = await tx.products.create(normalized);
        await tx.audits.append({ entityType: "product", entityId: product.id, actorId: actor.id, actorRole: actor.roles.includes("admin") ? "admin" : "merchant", activityType: "PRODUCT_CREATED", nextStatus: product.status, description: `Produk ${product.name} dibuat.`, isSystem: false });
        return { ...product, store };
      });
    },
    async update(productId, input, actor) {
      const current = await repository.products.findById(productId);
      if (!current) throw errors.notFound("Produk tidak ditemukan.");
      await owned(current, actor);
      const normalized = validateProduct({ ...current, ...input, images: input.images ?? current.images, variantGroups: input.variantGroups ?? current.variantGroups, variants: input.variants ?? current.variants });
      const destination = await repository.stores.findById(normalized.storeId);
      if (!destination) throw errors.notFound("Store tidak ditemukan.");
      if (!actor.roles.includes("admin") && destination.merchantUserId !== actor.id) throw errors.forbidden("Store bukan milik pengguna ini.");
      if (destination.type !== "product") throw errors.validation({ storeId: "Produk hanya dapat dipindahkan ke Store bertipe product." });
      return repository.transaction(async (tx) => {
        const updated = await tx.products.update(productId, normalized);
        const statusChanged = current.status !== updated.status;
        const withoutIds = (items) => items.map(({ id, ...item }) => item);
        const variantsChanged = JSON.stringify(withoutIds(current.variantGroups)) !== JSON.stringify(withoutIds(updated.variantGroups)) || JSON.stringify(withoutIds(current.variants)) !== JSON.stringify(withoutIds(updated.variants));
        const stockChanged = current.stock !== updated.stock || JSON.stringify(current.variants.map((item) => item.stock)) !== JSON.stringify(updated.variants.map((item) => item.stock));
        await tx.audits.append({ entityType: "product", entityId: productId, actorId: actor.id, actorRole: actor.roles.includes("admin") ? "admin" : "merchant", activityType: statusChanged ? "PRODUCT_STATUS_CHANGED" : variantsChanged ? "PRODUCT_VARIANTS_UPDATED" : stockChanged ? "PRODUCT_STOCK_UPDATED" : "PRODUCT_UPDATED", previousStatus: current.status, nextStatus: updated.status, description: `Produk ${updated.name} diperbarui.`, isSystem: false });
        return { ...updated, store: destination };
      });
    },
  };
}

module.exports = { createProductService, validateProduct, combinationKey };
