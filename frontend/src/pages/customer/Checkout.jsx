import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import PageContainer from "../../components/ui/PageContainer";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { cartService, checkoutApi } from "../../services/commerceService";
import { calculateCoordinateDistanceKm } from "../../services/deliveryFeeService";
import { getDrivingDistanceKm, isOpenRouteServiceConfigured } from "../../services/openRouteService";
import { productService } from "../../services/productService";
import { shortOrderCode } from "../../utils/orderCode";

const makeKey = () => globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tipOptions = [0, 2000, 5000, 10000];
const fieldClass = "min-h-12 w-full min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5 text-base text-[var(--kucur-text)]";
const cardClass = "grid min-w-0 gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5";

export default function Checkout() {
  const { user } = useAuth();
  const { formatCurrency, t } = usePreferences();
  const [searchParams] = useSearchParams();
  const [selection, setSelection] = useState({ cart: null, direct: null });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [created, setCreated] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState(user.fullName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(user.phone ?? "");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [courierTip, setCourierTip] = useState(0);
  const [location, setLocation] = useState({ status: "locating", latitude: null, longitude: null });
  const [confirmedRequest, setConfirmedRequest] = useState(null);
  const previewRun = useRef(0);
  const directInput = useMemo(() => {
    const productId = searchParams.get("productId");
    if (!productId) return null;
    return { productId, productVariantId: searchParams.get("variantId") || undefined, quantity: Math.max(1, Math.floor(Number(searchParams.get("quantity")) || 1)) };
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const load = directInput
      ? productService.get(directInput.productId).then((product) => ({ direct: { ...directInput, product }, cart: null }))
      : cartService.get().then((cart) => ({ cart, direct: null }));
    load.then((value) => { if (active) setSelection(value); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [directInput]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setLocation({ status: "missing", latitude: null, longitude: null }); return; }
    setLocation((current) => ({ ...current, status: "locating" }));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ status: "found", latitude: coords.latitude, longitude: coords.longitude }),
      () => setLocation({ status: "missing", latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);
  useEffect(() => { queueMicrotask(locate); }, [locate]);

  const items = useMemo(() => selection.direct
    ? [{ ...selection.direct, id: "direct", product: selection.direct.product, variant: selection.direct.product.variants?.find((row) => row.id === selection.direct.productVariantId) }]
    : selection.cart?.items ?? [], [selection]);
  const groups = useMemo(() => Object.values(items.reduce((map, item) => { const key = String(item.product?.storeId ?? item.storeId); map[key] ??= { store: item.product?.store, items: [] }; map[key].items.push(item); return map; }, {})), [items]);
  const request = useMemo(() => ({
    ...(selection.direct ? { items: [{ productId: selection.direct.productId, productVariantId: selection.direct.productVariantId, quantity: selection.direct.quantity }] } : { cartItemIds: items.map((item) => item.id) }),
    recipientName, recipientPhone, deliveryAddress: address, paymentMethod, courierTip, delivery: { address, recipientName, recipientPhone },
  }), [address, courierTip, items, paymentMethod, recipientName, recipientPhone, selection.direct]);
  const ready = Boolean(items.length && address.trim() && recipientName.trim() && recipientPhone.trim() && location.status === "found");

  // Total dihitung otomatis setiap data penting berubah, jadi pembeli cukup menekan satu tombol.
  useEffect(() => {
    if (!ready) return undefined;
    const run = ++previewRun.current;
    const timer = setTimeout(async () => {
      setCalculating(true); setError("");
      const destination = { lat: location.latitude, lng: location.longitude };
      try {
        const stores = [...new Map(items.map((item) => [item.product?.storeId, item.product?.store]).filter(([id, store]) => id && store)).entries()];
        const distancesByStore = Object.fromEntries(await Promise.all(stores.map(async ([storeId, store]) => {
          const origin = { lat: Number(store.location?.latitude ?? store.coordinates?.lat), lng: Number(store.location?.longitude ?? store.coordinates?.lng) };
          if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) throw new Error(t("checkout.storeCoordinatesMissing", { store: store.name }));
          let distance = isOpenRouteServiceConfigured ? await getDrivingDistanceKm(origin, destination) : null;
          if (!Number.isFinite(distance)) distance = calculateCoordinateDistanceKm(origin, destination);
          if (!Number.isFinite(distance) || distance < 0) throw new Error(t("checkout.distanceMissing", { store: store.name }));
          return [storeId, distance];
        })));
        const nextRequest = { ...request, delivery: { ...request.delivery, latitude: destination.lat, longitude: destination.lng, location: { label: address, address, latitude: destination.lat, longitude: destination.lng, source: isOpenRouteServiceConfigured ? "openrouteservice" : "coordinates" }, distancesByStore } };
        const result = await checkoutApi.preview(nextRequest);
        if (run === previewRun.current) { setPreview(result); setConfirmedRequest(nextRequest); }
      } catch (caught) { if (run === previewRun.current) { setPreview(null); setConfirmedRequest(null); setError(caught.message); } }
      finally { if (run === previewRun.current) setCalculating(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [address, items, location.latitude, location.longitude, ready, request, t]);

  const submit = async () => {
    if (!preview || !confirmedRequest || submitting || calculating) return;
    setSubmitting(true); setError("");
    try { const result = await checkoutApi.create(confirmedRequest, makeKey()); setCreated(result.orders ?? []); if (!selection.direct) void cartService.get().catch(() => null); }
    catch (caught) { setError(caught.message); setPreview(null); setConfirmedRequest(null); }
    finally { setSubmitting(false); }
  };
  const resetPreview = () => { setPreview(null); setConfirmedRequest(null); };

  if (created.length) {
    const totalToPay = created.reduce((sum, order) => sum + Number(order.totalAmount ?? order.grandTotal ?? 0), 0);
    return <PageContainer><section className="mx-auto grid max-w-lg justify-items-center gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-6 text-center sm:p-8">
      <span className="grid size-16 place-items-center rounded-full bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" aria-hidden="true"><svg className="size-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>
      <div className="grid gap-1"><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{t("checkout.success")}</span><h1 className="text-2xl font-extrabold">{t("checkout.successTitle")}</h1><p className="text-[15px] text-[var(--kucur-text-muted)]">{t("checkout.ordersCreated", { count: created.length })}</p></div>
      {totalToPay > 0 && <p className="w-full rounded-xl bg-[var(--kucur-green-soft)] p-3 text-[15px] font-semibold">{t("checkout.successPay", { amount: formatCurrency(totalToPay) })}</p>}
      <div className="flex flex-wrap justify-center gap-2">{created.map((order) => <Link className="rounded-full border border-[var(--kucur-border-strong)] px-3 py-1.5 text-sm font-bold" to={`/orders/${order.id}`} key={order.id}>{shortOrderCode(order.orderCode ?? order.orderNumber)}</Link>)}</div>
      <div className="grid w-full gap-2 sm:grid-cols-2"><Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-4 font-bold text-[var(--kucur-forest-dark)]" to="/orders">{t("checkout.viewOrders")}</Link><Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] px-4 font-bold" to="/products">{t("checkout.shopMore")}</Link></div>
    </section></PageContainer>;
  }

  const actionLabel = submitting ? t("checkout.processing") : calculating ? t("checkout.calculating") : preview ? t("checkout.createOrder") : t("checkout.completeData");
  const actionDisabled = !preview || submitting || calculating;
  const totalLine = <div className="grid"><span className="text-[13px] text-[var(--kucur-text-muted)]">{t("checkout.payTotal")}</span><strong className="text-xl font-extrabold">{preview ? formatCurrency(preview.grandTotal) : "–"}</strong></div>;
  const actionButton = <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-5 text-base font-bold text-[var(--kucur-forest-dark)] border border-transparent disabled:cursor-not-allowed disabled:border-[var(--kucur-border-strong)] disabled:bg-[var(--kucur-surface-muted)] disabled:text-[var(--kucur-text-muted)]" type="button" disabled={actionDisabled} onClick={submit}>{actionLabel}</button>;

  return <PageContainer className="space-y-5 pb-28 lg:pb-0">
    <header><h1 className="text-2xl font-extrabold">{t(selection.direct ? "checkout.directTitle" : "checkout.title")}</h1></header>
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}
    {loading ? <div className="rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-8 text-center">{t("checkout.loading")}</div> : <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
      <main className="grid min-w-0 gap-4">
        <section className={cardClass} aria-labelledby="checkout-recipient">
          <h2 className="text-lg font-extrabold" id="checkout-recipient">{t("checkout.recipient")}</h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-[15px] font-semibold">{t("checkout.recipientName")}<input className={fieldClass} autoComplete="name" value={recipientName} onChange={(event) => { setRecipientName(event.target.value); resetPreview(); }}/></label>
            <label className="grid min-w-0 gap-1.5 text-[15px] font-semibold">{t("checkout.phone")}<input className={fieldClass} type="tel" inputMode="tel" autoComplete="tel" value={recipientPhone} onChange={(event) => { setRecipientPhone(event.target.value); resetPreview(); }}/></label>
          </div>
          <label className="grid min-w-0 gap-1.5 text-[15px] font-semibold">{t("checkout.address")}<textarea className={fieldClass} rows="3" placeholder={t("checkout.addressPlaceholder")} value={address} onChange={(event) => { setAddress(event.target.value); resetPreview(); }}/></label>
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${location.status === "found" ? "bg-[var(--kucur-green-soft)]" : "bg-amber-50 dark:bg-amber-950/50"}`} role="status">
            <div className="flex min-w-0 items-start gap-2"><svg className={`mt-0.5 size-5 shrink-0 ${location.status === "found" ? "text-[var(--kucur-green-ink)]" : "text-amber-700 dark:text-amber-300"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg><div className="min-w-0"><strong className="block text-[15px]">{t("checkout.locationTitle")}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{location.status === "found" ? t("checkout.locationFound") : location.status === "locating" ? t("checkout.locationLocating") : t("checkout.locationMissing")}</span></div></div>
            {location.status !== "found" && <button className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-4 text-sm font-bold disabled:opacity-50" type="button" disabled={location.status === "locating"} onClick={locate}>{t("checkout.useLocation")}</button>}
          </div>
        </section>

        <section className={cardClass} aria-labelledby="checkout-products">
          <h2 className="text-lg font-extrabold" id="checkout-products">{t("checkout.products")}</h2>
          {groups.map((group) => <div className="grid gap-3" key={group.store?.id ?? group.items[0].id}>
            <strong className="text-[15px] text-[var(--kucur-text-muted)]">{group.store?.name ?? t("commerce.store")}</strong>
            {group.items.map((item) => <div className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3" key={item.id}>
              <div className="size-14 overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ProductImage product={item.product} image={item.variant?.image} alt=""/></div>
              <div className="min-w-0"><span className="block break-words text-[15px] font-semibold">{item.product?.name}</span><span className="text-sm text-[var(--kucur-text-muted)]">{item.variant ? `${Object.values(item.variant.options ?? {}).join(" · ")} · ` : ""}× {item.quantity}</span></div>
              <strong className="text-[15px]">{formatCurrency((item.unitPrice ?? item.variant?.price ?? item.product?.price) * item.quantity)}</strong>
            </div>)}
          </div>)}
          {!items.length && <div className="grid gap-2 text-center"><p>{t("checkout.emptyCart")}</p><Link className="font-bold text-[var(--kucur-green-ink)]" to="/products">{t("checkout.findProducts")}</Link></div>}
        </section>

        <section className={cardClass} aria-labelledby="checkout-payment">
          <h2 className="text-lg font-extrabold" id="checkout-payment">{t("checkout.payment")}</h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] p-3"><input className="mt-1 size-5 accent-[var(--kucur-green-ink)]" type="radio" name="payment" value="COD" checked={paymentMethod === "COD"} onChange={() => { setPaymentMethod("COD"); resetPreview(); }}/><span><strong className="block text-[15px]">{t("checkout.codTitle")}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{t("checkout.codHint")}</span></span></label>
          {preview?.paymentAvailability?.MIDTRANS && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--kucur-border-strong)] p-3"><input className="size-5" type="radio" name="payment" value="MIDTRANS" checked={paymentMethod === "MIDTRANS"} onChange={() => { setPaymentMethod("MIDTRANS"); resetPreview(); }}/><strong className="text-[15px]">Midtrans</strong></label>}
          <fieldset className="grid gap-2"><legend className="mb-1 text-[15px] font-semibold">{t("checkout.tipTitle")}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tipOptions.map((amount) => <button className={`min-h-11 rounded-xl border px-1 text-sm font-bold ${courierTip === amount ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)]"}`} type="button" aria-pressed={courierTip === amount} key={amount} onClick={() => { setCourierTip(amount); resetPreview(); }}>{amount ? formatCurrency(amount) : t("checkout.noTip")}</button>)}</div>{groups.length > 1 && <span className="text-sm text-[var(--kucur-text-muted)]">{t("checkout.tipHint")}</span>}</fieldset>
        </section>
      </main>

      <aside className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold">{t("checkout.summary")}</h2>
        {preview ? preview.groups.map((group) => <dl className="grid gap-1.5 border-b border-[var(--kucur-border)] pb-3 text-[15px] [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dd]:m-0 [&_dd]:font-semibold" key={group.store.id}>
          {preview.groups.length > 1 && <strong className="break-words">{group.store.name}</strong>}
          <div><dt>{t("checkout.products")}</dt><dd>{formatCurrency(group.productTotal)}</dd></div>
          {group.taxAmount > 0 && <div><dt>{t("checkout.tax", { percent: group.taxPercent })}</dt><dd>{formatCurrency(group.taxAmount)}</dd></div>}
          <div><dt>{t("checkout.deliveryFee")}</dt><dd>{formatCurrency(group.deliveryFee)}</dd></div>
          {group.courierTip > 0 && <div><dt>{t("checkout.courierTip")}</dt><dd>{formatCurrency(group.courierTip)}</dd></div>}
        </dl>) : <p className="text-[15px] text-[var(--kucur-text-muted)]">{calculating ? t("checkout.calculating") : t("checkout.required")}</p>}
        <div className="hidden gap-3 lg:grid">{totalLine}{actionButton}</div>
      </aside>
    </div>}
    {!loading && <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-4 py-3 md:bottom-0 lg:hidden">{totalLine}{actionButton}</div>}
  </PageContainer>;
}
