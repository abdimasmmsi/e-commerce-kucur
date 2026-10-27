import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReviewList from "../../components/ReviewList";
import ProductCard from "../../components/customer/ProductCard";
import { productStockBadge } from "../../utils/productStock";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { cartService } from "../../services/commerceService";
import { getProductDisplayPrice, productService } from "../../services/productService";
import { addViewed } from "../../utils/browsingHistory";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { discountInfo } from "../../utils/discount";
import { getAverageRating, reviewService } from "../../services/reviewService";
import ProductImage from "../../components/ProductImage";
import { getPrimaryProductImage } from "../../services/productImageStorage";
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
  const [reviews, setReviews] = useState(null);
  const [moreProducts, setMoreProducts] = useState([]);
  const [restockWatching, setRestockWatching] = useState(false);

  useEffect(() => {
    let active = true;
    // Produk yang dibuka masuk "Terakhir dilihat" di panel cari (maks 5 tampil).
    productService.get(productId).then((row) => {
      if (!active) return;
      setProduct(row);
      if (row?.status !== "active") return;
      addViewed({ ...row, price: getProductDisplayPrice(row) });
      // Statistik "dilihat" untuk lapak: satu kali per produk per sesi supaya refresh tidak menggelembungkan angka.
      const viewKey = `kucur:viewed-product:${row.id}`;
      try { if (!sessionStorage.getItem(viewKey)) { sessionStorage.setItem(viewKey, "1"); void productService.recordView(row.id); } } catch { void productService.recordView(row.id); }
    }).catch((error) => {
      if (active) setLoadError(error.message);
    }).finally(() => { if (active) setLoading(false); });
    reviewService.publicForTarget("product", productId).then((result) => { if (active) setReviews((result.items || []).filter((review) => !review.isHidden)); }).catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [productId]);
  // Stok/harga/ulasan diperbarui diam-diam; jumlah, varian, dan gambar pilihan tetap.
  useLiveRefresh(() => Promise.all([
    productService.get(productId).then((row) => { if (row) setProduct(row); }).catch(() => {}),
    reviewService.publicForTarget("product", productId).then((result) => setReviews((result.items || []).filter((review) => !review.isHidden))).catch(() => {}),
  ]));

  // Status "Ingatkan saya" hanya relevan untuk customer yang login.
  const canWatchRestock = isAuthenticated && activeRole === "customer";
  useEffect(() => {
    if (!canWatchRestock) return undefined;
    let active = true;
    productService.restockStatus(productId).then((watching) => { if (active) setRestockWatching(watching); }).catch(() => {});
    return () => { active = false; };
  }, [canWatchRestock, productId]);

  // "Produk lain dari lapak ini": terlaris dulu, tanpa produk yang sedang dibuka.
  const productStoreId = product?.storeId;
  useEffect(() => {
    if (!productStoreId) return undefined;
    let active = true;
    productService.list({ storeId: productStoreId }).then((rows) => { if (active) setMoreProducts(rows.filter((row) => row.id !== productId).sort((a, b) => b.soldCount - a.soldCount).slice(0, 4)); }).catch(() => { if (active) setMoreProducts([]); });
    return () => { active = false; };
  }, [productId, productStoreId]);

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
  const discount = product.hasVariants && !selectedVariant ? discountInfo(product) : discountInfo(product, selectedVariant ?? null);
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
  const toggleRestock = async () => {
    if (!isAuthenticated) return navigate("/login");
    if (activeRole !== "customer") return navigate("/unauthorized");
    try { const watching = await productService.setRestockWatch(product.id, !restockWatching); setRestockWatching(watching); setMessage(watching ? copy.restockOn : copy.restockOff); }
    catch (error) { setMessage(error.message); }
  };
  // Bagikan ke WhatsApp: pakai menu bagikan bawaan HP kalau ada, kalau tidak buka wa.me.
  const shareProduct = async () => {
    const url = window.location.href;
    const text = `${product.name} - ${priceLabel}`;
    if (navigator.share) { try { await navigator.share({ title: product.name, text, url }); return; } catch (error) { if (error?.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}
${url}`)}`, "_blank", "noopener");
  };
  const handleSellerChat = async () => {
    if (!isAuthenticated) return navigate("/login");
    if (activeRole !== "customer") return navigate("/unauthorized");
    if (!store) return setMessage(t("commerce.storeUnavailable"));
    const conversation = await startSellerChat({ store, product });
    navigate(`/messages/${conversation.id}`);
  };

  const optionAvailable = (group, option) => (product.variants ?? []).some((variant) => variant.status === "active" && Number(variant.stock) > 0 && variant.options?.[group.name] === option && (product.variantGroups ?? []).every((otherGroup) => otherGroup.id === group.id || !selectedOptions[otherGroup.name] || variant.options?.[otherGroup.name] === selectedOptions[otherGroup.name]));
  const variantSelectors = product.hasVariants && <div className="grid gap-4">{(product.variantGroups ?? []).map((group) => <fieldset className="min-w-0" key={group.id}><legend className="mb-2 text-[15px] font-bold">{group.name}</legend><div className="flex flex-wrap gap-2">{group.options.map((option) => { const active = selectedOptions[group.name] === option; return <button className={`min-h-11 rounded-xl border px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${active ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)] hover:border-[var(--kucur-green)]"}`} type="button" key={option} aria-pressed={active} disabled={!optionAvailable(group, option)} onClick={() => { setSelectedOptions((current) => ({ ...current, [group.name]: option })); setSelectedImageId(null); setQuantity(1); setMessage(""); }}>{option}</button>; })}</div></fieldset>)}</div>;
  const actionClass = "inline-flex min-h-12 min-w-0 items-center justify-center whitespace-nowrap rounded-xl border px-2.5 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-3";
  const purchaseActions = <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.25fr)] gap-2"><button className={`${actionClass} border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]`} type="button" onClick={handleSellerChat}>{t("commerce.chat")}</button>{availableStock <= 0 && (!isAuthenticated || activeRole === "customer") ? <button className={`${actionClass} col-span-2 whitespace-normal ${restockWatching ? "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]" : "border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-on-green)]"}`} type="button" aria-pressed={restockWatching} onClick={toggleRestock}>{restockWatching ? copy.restockActive : copy.restock}</button> : <><button className={`${actionClass} border-[var(--kucur-green)] bg-[var(--kucur-surface)] text-[var(--kucur-green-ink)]`} type="button" onClick={handleAdd} disabled={purchaseDisabled}>{t("commerce.addCart")}</button><button className={`${actionClass} border-[var(--kucur-green)] bg-[var(--kucur-green)] text-[var(--kucur-on-green)]`} type="button" onClick={handleBuyNow} disabled={purchaseDisabled}>{t("commerce.buyNow")}</button></>}</div>;
  const copy = language === "id"
    ? { quantity: "Jumlah", remaining: "Sisa {count}", choose: "Pilih varian dulu", safe: "Bayar tunai saat barang sampai. Jangan transfer langsung ke penjual.", description: "Deskripsi", information: "Info produk", category: "Kategori", sellerLocation: "Lokasi lapak", sold: "{count} terjual", visitStore: "Kunjungi lapak", moreFromStore: "Produk lain dari {store}", seeStore: "Lihat lapak", reviews: "Ulasan pembeli", noReviews: "Belum ada ulasan", decrease: "Kurangi jumlah", increase: "Tambah jumlah", share: "Bagikan", shareLabel: "Bagikan produk ke WhatsApp", discount: "Hemat {percent}%", restock: "Ingatkan saya saat stok ada", restockActive: "Batal ingatkan", restockOn: "Siap! Kamu akan dapat notifikasi saat stok tersedia lagi.", restockOff: "Pengingat stok dibatalkan." }
    : { quantity: "Quantity", remaining: "{count} left", choose: "Choose a variant first", safe: "Pay cash when your order arrives. Never transfer directly to the seller.", description: "Description", information: "Product info", category: "Category", sellerLocation: "Store location", sold: "{count} sold", visitStore: "Visit store", moreFromStore: "More from {store}", seeStore: "View store", reviews: "Customer reviews", noReviews: "No reviews yet", decrease: "Decrease quantity", increase: "Increase quantity", share: "Share", shareLabel: "Share product on WhatsApp", discount: "Save {percent}%", restock: "Remind me when back in stock", restockActive: "Cancel reminder", restockOn: "Done! You will be notified when it is back in stock.", restockOff: "Stock reminder cancelled." };
  const average = reviews?.length ? getAverageRating(reviews) : null;
  const stockText = availableStock <= 0 ? t("commerce.outOfStock") : selectionComplete ? copy.remaining.replace("{count}", selectedStock) : copy.choose;

  // HP: tiap bagian jadi lembar putih selebar layar (tanpa kartu bertumpuk); desktop tetap dua kolom.
  const sheet = "max-lg:-mx-4 max-lg:!max-w-none max-lg:bg-[var(--kucur-surface)] max-lg:px-4 max-lg:py-4 sm:max-lg:-mx-6 sm:max-lg:px-6";
  const sectionClass = `${sheet} min-w-0 lg:rounded-xl lg:border lg:border-[var(--kucur-border)] lg:bg-[var(--kucur-surface)] lg:p-5`;

  return <PageContainer className="space-y-2 pb-28 !pt-0 lg:space-y-6 lg:!pt-10 lg:pb-10">
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)] lg:gap-6">
      <section className="min-w-0">
        <div className="-mx-4 aspect-square !max-w-none overflow-hidden bg-[var(--kucur-surface-elevated)] sm:-mx-6 lg:mx-0 lg:!max-w-full lg:rounded-xl [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage key={selectedImage?.id ?? "fallback"} product={product} image={selectedImage} alt={product.name} /></div>
        {galleryImages.length > 1 && <div className={`${sheet} flex max-w-full gap-2 overflow-x-auto max-lg:!py-3 lg:mt-3 lg:pb-1`}>{galleryImages.map((image) => { const active = image.id === selectedImage?.id || (!selectedImageId && image.storageKey === variantImage?.storageKey); return <button className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${active ? "border-[var(--kucur-green)]" : "border-transparent"}`} type="button" key={image.id} aria-pressed={active} onClick={() => setSelectedImageId(image.id)}><ProductImage product={product} image={image} alt={image.variantLabel ?? ""} /></button>; })}</div>}
      </section>
      <div className="grid min-w-0 content-start gap-2 lg:gap-0 lg:self-start lg:overflow-hidden lg:rounded-xl lg:border lg:border-[var(--kucur-border)] lg:bg-[var(--kucur-surface)] lg:[&>*]:px-6 lg:[&>*]:py-4 lg:[&>*+*]:border-t lg:[&>*+*]:border-[var(--kucur-border)]">
        <div className={`${sheet} grid gap-1 lg:!pt-6`}>
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="grid min-w-0 gap-1"><strong className="break-words text-2xl font-extrabold tracking-[-0.02em] text-[var(--kucur-text)] sm:text-[28px]">{priceLabel}</strong>{discount && <span className="flex flex-wrap items-center gap-2 text-sm"><s className="text-[var(--kucur-text-muted)]">{formatCurrency(discount.compareAt)}</s><span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{copy.discount.replace("{percent}", discount.percent)}</span></span>}</div><button className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold text-[var(--kucur-text)] hover:border-[var(--kucur-green)]" type="button" data-no-busy aria-label={copy.shareLabel} onClick={shareProduct}><svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>{copy.share}</button></div>
          <h1 className="break-words text-lg font-bold leading-snug text-[var(--kucur-text)] sm:text-xl">{product.name}</h1>
          <a className="flex w-fit flex-wrap items-center gap-x-1 text-sm text-[var(--kucur-text-muted)] hover:underline" href="#product-reviews">{average ? <><svg className="size-4 text-[var(--kucur-amber)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z"/></svg><span className="font-bold text-[var(--kucur-text)]">{Number(average).toLocaleString(language === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> ({t("commerce.reviewCount", { count: reviews.length })})</> : copy.noReviews}{product.soldCount > 0 && <> · {copy.sold.replace("{count}", product.soldCount.toLocaleString(language === "id" ? "id-ID" : "en-US"))}</>}</a>
        </div>
        <div className={`${sheet} grid gap-4`}>
          {variantSelectors}
          {product.hasVariants && !selectedVariant && availableStock > 0 && <p className="text-[15px] font-medium text-[var(--kucur-amber-ink)]">{t("commerce.selectVariantHint")}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid"><strong className="text-[15px]">{copy.quantity}</strong><span className={`text-sm ${availableStock <= 0 ? "font-bold text-rose-700 dark:text-rose-300" : "text-[var(--kucur-text-muted)]"}`}>{stockText}</span></div>
            <div className="flex items-center overflow-hidden rounded-xl border border-[var(--kucur-border-strong)]"><button className="grid size-12 place-items-center text-xl font-bold disabled:opacity-30" type="button" aria-label={copy.decrease} onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1}>−</button><strong className="min-w-10 text-center text-lg" aria-live="polite">{quantity}</strong><button className="grid size-12 place-items-center text-xl font-bold disabled:opacity-30" type="button" aria-label={copy.increase} onClick={() => changeQuantity(quantity + 1)} disabled={!selectionComplete || quantity >= selectedStock}>+</button></div>
          </div>
        </div>
        <p className={`${sheet} flex gap-3 text-sm leading-6 text-[var(--kucur-text-muted)]`}><svg className="mt-0.5 size-5 shrink-0 text-[var(--kucur-green-ink)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>{copy.safe}</p>
        <div className={`${sheet} flex min-w-0 items-center justify-between gap-3`}>
          <Link className="group/store flex min-h-11 min-w-0 flex-1 items-center gap-3" to={`/stores/${product.storeId}`}><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--kucur-brand)] text-lg font-extrabold text-[var(--kucur-on-brand)]" aria-hidden="true">{(store?.name ?? "?").trim().charAt(0).toUpperCase()}</span><span className="grid min-w-0"><strong className="block truncate text-[15px] group-hover/store:underline">{store?.name ?? t("commerce.store")}</strong><span className="block truncate text-[13px] font-bold text-[var(--kucur-green-ink)]">{copy.visitStore} ›</span></span></Link>
          <button className="min-h-11 shrink-0 rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold text-[var(--kucur-green-ink)] hover:border-[var(--kucur-green)]" type="button" onClick={handleSellerChat}>{t("commerce.chatSeller")}</button>
        </div>
        <div className="hidden lg:block">{purchaseActions}</div>
        {message && <p className={`${sheet} max-lg:!py-3`} role="status"><span className="block rounded-xl bg-[var(--kucur-green-soft)] p-3 text-[15px] font-semibold text-[var(--kucur-text)]">{message}</span></p>}
      </div>
    </div>
    <div className="grid gap-2 lg:grid-cols-2 lg:gap-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-extrabold lg:[&_h2]:text-lg">
      <section className={sectionClass}><h2>{copy.description}</h2><p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[var(--kucur-text)]">{product.description}</p></section>
      <section className={sectionClass}><h2>{copy.information}</h2><dl className="grid gap-3 text-[15px] [&>div]:grid [&_dt]:text-sm [&_dt]:text-[var(--kucur-text-muted)] [&_dd]:m-0 [&_dd]:break-words [&_dd]:font-semibold"><div><dt>{copy.category}</dt><dd>{product.category}</dd></div><div><dt>{copy.sellerLocation}</dt><dd>{store?.location?.address || store?.address || t("merchantOrderDetail.unavailableValue")}</dd></div></dl></section>
      <section className={`${sectionClass} lg:col-span-2`} id="product-reviews"><h2>{copy.reviews}</h2><ReviewList reviews={reviews ?? []}/></section>
    </div>
    {moreProducts.length > 0 && <section className="grid gap-2 pt-4 lg:gap-3 lg:pt-0" aria-labelledby="more-from-store">
      <div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 text-lg font-extrabold" id="more-from-store">{copy.moreFromStore.replace("{store}", store?.name ?? t("commerce.store"))}</h2><Link className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-[var(--kucur-green-ink)]" to={`/stores/${product.storeId}`}>{copy.seeStore} ›</Link></div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">{moreProducts.map((row) => <ProductCard key={row.id} product={row} storeName={store?.name ?? t("commerce.store")} price={row.hasVariants ? t("commerce.startsFrom", { price: formatCurrency(getProductDisplayPrice(row)) }) : formatCurrency(row.price)} {...productStockBadge(row, t)}/>)}</div>
    </section>}
    <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-20 border-t border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-3 py-2.5 md:bottom-0 lg:hidden">{purchaseActions}</div>
  </PageContainer>;
}

export default ProductDetail;
