import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageContainer from "../../components/ui/PageContainer";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { cartService, checkoutApi } from "../../services/commerceService";
import { calculateCoordinateDistanceKm } from "../../services/deliveryFeeService";
import { getDrivingDistanceKm, isOpenRouteServiceConfigured } from "../../services/openRouteService";
import { productService } from "../../services/productService";

const makeKey = () => globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Checkout() {
  const { user } = useAuth();
  const { formatCurrency, t } = usePreferences();
  const [searchParams] = useSearchParams();
  const [selection, setSelection] = useState({ cart: null, direct: null });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [created, setCreated] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState(user.fullName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(user.phone ?? "");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [latitude, setLatitude] = useState("unavailable");
  const [longitude, setLongitude] = useState("unavailable");
  const [confirmedRequest, setConfirmedRequest] = useState(null);
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
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => { setLatitude(String(coords.latitude)); setLongitude(String(coords.longitude)); }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  }, []);

  const items = useMemo(() => selection.direct
    ? [{ ...selection.direct, id: "direct", product: selection.direct.product, variant: selection.direct.product.variants?.find((row) => row.id === selection.direct.productVariantId) }]
    : selection.cart?.items ?? [], [selection]);
  const request = useMemo(() => ({
    ...(selection.direct ? { items: [{ productId: selection.direct.productId, productVariantId: selection.direct.productVariantId, quantity: selection.direct.quantity }] } : { cartItemIds: items.map((item) => item.id) }),
    recipientName, recipientPhone, deliveryAddress: address, paymentMethod, delivery: { address, recipientName, recipientPhone },
  }), [address, items, paymentMethod, recipientName, recipientPhone, selection.direct]);

  const getPreview = async () => {
    setError(""); setPreview(null); setConfirmedRequest(null);
    if (!address.trim() || !recipientName.trim() || !recipientPhone.trim()) return setError(t("checkout.required"));
    const destination = { lat: Number(latitude), lng: Number(longitude) };
    if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng) || Math.abs(destination.lat) > 90 || Math.abs(destination.lng) > 180) return setError(t("checkout.coordinatesRequired"));
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
      setPreview(await checkoutApi.preview(nextRequest)); setConfirmedRequest(nextRequest);
    } catch (caught) { setError(caught.message); }
  };
  const submit = async () => {
    if (!preview || !confirmedRequest || submitting) return;
    setSubmitting(true); setError("");
    try { const result = await checkoutApi.create(confirmedRequest, makeKey()); setCreated(result.orders ?? []); if (!selection.direct) void cartService.get().catch(() => null); }
    catch (caught) { setError(caught.message); setPreview(null); setConfirmedRequest(null); }
    finally { setSubmitting(false); }
  };

  if (created.length) return <PageContainer><section className="mx-auto grid max-w-xl justify-items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950"><span className="font-bold text-emerald-800 dark:text-emerald-200">{t("checkout.success")}</span><h1 className="text-2xl font-extrabold">{t("checkout.ordersCreated", { count: created.length })}</h1><p>{t("checkout.successHint")}</p>{created.map((order) => <Link className="break-all font-bold text-emerald-800 dark:text-emerald-200" to={`/orders/${order.id}`} key={order.id}>{order.orderNumber ?? order.orderCode}</Link>)}<Link className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white" to="/orders">{t("checkout.viewOrders")}</Link></section></PageContainer>;

  return <PageContainer className="space-y-5"><header><h1 className="text-2xl font-extrabold">{t(selection.direct ? "checkout.directTitle" : "checkout.title")}</h1><p className="text-[var(--kucur-text-muted)]">{t("checkout.subtitle")}</p></header>{error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}{loading ? <div className="rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-8 text-center">{t("checkout.loading")}</div> : <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]"><main className="grid min-w-0 gap-4"><section className="grid gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5"><h2 className="text-lg font-bold">{t("checkout.recipient")}</h2><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5"><span>{t("checkout.recipientName")}</span><input className="min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" value={recipientName} onChange={(event) => { setRecipientName(event.target.value); setPreview(null); }}/></label><label className="grid min-w-0 gap-1.5"><span>{t("checkout.phone")}</span><input className="min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" value={recipientPhone} onChange={(event) => { setRecipientPhone(event.target.value); setPreview(null); }}/></label></div><label className="grid min-w-0 gap-1.5"><span>{t("checkout.address")}</span><textarea className="min-w-0 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" rows="3" value={address} onChange={(event) => { setAddress(event.target.value); setPreview(null); }}/></label></section><section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5"><h2 className="text-lg font-bold">{t("checkout.products")}</h2>{items.map((item) => <div className="flex min-w-0 flex-wrap justify-between gap-3 border-b border-[var(--kucur-border)] py-2" key={item.id}><span className="min-w-0 break-words">{item.product?.name} × {item.quantity}</span><strong>{formatCurrency((item.unitPrice ?? item.variant?.price ?? item.product?.price) * item.quantity)}</strong></div>)}{!items.length && <div className="grid gap-2 text-center"><p>{t("checkout.emptyCart")}</p><Link to="/products">{t("checkout.findProducts")}</Link></div>}</section><section className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5"><h2 className="text-lg font-bold">{t("checkout.payment")}</h2><select className="rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPreview(null); }}><option value="COD">{t("checkout.cod")}</option>{preview?.paymentAvailability?.MIDTRANS && <option value="MIDTRANS">Midtrans</option>}</select></section></main><aside className="grid gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5 lg:sticky lg:top-24"><h2 className="text-xl font-bold">{t("checkout.summary")}</h2>{preview ? <>{preview.groups.map((group) => <div className="grid gap-2 border-b border-[var(--kucur-border)] pb-3" key={group.store.id}><strong className="break-words">{group.store.name}</strong><div className="flex justify-between gap-3"><span>{t("checkout.products")}</span><b>{formatCurrency(group.productTotal)}</b></div><div className="flex justify-between gap-3"><span>{t("checkout.deliveryFee")}</span><b>{formatCurrency(group.deliveryFee)}</b></div></div>)}<div className="flex justify-between gap-3 text-lg"><span>{t("checkout.total")}</span><strong>{formatCurrency(preview.grandTotal)}</strong></div><button className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:bg-slate-300" disabled={submitting} onClick={submit}>{t(submitting ? "checkout.processing" : "checkout.createOrder")}</button></> : <button className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:bg-slate-300" disabled={!items.length} onClick={getPreview}>{t("checkout.calculate")}</button>}</aside></div>}</PageContainer>;
}
