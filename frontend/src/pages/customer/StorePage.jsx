import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ProductCard from "../../components/customer/ProductCard";
import { CustomerEmpty, CustomerLinkButton, CustomerLoading, CustomerPage } from "../../components/customer/CustomerUI";
import LocationMap from "../../components/location/LocationMap";
import ReviewList from "../../components/ReviewList";
import { usePreferences } from "../../context/PreferencesContext";
import { getProductDisplayPrice, productService } from "../../services/productService";
import { reviewService } from "../../services/reviewService";
import { productStockBadge } from "../../utils/productStock";
import { useLiveRefresh } from "../../utils/liveRefresh";

const REVIEW_PREVIEW = 3;

// Halaman lapak untuk pembeli: siapa penjualnya, di mana, seberapa dipercaya, dan semua produknya.
export default function StorePage() {
  const { storeId } = useParams();
  const { formatCurrency, language, t } = usePreferences();
  const copy = language === "id" ? {
    loading: "Memuat lapak...", missingTitle: "Lapak tidak ditemukan", missingHint: "Lapak mungkin sedang tutup atau belum aktif.", back: "Lihat semua produk",
    since: "Lapak warga Desa Kucur sejak {date}", rating: "Rating", reviews: "{count} ulasan", noRating: "Belum ada", sold: "Terjual", products: "Produk",
    productsTitle: "Produk dari lapak ini", noProducts: "Lapak ini belum punya produk aktif.", location: "Lokasi lapak",
    reviewsTitle: "Ulasan pembeli", noReviews: "Belum ada ulasan untuk lapak ini.", showAll: "Lihat semua ulasan ({count})", showLess: "Tampilkan lebih sedikit",
  } : {
    loading: "Loading store...", missingTitle: "Store not found", missingHint: "The store may be closed or not active yet.", back: "See all products",
    since: "Kucur village store since {date}", rating: "Rating", reviews: "{count} reviews", noRating: "None yet", sold: "Sold", products: "Products",
    productsTitle: "Products from this store", noProducts: "This store has no active products yet.", location: "Store location",
    reviewsTitle: "Customer reviews", noReviews: "No reviews for this store yet.", showAll: "Show all reviews ({count})", showLess: "Show fewer",
  };
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState(false);

  useEffect(() => {
    let active = true;
    productService.publicStore(storeId).then((row) => { if (active) { setStore(row); setError(""); } }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    reviewService.publicForStore(storeId).then((result) => { if (active) setReviews((result?.items ?? result ?? []).filter((review) => !review.isHidden)); }).catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [storeId]);
  // Produk/stok/ulasan lapak diperbarui diam-diam; galat diabaikan.
  useLiveRefresh(() => Promise.all([
    productService.publicStore(storeId).then((row) => { if (row) setStore(row); }).catch(() => {}),
    reviewService.publicForStore(storeId).then((result) => setReviews((result?.items ?? result ?? []).filter((review) => !review.isHidden))).catch(() => {}),
  ]));

  // Produk terlaris di depan, stok habis paling belakang.
  const products = useMemo(() => [...(store?.products ?? [])].sort((a, b) => Number(productStockBadge(a, t).stockTone === "out") - Number(productStockBadge(b, t).stockTone === "out") || b.soldCount - a.soldCount || a.name.localeCompare(b.name)), [store, t]);

  if (loading) return <CustomerPage><CustomerLoading label={copy.loading} count={4}/></CustomerPage>;
  if (error || !store) return <CustomerPage><CustomerEmpty title={copy.missingTitle} description={copy.missingHint} action={<CustomerLinkButton to="/products">{copy.back}</CustomerLinkButton>}/></CustomerPage>;

  const locale = language === "id" ? "id-ID" : "en-US";
  const since = store.createdAt ? new Date(store.createdAt).toLocaleDateString(locale, { month: "long", year: "numeric" }) : "";
  const hasRating = store.ratingCount > 0;
  const stat = (label, value, hint) => <div className="grid min-w-0 justify-items-center gap-0.5 px-1 text-center"><strong className="text-lg font-extrabold leading-tight">{value}</strong><span className="text-[13px] text-[var(--kucur-text-muted)]">{hint ?? label}</span></div>;
  const card = "min-w-0 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5";

  return <CustomerPage className="space-y-5">
    <section className={`${card} grid gap-4`}>
      <div className="flex min-w-0 items-center gap-3">
        {store.image ? <img className="size-16 shrink-0 rounded-2xl object-cover" src={store.image} alt=""/> : <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--kucur-green-soft)] text-2xl font-extrabold text-[var(--kucur-green-ink)]" aria-hidden="true">{store.name.trim().charAt(0).toUpperCase()}</span>}
        <div className="grid min-w-0 gap-0.5"><h1 className="break-words text-xl font-extrabold leading-tight sm:text-2xl">{store.name}</h1>{since && <span className="text-sm text-[var(--kucur-text-muted)]">{copy.since.replace("{date}", since)}</span>}</div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--kucur-border)] rounded-xl bg-[var(--kucur-surface-muted)] py-3">
        {stat(copy.rating, hasRating ? <span className="inline-flex items-center gap-1"><span className="text-amber-500" aria-hidden="true">★</span>{Number(store.ratingAverage).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> : "–", hasRating ? copy.reviews.replace("{count}", store.ratingCount) : `${copy.rating}: ${copy.noRating}`)}
        {stat(copy.sold, store.soldCount.toLocaleString(locale))}
        {stat(copy.products, store.productCount.toLocaleString(locale))}
      </div>
      {store.description && <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{store.description}</p>}
    </section>

    <section className="grid gap-3" aria-labelledby="store-products">
      <h2 className="text-lg font-extrabold" id="store-products">{copy.productsTitle}</h2>
      {products.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard key={product.id} product={product} storeName={store.name} price={product.hasVariants ? t("commerce.startsFrom", { price: formatCurrency(getProductDisplayPrice(product)) }) : formatCurrency(product.price)} {...productStockBadge(product, t)}/>)}</div>
        : <p className={`${card} text-center text-[15px] text-[var(--kucur-text-muted)]`}>{copy.noProducts}</p>}
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <LocationMap location={store.location} title={copy.location}/>
      <section className={card} aria-labelledby="store-reviews">
        <h2 className="mb-2 text-lg font-extrabold" id="store-reviews">{copy.reviewsTitle}</h2>
        {reviews.length ? <><ReviewList reviews={reviews} limit={allReviews ? null : REVIEW_PREVIEW}/>{reviews.length > REVIEW_PREVIEW && <button className="mt-3 min-h-11 rounded-xl border border-[var(--kucur-border-strong)] px-4 text-sm font-bold" type="button" onClick={() => setAllReviews((value) => !value)}>{allReviews ? copy.showLess : copy.showAll.replace("{count}", reviews.length)}</button>}</> : <p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.noReviews}</p>}
      </section>
    </div>
  </CustomerPage>;
}
