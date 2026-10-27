import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../context/StoreContext";
import { usePreferences } from "../../context/PreferencesContext";
import {
  productCategories,
  productService,
} from "../../services/productService";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import ProductImage from "../../components/ProductImage";
import LoadingPanel from "../../components/ui/LoadingPanel";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { deleteProductImage, getProductImage, saveProductImage } from "../../services/productImageStorage";
import { uploadStoreImage } from "../../services/storeImageService";
import "./ProductFormEdit.css";

const emptyForm = {
  name: "",
  category: "",
  price: "",
  compareAtPrice: "",
  stock: "",
  description: "",
  status: "active",
};

// Teks harga coret (belum ada di berkas locale bersama, jadi disimpan lokal di sini).
const compareCopyByLanguage = {
  id: { label: "Harga coret (sebelum diskon)", optional: "Opsional", help: "Kosongkan jika tidak ada diskon. Pembeli melihat harga ini dicoret.", mustBeHigher: "Harga coret harus lebih besar dari harga jual.", discount: "Diskon {percent}%", variantInvalid: "Harga coret variasi harus lebih besar dari harga jualnya." },
  en: { label: "Compare-at price (before discount)", optional: "Optional", help: "Leave empty if there is no discount. Buyers see this price struck through.", mustBeHigher: "Compare-at price must be higher than the selling price.", discount: "{percent}% off", variantInvalid: "A variant compare-at price must be higher than its selling price." },
};

const hasCompareAt = (value) => value !== "" && value !== null && value !== undefined;
const compareAtInvalid = (compareAt, price) => hasCompareAt(compareAt) && Number(compareAt) <= Number(price);
const discountPercent = (compareAt, price) => (hasCompareAt(compareAt) && Number(price) > 0 && Number(compareAt) > Number(price) ? Math.round((1 - Number(price) / Number(compareAt)) * 100) : 0);

function validateProduct(form, hasVariants = false, t, compareCopy) {
  const errors = {};
  if (!form.name.trim()) errors.name = t("productForm.validation.name");
  if (!form.category) errors.category = t("productForm.validation.category");
  if (!hasVariants && form.price === "") errors.price = t("productForm.validation.priceRequired");
  else if (!hasVariants && Number(form.price) <= 0) errors.price = t("productForm.validation.pricePositive");
  if (!hasVariants && form.stock === "") errors.stock = t("productForm.validation.stockRequired");
  else if (!hasVariants && Number(form.stock) < 0) errors.stock = t("productForm.validation.stockNonnegative");
  if (!hasVariants && !errors.price && compareAtInvalid(form.compareAtPrice, form.price)) errors.compareAtPrice = compareCopy.mustBeHigher;
  if (!form.description.trim()) errors.description = t("productForm.validation.description");
  return errors;
}

function toFormValues(product) {
  if (!product) return emptyForm;
  return {
    name: product.name,
    category: product.category,
    price: String(product.price),
    compareAtPrice: product.compareAtPrice == null ? "" : String(product.compareAtPrice),
    stock: String(product.stock),
    description: product.description,
    status: product.status,
  };
}

const combinationKey = (options) => JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));

function generateVariantCombinations(groups, currentVariants, defaultPrice = 0) {
  if (!groups.length || groups.some((group) => !group.name.trim() || !group.options.length)) return [];
  const combinations = groups.reduce((rows, group) => rows.flatMap((row) => group.options.map((option) => ({ ...row, [group.name.trim()]: option }))), [{}]);
  const existing = new Map(currentVariants.map((variant) => [combinationKey(variant.options), variant]));
  return combinations.map((options, index) => existing.get(combinationKey(options)) ?? {
    id: `VAR-${Date.now()}-${index}-${crypto.randomUUID()}`,
    sku: `SKU-${Date.now().toString(36).toUpperCase()}-${index + 1}`,
    options,
    price: Number(defaultPrice) || 0,
    stock: 0,
    status: "active",
  });
}

function ProductFormWorkspace({ mode, storeId, productId, routeStore }) {
  const navigate = useNavigate();
  const isEdit = mode === "edit";
  const { errorMessage, language, t } = usePreferences();
  const compareCopy = compareCopyByLanguage[language] ?? compareCopyByLanguage.id;
  const [existingProduct, setExistingProduct] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState([]);
  const [imageError, setImageError] = useState("");
  const [processingImages, setProcessingImages] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantGroups, setVariantGroups] = useState([]);
  const [variants, setVariants] = useState([]);
  const [optionDrafts, setOptionDrafts] = useState({});
  const [variantError, setVariantError] = useState("");
  const newStorageKeys = useRef(new Set());
  const removedStorageKeys = useRef(new Set());
  const saved = useRef(false);
  const productImageInput = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    productService.get(productId, { scope: "manage", storeId }).then((product) => {
      if (!active) return;
      if (product.storeId !== String(storeId)) { setNotFound(true); return; }
      setExistingProduct(product); setForm(toFormValues(product)); setImages(product.images ?? []);
      setHasVariants(product.hasVariants); setVariantGroups(product.variantGroups ?? []); setVariants(product.variants ?? []);
    }).catch((error) => { if (active) { if (error.status === 404) setNotFound(true); else setApiError(errorMessage(error.code, t("productForm.saveFailed"))); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [errorMessage, isEdit, productId, storeId, t]);

  useEffect(() => () => {
    if (!saved.current) newStorageKeys.current.forEach((storageKey) => deleteProductImage(storageKey));
  }, []);

  const uploadImages = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (images.length + files.length > 3) return setImageError(t("productForm.maxImages"));
    setProcessingImages(true);
    setImageError("");
    const uploaded = [];
    for (const file of files) {
      try {
        const metadata = await saveProductImage(file);
        newStorageKeys.current.add(metadata.storageKey);
        uploaded.push(metadata);
      } catch (error) {
        setImageError(errorMessage(error.code, t("productForm.saveFailed")));
      }
    }
    setImages((current) => {
      const shouldSetPrimary = current.length === 0;
      return [...current, ...uploaded.map((image, index) => ({ ...image, isPrimary: shouldSetPrimary && index === 0 }))];
    });
    setProcessingImages(false);
  };

  const removeImage = (imageId) => setImages((current) => {
    const removed = current.find((image) => image.id === imageId);
    if (removed?.storageKey) removedStorageKeys.current.add(removed.storageKey);
    const remaining = current.filter((image) => image.id !== imageId);
    if (removed?.isPrimary && remaining.length) remaining[0] = { ...remaining[0], isPrimary: true };
    return remaining;
  });

  const setPrimaryImage = (imageId) => setImages((current) => current.map((image) => ({
    ...image,
    isPrimary: image.id === imageId,
  })));

  const commitGroups = (groups, sourceVariants = variants) => {
    const nextVariants = generateVariantCombinations(groups, sourceVariants, form.price);
    sourceVariants.filter((variant) => !nextVariants.some((next) => next.id === variant.id))
      .forEach((variant) => variant.image?.storageKey && removedStorageKeys.current.add(variant.image.storageKey));
    setVariantGroups(groups);
    setVariants(nextVariants);
    setVariantError("");
  };
  const addVariantGroup = () => {
    if (variantGroups.length >= 2) return;
    commitGroups([...variantGroups, { id: `GROUP-${crypto.randomUUID()}`, name: "", options: [] }]);
  };
  const renameVariantGroup = (groupId, name) => {
    const oldGroup = variantGroups.find((group) => group.id === groupId);
    const renamedVariants = variants.map((variant) => {
      if (!oldGroup?.name || oldGroup.name === name) return variant;
      const options = { ...variant.options };
      const value = options[oldGroup.name];
      delete options[oldGroup.name];
      if (name.trim()) options[name.trim()] = value;
      return { ...variant, options };
    });
    commitGroups(variantGroups.map((group) => group.id === groupId ? { ...group, name } : group), renamedVariants);
  };
  const addVariantOption = (groupId) => {
    const value = optionDrafts[groupId]?.trim();
    const group = variantGroups.find((item) => item.id === groupId);
    if (!value) return setVariantError(t("productForm.optionRequired"));
    if (group.options.some((option) => option.toLowerCase() === value.toLowerCase())) return setVariantError(t("productForm.optionDuplicate"));
    setOptionDrafts((current) => ({ ...current, [groupId]: "" }));
    commitGroups(variantGroups.map((item) => item.id === groupId ? { ...item, options: [...item.options, value] } : item));
  };
  const removeVariantOption = (groupId, option) => commitGroups(variantGroups.map((group) => group.id === groupId ? { ...group, options: group.options.filter((item) => item !== option) } : group));
  const removeVariantGroup = (groupId) => commitGroups(variantGroups.filter((group) => group.id !== groupId));
  const updateVariant = (variantId, field, value) => setVariants((current) => current.map((variant) => variant.id === variantId ? { ...variant, [field]: field === "status" ? value : field === "compareAtPrice" ? (value === "" ? null : Math.max(Number(value) || 0, 0)) : Math.max(Number(value) || 0, 0) } : variant));
  const uploadVariantImage = async (variantId, file) => {
    if (!file) return;
    setProcessingImages(true);
    setImageError("");
    try {
      const metadata = await saveProductImage(file);
      newStorageKeys.current.add(metadata.storageKey);
      const previous = variants.find((variant) => variant.id === variantId)?.image;
      if (previous?.storageKey) removedStorageKeys.current.add(previous.storageKey);
      setVariants((current) => current.map((variant) => variant.id === variantId ? { ...variant, image: metadata } : variant));
    } catch (error) {
      setImageError(errorMessage(error.code, t("productForm.saveFailed")));
    }
    setProcessingImages(false);
  };
  const removeVariantImage = (variantId) => {
    const image = variants.find((variant) => variant.id === variantId)?.image;
    if (image?.storageKey) removedStorageKeys.current.add(image.storageKey);
    setVariants((current) => current.map((variant) => variant.id === variantId ? { ...variant, image: null } : variant));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const safeValue = (name === "price" || name === "stock" || name === "compareAtPrice") && Number(value) < 0 ? "0" : value;
    setForm((current) => ({ ...current, [name]: safeValue }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateProduct(form, hasVariants, t, compareCopy);
    if (hasVariants) {
      const groupNames = variantGroups.map((group) => group.name.trim().toLowerCase());
      if (!variantGroups.length || variantGroups.some((group) => !group.name.trim() || !group.options.length)) setVariantError(t("productForm.groupRequired"));
      else if (new Set(groupNames).size !== groupNames.length) setVariantError(t("productForm.groupDuplicate"));
      else if (!variants.length || variants.some((variant) => Number(variant.price) <= 0 || Number(variant.stock) < 0)) setVariantError(t("productForm.skuInvalid"));
      else if (variants.some((variant) => compareAtInvalid(variant.compareAtPrice, variant.price))) setVariantError(compareCopy.variantInvalid);
    }
    const groupNames = variantGroups.map((group) => group.name.trim().toLowerCase());
    if (Object.keys(nextErrors).length > 0 || (hasVariants && (!variantGroups.length || variantGroups.some((group) => !group.name.trim() || !group.options.length) || new Set(groupNames).size !== groupNames.length || !variants.length || variants.some((variant) => Number(variant.price) <= 0 || Number(variant.stock) < 0 || compareAtInvalid(variant.compareAtPrice, variant.price))))) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true); setApiError("");
    try {
      // Foto baru masih di browser (IndexedDB); unggah ke server dulu supaya pembeli bisa melihatnya.
      const uploadIfNeeded = async (image) => {
        if (!image || image.url || !image.storageKey) return image;
        const blob = await getProductImage(image.storageKey);
        if (!blob) throw new Error("PRODUCT_IMAGE_MISSING");
        return { ...image, url: await uploadStoreImage(blob) };
      };
      const uploadedImages = await Promise.all(images.map(uploadIfNeeded));
      const uploadedVariants = hasVariants ? await Promise.all(variants.map(async (variant) => ({ ...variant, image: await uploadIfNeeded(variant.image) }))) : [];
      setImages(uploadedImages);
      if (hasVariants) setVariants(uploadedVariants);
      const values = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        compareAtPrice: !hasVariants && hasCompareAt(form.compareAtPrice) ? Number(form.compareAtPrice) : null,
        stock: Number(form.stock),
        description: form.description.trim(),
        images: uploadedImages,
        image: uploadedImages.find((image) => image.isPrimary)?.url ?? "",
        status: form.status,
        hasVariants,
        variantGroups: hasVariants ? variantGroups : [],
        variants: hasVariants ? uploadedVariants.map((variant) => ({ ...variant, compareAtPrice: hasCompareAt(variant.compareAtPrice) ? Number(variant.compareAtPrice) : null })) : [],
      };
      if (isEdit) await productService.update(productId, values);
      else await productService.create({ storeId, ...values });
      await Promise.all([...removedStorageKeys.current]
        .filter((storageKey) => !images.some((image) => image.storageKey === storageKey)
          && !variants.some((variant) => variant.image?.storageKey === storageKey))
        .map(deleteProductImage));
      saved.current = true;
      navigate(`/merchant/stores/${storeId}/products`);
    } catch (error) {
      if (error?.message === "PRODUCT_IMAGE_MISSING") { setApiError(language === "id" ? "Foto tidak ditemukan di perangkat ini. Unggah ulang fotonya." : "Photo not found on this device. Please upload it again."); setSaving(false); return; }
      // Pesan rinci dari backend (berbahasa Indonesia) ditampilkan supaya penjual tahu isian mana yang salah.
      const detail = language === "id" && error.code === "VALIDATION_ERROR" && error.details && typeof error.details === "object" ? Object.values(error.details).find((value) => typeof value === "string") : "";
      setApiError(detail || errorMessage(error.code, t("productForm.saveFailed")));
    }
    finally { setSaving(false); }
  };

  if (loading) return <PageContainer><LoadingPanel label={t("productForm.loading")} rows={4} /></PageContainer>;

  if (notFound) {
    return <PageContainer><EmptyState title={t("productForm.notFound")} description={t("productForm.notFoundHint")} action={<Button as={Link} variant="secondary" to={`/merchant/stores/${storeId}/products`}>{t("productForm.backProducts")}</Button>}/></PageContainer>;
  }

  {
    const productsPath = `/merchant/stores/${storeId}/products`;
    const uploadInputId = `product-images-${productId ?? "new"}`;
    const sectionHeader = (title, description, side = null, titleId) => (
      <header className="merchant-edit-product__section-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        {side}
      </header>
    );

    return (
      <PageContainer as="main" className="merchant-edit-product">
        <PageHeader eyebrow={<Link className="hover:underline" to={productsPath}><span aria-hidden="true">←</span> {t("productForm.backProducts")}</Link>} title={t(isEdit ? "productForm.editTitle" : "productForm.createTitle")} description={isEdit ? `${existingProduct?.name ?? ""} • ${routeStore?.name ?? t("productForm.activeStore")}` : t("productForm.createSubtitle", { store: routeStore?.name ?? t("productForm.activeStore") })} />

        <form className="merchant-edit-product__form" onSubmit={handleSubmit} noValidate>
          {apiError && <div className="merchant-edit-product__api-error" role="alert"><strong>{t("productForm.saveFailed")}</strong><p>{apiError}</p></div>}

          <section className="merchant-edit-product__section" aria-labelledby="basic-information-title">
            <header className="merchant-edit-product__section-header"><div><h2 id="basic-information-title">{t("productForm.basicInformation")}</h2><p>{t("productForm.basicInformationHelp")}</p></div></header>
            <div className="merchant-edit-product__fields merchant-edit-product__fields--two">
              <label className="merchant-edit-product__field">
                <span>{t("productForm.name")}</span>
                <input name="name" value={form.name} onChange={handleChange} placeholder={t("productForm.namePlaceholder")} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "product-name-error" : undefined} />
                {errors.name && <small id="product-name-error">{errors.name}</small>}
              </label>
              <label className="merchant-edit-product__field">
                <span>{t("productForm.category")}</span>
                <select name="category" value={form.category} onChange={handleChange} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "product-category-error" : undefined}>
                  <option value="">{t("productForm.selectCategory")}</option>
                  {productCategories.map((category) => <option value={category} key={category}>{category}</option>)}
                </select>
                {errors.category && <small id="product-category-error">{errors.category}</small>}
              </label>
              <label className="merchant-edit-product__field merchant-edit-product__field--full">
                <span>{t("productForm.description")}</span>
                <textarea name="description" value={form.description} onChange={handleChange} rows="4" placeholder={t("productForm.descriptionPlaceholder")} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "product-description-error" : undefined} />
                {errors.description && <small id="product-description-error">{errors.description}</small>}
              </label>
            </div>
          </section>

          {!hasVariants && <section className="merchant-edit-product__section" aria-labelledby="pricing-inventory-title">
            <header className="merchant-edit-product__section-header"><div><h2 id="pricing-inventory-title">{t("productForm.pricingInventory")}</h2><p>{t("productForm.pricingInventoryHelp")}</p></div></header>
            <div className="merchant-edit-product__fields merchant-edit-product__fields--two">
              <label className="merchant-edit-product__field">
                <span>{t("productForm.price")}</span>
                <span className="merchant-edit-product__currency-input"><span>Rp</span><input name="price" type="number" min="1" value={form.price} onChange={handleChange} placeholder="0" aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "product-price-error" : undefined} /></span>
                {errors.price && <small id="product-price-error">{errors.price}</small>}
              </label>
              <label className="merchant-edit-product__field">
                <span>{compareCopy.label} <em className="font-medium not-italic text-[var(--kucur-text-muted)]">({compareCopy.optional})</em></span>
                <span className="merchant-edit-product__currency-input"><span>Rp</span><input name="compareAtPrice" type="number" min="1" value={form.compareAtPrice} onChange={handleChange} placeholder="0" aria-invalid={Boolean(errors.compareAtPrice)} aria-describedby={errors.compareAtPrice ? "product-compare-error" : "product-compare-help"} /></span>
                {errors.compareAtPrice ? <small id="product-compare-error">{errors.compareAtPrice}</small> : compareAtInvalid(form.compareAtPrice, form.price) && form.price !== "" ? <small id="product-compare-help" role="status">{compareCopy.mustBeHigher}</small> : discountPercent(form.compareAtPrice, form.price) ? <small id="product-compare-help" className="merchant-edit-product__hint" role="status">{compareCopy.discount.replace("{percent}", discountPercent(form.compareAtPrice, form.price))}</small> : <small id="product-compare-help" className="merchant-edit-product__help">{compareCopy.help}</small>}
              </label>
              <label className="merchant-edit-product__field">
                <span>{t("productForm.stock")}</span>
                <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} placeholder="0" aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? "product-stock-error" : undefined} />
                {errors.stock && <small id="product-stock-error">{errors.stock}</small>}
              </label>
            </div>
          </section>}

          <section className="merchant-edit-product__section" aria-labelledby="product-images-title">
            {sectionHeader(t("productForm.images"), t("productForm.imageHelp"), <strong className="merchant-edit-product__image-count" aria-label={t("productForm.imageCount", { count: images.length })}>{images.length} / 3</strong>, "product-images-title")}
            <input ref={productImageInput} className="merchant-edit-product__native-file" id={uploadInputId} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} disabled={processingImages || images.length >= 3} />
            <div className="merchant-edit-product__upload-zone">
              <span className="merchant-edit-product__upload-icon" aria-hidden="true">+</span>
              <strong>{t("productForm.addProductImages")}</strong>
              <p>{t("productForm.uploadPrompt")}</p>
              <div className="merchant-edit-product__upload-actions">
                <button className="merchant-edit-product__button merchant-edit-product__button--primary" type="button" disabled={processingImages || images.length >= 3} onClick={() => productImageInput.current?.click()}>{t(processingImages ? "productForm.processing" : "productForm.addImages")}</button>
                <button className="merchant-edit-product__button merchant-edit-product__button--secondary" type="button" disabled={processingImages || images.length >= 3} onClick={() => productImageInput.current?.click()}><span aria-hidden="true">▧</span>{t("productForm.chooseGallery")}</button>
              </div>
            </div>
            {imageError && <small className="merchant-edit-product__inline-error" role="alert">{imageError}</small>}
            {images.length > 0 && <div className="merchant-edit-product__image-grid">{images.map((image) => <article className="merchant-edit-product__image-tile" key={image.id}>
              <ProductImage image={image} product={existingProduct} alt={t("productForm.productPhoto")} />
              {image.isPrimary && <b>{t("productForm.cover")}</b>}
              <div className="merchant-edit-product__image-actions">
                {!image.isPrimary && <button type="button" onClick={() => setPrimaryImage(image.id)}>{t("productForm.makeCover")}</button>}
                <button type="button" className="merchant-edit-product__remove-image" onClick={() => removeImage(image.id)} aria-label={t("productForm.remove")}>×</button>
              </div>
            </article>)}</div>}
          </section>

          <section className="merchant-edit-product__section" aria-labelledby="variants-title">
            <div className="merchant-edit-product__setting-row">
              <div><h2 id="variants-title">{t("productForm.variants")}</h2><p>{t("productForm.variantsHelp")}</p></div>
              <label className="merchant-edit-product__switch"><input type="checkbox" role="switch" aria-label={t("productForm.hasVariants")} aria-checked={hasVariants} checked={hasVariants} onChange={(event) => { setHasVariants(event.target.checked); setVariantError(""); }} /><span aria-hidden="true" /><em>{hasVariants ? t("productForm.enabled") : t("productForm.disabled")}</em></label>
            </div>
            {hasVariants && <div className="merchant-edit-product__variant-editor">
              <div className="merchant-edit-product__variant-groups">{variantGroups.map((group) => <article className="merchant-edit-product__variant-group" key={group.id}>
                <div className="merchant-edit-product__variant-group-head"><input value={group.name} onChange={(event) => renameVariantGroup(group.id, event.target.value)} placeholder={t("productForm.variantNamePlaceholder")} /><button type="button" onClick={() => removeVariantGroup(group.id)}>{t("productForm.removeGroup")}</button></div>
                <div className="merchant-edit-product__option-list">{group.options.map((option) => <span key={option}>{option}<button type="button" aria-label={t("productForm.removeOption", { option })} onClick={() => removeVariantOption(group.id, option)}>×</button></span>)}</div>
                <div className="merchant-edit-product__add-option"><input value={optionDrafts[group.id] ?? ""} onChange={(event) => setOptionDrafts((current) => ({ ...current, [group.id]: event.target.value }))} placeholder={t("productForm.newOption")} /><button type="button" onClick={() => addVariantOption(group.id)}>{t("productForm.addOption")}</button></div>
              </article>)}</div>
              {variantGroups.length < 2 && <button className="merchant-edit-product__add-group" type="button" onClick={addVariantGroup}>{t("productForm.addGroup")}</button>}
              {variantError && <small className="merchant-edit-product__inline-error" role="alert">{variantError}</small>}
              {variants.length > 0 && <div className="merchant-edit-product__variant-list">{variants.map((variant) => {
                const variantName = Object.values(variant.options).join(" / ");
                const variantInputId = `variant-image-${variant.id}`;
                return <article className="merchant-edit-product__variant-card" key={variant.id}>
                  <header><div><strong>{variantName}</strong><small>{variant.sku}</small></div></header>
                  <div className="merchant-edit-product__variant-card-fields">
                    <div className="merchant-edit-product__variant-image">{variant.image && <ProductImage image={variant.image} alt={t("productForm.variantPhoto", { variant: variantName })} />}{variant.image ? <button type="button" onClick={() => removeVariantImage(variant.id)}>{t("productForm.removePhoto")}</button> : <><input className="merchant-edit-product__native-file" id={variantInputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadVariantImage(variant.id, event.target.files[0])} disabled={processingImages} /><label htmlFor={variantInputId}>{t("productForm.chooseVariantPhoto")}</label></>}</div>
                    <label className="merchant-edit-product__field"><span>{t("productForm.price")}</span><input type="number" min="1" value={variant.price} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} /></label>
                    <label className="merchant-edit-product__field"><span>{compareCopy.label}</span><input type="number" min="1" value={variant.compareAtPrice ?? ""} placeholder={compareCopy.optional} aria-invalid={compareAtInvalid(variant.compareAtPrice, variant.price)} onChange={(event) => updateVariant(variant.id, "compareAtPrice", event.target.value)} />{compareAtInvalid(variant.compareAtPrice, variant.price) ? <small role="status">{compareCopy.mustBeHigher}</small> : discountPercent(variant.compareAtPrice, variant.price) ? <small className="merchant-edit-product__hint" role="status">{compareCopy.discount.replace("{percent}", discountPercent(variant.compareAtPrice, variant.price))}</small> : null}</label>
                    <label className="merchant-edit-product__field"><span>{t("productForm.stock")}</span><input type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(variant.id, "stock", event.target.value)} /></label>
                    <label className="merchant-edit-product__field"><span>{t("productForm.status")}</span><select value={variant.status} onChange={(event) => updateVariant(variant.id, "status", event.target.value)}><option value="active">{t("productForm.active")}</option><option value="inactive">{t("productForm.inactive")}</option></select></label>
                  </div>
                </article>;
              })}</div>}
            </div>}
          </section>

          <section className="merchant-edit-product__section merchant-edit-product__status-section" aria-labelledby="status-title">
            <div><h2 id="status-title">{t("productForm.productStatus")}</h2><p>{t("productForm.statusHelp")}</p></div>
            <label><span className="sr-only">{t("productForm.productStatus")}</span><select name="status" value={form.status} onChange={handleChange}><option value="active">{t("productForm.active")}</option><option value="inactive">{t("productForm.inactive")}</option></select></label>
          </section>

          <footer className="merchant-edit-product__actions">
            <Link className="merchant-edit-product__button merchant-edit-product__button--secondary" to={productsPath}>{t("productForm.cancel")}</Link>
            <button className="merchant-edit-product__button merchant-edit-product__button--save" type="submit" disabled={saving || processingImages}>{t(saving ? "productForm.saving" : isEdit ? "productForm.saveChanges" : "productForm.save")}</button>
          </footer>
        </form>
      </PageContainer>
    );
  }

}

function ProductForm({ mode = "create" }) {
  const { storeId, productId } = useParams();
  const { stores } = useStore();
  const resolvedStoreId = canonicalStoreId(storeId);
  const routeStore = stores.find((store) => String(store.id) === resolvedStoreId);

  return (
    <ProductFormWorkspace
      key={`${mode}-${resolvedStoreId}-${productId ?? "new"}`}
      mode={mode}
      storeId={resolvedStoreId}
      productId={productId}
      routeStore={routeStore}
    />
  );
}

export default ProductForm;
