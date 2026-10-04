import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReviewList from "../../components/ReviewList";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { cartService } from "../../services/commerceService";
import { productService } from "../../services/productService";
import ProductImage from "../../components/ProductImage";
import { getPrimaryProductImage } from "../../services/productImageStorage";
import CartShortcut from "../../components/CartShortcut";
import { usePreferences } from "../../context/PreferencesContext";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";

function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { activeRole, isAuthenticated } = useAuth();
  const { formatCurrency, language, t } = usePreferences();
  const { startSellerChat } = useChat();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    let active = true;
    productService.get(productId).then((row) => { if (active) setProduct(row); }).catch((error) => {
      if (active) setLoadError(error.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  if (loading) return <PageContainer><LoadingPanel label={t("commerce.loadingProduct")} rows={5}/></PageContainer>;
  if (loadError || !product || product.status !== "active") {
    return <PageContainer><EmptyState title={t("commerce.unavailableTitle")} description={loadError || t("commerce.unavailableHint")} action={<Button as={Link} to="/products">{t("commerce.backToProducts")}</Button>}/></PageContainer>;
  }

  const store = product.store;
  const productImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image ? [{ id: "legacy", url: product.image, isPrimary: true }] : [];
  const selectedVariant = product.hasVariants ? (product.variants ?? []).find((variant) => (
    variant.status === "active" && (product.variantGroups ?? []).every((group) => variant.options?.[group.name] === selectedOptions[group.name])
  )) : null;
  const visualGroup = (product.variantGroups ?? []).find((group) => group.id === product.variantImageGroupId);
  const visualOption = visualGroup ? selectedOptions[visualGroup.name] : null;
  const legacyVariantImage = visualOption ? product.variantOptionImages?.[visualGroup.id]?.[visualOption] : null;
  const variantImage = selectedVariant?.image ?? legacyVariantImage;
  const galleryImages = variantImage ? [{ ...variantImage, id: `variant-${selectedVariant?.id ?? `${visualGroup.id}-${visualOption}`}`, variantLabel: Object.values(selectedVariant?.options ?? {}).join(" / ") || visualOption }, ...productImages] : productImages;
  const selectedImage = galleryImages.find((image) => image.id === selectedImageId)
    ?? variantImage
    ?? getPrimaryProductImage(product);
  const activeVariants = product.hasVariants ? (product.variants ?? []).filter((variant) => variant.status === "active") : [];
  const availableStock = product.hasVariants
    ? activeVariants.reduce((total, variant) => total + Math.max(Number(variant.stock) || 0, 0), 0)
    : Math.max(Number(product.stock) || 0, 0);
  const activePrices = [...new Set(activeVariants.map((variant) => Number(variant.price)).filter((price) => Number.isFinite(price) && price > 0))].sort((a, b) => a - b);
  const priceLabel = selectedVariant
    ? formatCurrency(selectedVariant.price)
    : product.hasVariants && activePrices.length > 1
      ? `${formatCurrency(activePrices[0])} - ${formatCurrency(activePrices.at(-1))}`
      : formatCurrency(product.hasVariants ? activePrices[0] ?? 0 : product.price);
  const selectedStock = product.hasVariants ? Number(selectedVariant?.stock ?? 0) : availableStock;
  const selectionComplete = !product.hasVariants || Boolean(selectedVariant);
  const purchaseDisabled = availableStock <= 0 || !selectionComplete;
  const changeQuantity = (next) => setQuantity(Math.min(Math.max(next, 1), selectedStock || 1));
  const handleAdd = async () => {
    if (!isAuthenticated) return navigate("/login");
    if (activeRole !== "customer") return navigate("/unauthorized");
    if (product.hasVariants && !selectedVariant) return setMessage(t("commerce.selectAllVariants"));
    try { await cartService.add({ productId: product.id, productVariantId: selectedVariant?.id, quantity }); setMessage(t("commerce.itemsAdded", { count: quantity })); }
    catch (error) { setMessage(error.message); }
  };
  const handleBuyNow = () => {
    if (!isAuthenticated) return navigate("/login");
    if (activeRole !== "customer") return navigate("/unauthorized");
    if (product.hasVariants && !selectedVariant) return setMessage(t("commerce.selectAllVariants"));
    if (selectedStock <= 0) return setMessage(t("commerce.currentlyOutOfStock"));
    const variantQuery = selectedVariant ? `&variantId=${encodeURIComponent(selectedVariant.id)}` : "";
    navigate(`/checkout?productId=${encodeURIComponent(product.id)}&quantity=${quantity}${variantQuery}`);
  };
  const handleSellerChat = async () => {
    if (!isAuthenticated) return navigate("/login");
    if (activeRole !== "customer") return navigate("/unauthorized");
    if (!store) return setMessage(t("commerce.storeUnavailable"));
    const conversation = await startSellerChat({ store, product });
    navigate(`/messages/${conversation.id}`);
  };

  const variantSelectors = product.hasVariants && <div className="grid gap-4 [&_fieldset]:min-w-0 [&_legend]:mb-2 [&_legend]:font-bold [&_fieldset>div]:flex [&_fieldset>div]:flex-wrap [&_fieldset>div]:gap-2 [&_button]:rounded-xl [&_button]:border [&_button]:border-[var(--kucur-border-strong)] [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button.active]:border-emerald-600 [&_button.active]:bg-emerald-50 [&_button.active]:text-emerald-800 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:bg-slate-100 [&_button:disabled]:text-slate-400">{(product.variantGroups ?? []).map((group) => <fieldset key={group.id}><legend>{group.name}</legend><div>{group.options.map((option) => { const available = (product.variants ?? []).some((variant) => variant.status === "active" && Number(variant.stock) > 0 && variant.options?.[group.name] === option && (product.variantGroups ?? []).every((otherGroup) => otherGroup.id === group.id || !selectedOptions[otherGroup.name] || variant.options?.[otherGroup.name] === selectedOptions[otherGroup.name])); return <button className={selectedOptions[group.name] === option ? "active" : ""} type="button" key={option} disabled={!available} onClick={() => { setSelectedOptions((current) => ({ ...current, [group.name]: option })); setSelectedImageId(null); setQuantity(1); setMessage(""); }}>{option}{selectedOptions[group.name] === option && <i aria-hidden="true">✓</i>}</button>; })}</div></fieldset>)}</div>;
  const purchaseActions = <div className="grid grid-cols-3 gap-2 [&_button]:min-w-0 [&_button]:rounded-xl [&_button]:px-2 [&_button]:py-3 [&_button]:text-sm [&_button]:font-bold [&_button:disabled]:cursor-not-allowed [&_button:disabled]:bg-slate-300"><button className="border border-emerald-600 text-emerald-700" type="button" onClick={handleSellerChat}>{t("commerce.chat")}</button><button className="border border-emerald-600 bg-emerald-50 text-emerald-800" type="button" onClick={handleAdd} disabled={purchaseDisabled}>{t("commerce.addCart")}</button><button className="bg-emerald-600 text-white" type="button" onClick={handleBuyNow} disabled={purchaseDisabled}>{t("commerce.buyNow")}</button></div>;
  const detailCopy = language === "id" ? { quantity: "Jumlah", remaining: "Tersisa", choose: "Pilih variasi", official: "Pembayaran Resmi Platform", officialHint: "Lakukan transaksi hanya melalui checkout platform.", description: "Deskripsi Produk", information: "Informasi Produk", category: "Kategori", sellerLocation: "Lokasi Penjual", reviews: "Ulasan" } : { quantity: "Quantity", remaining: "Remaining", choose: "Select a variant", official: "Official Platform Payment", officialHint: "Complete transactions only through the platform checkout.", description: "Product Description", information: "Product Information", category: "Category", sellerLocation: "Seller Location", reviews: "Reviews" };

  return <PageContainer className="space-y-6">
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.82fr)]">
      <section className="min-w-0"><div className="aspect-square max-w-full overflow-hidden rounded-2xl bg-slate-100 [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage key={selectedImage?.id ?? "fallback"} product={product} image={selectedImage} alt={product.name} /></div>{galleryImages.length > 1 && <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 [&_button]:h-16 [&_button]:w-16 [&_button]:shrink-0 [&_button]:overflow-hidden [&_button]:rounded-xl [&_button]:border-2 [&_button]:border-transparent [&_button.active]:border-emerald-600 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">{galleryImages.map((image) => <button className={image.id === selectedImage?.id || (!selectedImageId && image.storageKey === variantImage?.storageKey) ? "active" : ""} type="button" key={image.id} onClick={() => setSelectedImageId(image.id)}><ProductImage product={product} image={image} alt={image.variantLabel ?? ""} /></button>)}</div>}</section>
      <section className="grid min-w-0 content-start gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-6 [&_h1]:break-words [&_h1]:text-2xl [&_h1]:font-extrabold sm:[&_h1]:text-3xl">
        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{product.category}</span><h1>{product.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-[var(--kucur-text-muted)] [&_span:first-child]:font-bold [&_span:first-child]:text-amber-600"><span>★ 5.0</span><span>{t("commerce.reviewCount", { count: 1 })}</span></div>
        <strong className="break-words text-2xl font-extrabold text-emerald-700">{priceLabel}</strong>
        <p className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${availableStock <= 0 ? "bg-rose-100 text-rose-700" : "bg-[var(--kucur-surface-elevated)] text-[var(--kucur-text)]"}`}>{availableStock > 0 ? t("commerce.stock", { count: selectedVariant ? selectedStock : availableStock }) : t("commerce.outOfStock")}</p>
        {variantSelectors}
        {product.hasVariants && !selectedVariant && availableStock > 0 && <p className="text-sm font-medium text-amber-700">{t("commerce.selectVariantHint")}</p>}
        {selectedVariant && <div className="grid gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm [&_span]:text-emerald-700"><span>{t("commerce.selected")}</span><strong>{Object.values(selectedVariant.options).join(", ")}</strong><small>{t("commerce.availableStock", { count: selectedStock })}</small></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-4 [&>div:first-child]:grid [&_span]:text-sm [&_span]:text-[var(--kucur-text-muted)]"><div><strong>{detailCopy.quantity}</strong><span>{selectionComplete ? `${detailCopy.remaining} ${selectedStock}` : detailCopy.choose}</span></div><div className="flex items-center overflow-hidden rounded-xl border border-[var(--kucur-border-strong)] [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:text-slate-300 [&_strong]:min-w-9 [&_strong]:text-center"><button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1}>−</button><strong>{quantity}</strong><button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={!selectionComplete || quantity >= selectedStock}>+</button></div></div>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--kucur-surface-elevated)] p-3 [&>div]:grid [&_span]:text-sm [&_span]:text-[var(--kucur-text-muted)] [&_button]:rounded-lg [&_button]:border [&_button]:border-[var(--kucur-border-strong)] [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold"><div><strong>{store?.name ?? t("commerce.store")}</strong><span>{t("commerce.localProduct")}</span></div><button type="button" onClick={handleSellerChat}>{t("commerce.chatSeller")}</button></section>
        <div className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><strong>{detailCopy.official}</strong><span>{detailCopy.officialHint}</span></div>
        {purchaseActions}
        {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{message}</p>}
      </section>
    </div>
    <div className="grid gap-4 [&>section]:min-w-0 [&>section]:rounded-2xl [&>section]:border [&>section]:border-[var(--kucur-border)] [&>section]:bg-[var(--kucur-surface)] [&>section]:p-5 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold"><section><h2>{detailCopy.description}</h2><p className="whitespace-pre-wrap break-words leading-7 text-[var(--kucur-text)]">{product.description}</p></section><section><h2>{detailCopy.information}</h2><div className="grid gap-3 sm:grid-cols-2 [&>div]:grid [&_span]:text-sm [&_span]:text-[var(--kucur-text-muted)] [&_strong]:break-words"><div><span>{detailCopy.category}</span><strong>{product.category}</strong></div><div><span>{detailCopy.sellerLocation}</span><strong>{store?.address ?? "-"}</strong></div></div></section><section><h2>{detailCopy.reviews}</h2><ReviewList targetType="product" targetId={product.id}/></section></div>
    <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 -mx-4 grid gap-2 border-t border-[var(--kucur-border)] bg-[var(--kucur-surface)]/95 p-3 backdrop-blur md:bottom-0 lg:hidden"><div className="flex justify-end"><CartShortcut className="min-h-9 min-w-9" showLabel /></div>{purchaseActions}</div>
  </PageContainer>;
}

export default ProductDetail;
