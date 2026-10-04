import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import { usePreferences } from "../../context/PreferencesContext";
import { cartService } from "../../services/commerceService";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";

const primaryLink = "inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-5 text-base font-bold text-[var(--kucur-forest-dark)] hover:bg-[var(--kucur-green-hover)]";
const secondaryLink = "inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-5 text-base font-bold text-[var(--kucur-text)] hover:bg-[var(--kucur-green-soft)]";

function EmptyCart({ t }) {
  return <section className="grid min-h-[320px] min-w-0 place-items-center rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-5 py-10 text-center">
    <div className="grid max-w-md justify-items-center gap-4">
      <span className="grid size-20 place-items-center rounded-full bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" aria-hidden="true">
        <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6M9.5 20a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM17.5 20a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z"/></svg>
      </span>
      <div className="grid gap-2"><h2 className="text-xl font-extrabold">{t("cartEmpty.title")}</h2><p className="text-[15px] leading-6 text-[var(--kucur-text-muted)]">{t("cartEmpty.description")}</p></div>
      <div className="grid w-full gap-2 sm:flex sm:w-auto"><Link className={primaryLink} to="/products">{t("cartEmpty.exploreProducts")}</Link><Link className={secondaryLink} to="/">{t("cartEmpty.backHome")}</Link></div>
    </div>
  </section>;
}

export default function Cart() {
  const { formatCurrency, language, t } = usePreferences();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { let active = true; cartService.get().then((value) => { if (active) setCart(value); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const mutate = async (id, action) => { setBusy(id); setError(""); try { setCart(await action()); } catch (cause) { setError(cause.message); } finally { setBusy(""); } };
  const groups = Object.values(cart.items.reduce((map, item) => { const key = String(item.product?.storeId ?? item.storeId); map[key] ??= { store: item.product?.store, items: [] }; map[key].items.push(item); return map; }, {}));
  const total = Number(cart.total ?? cart.items.reduce((sum, item) => sum + Number(item.subtotal || item.unitPrice * item.quantity), 0));
  const copy = language === "id" ? { decrease: "Kurangi jumlah", increase: "Tambah jumlah", items: "{count} barang" } : { decrease: "Decrease quantity", increase: "Increase quantity", items: "{count} items" };
  const itemCount = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalLine = <div className="grid"><span className="text-[13px] text-[var(--kucur-text-muted)]">{t("commerce.productTotal")} · {copy.items.replace("{count}", itemCount)}</span><strong className="text-xl font-extrabold">{formatCurrency(total)}</strong></div>;

  return <PageContainer className="space-y-4 pb-28 lg:pb-0">
    <header><h1 className="text-2xl font-extrabold">{t("commerce.cartTitle")}</h1></header>
    {loading && <LoadingPanel label={t("commerce.loadingCart")} rows={4}/>}
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}
    {!loading && !cart.items.length && <EmptyCart t={t}/>}
    {!loading && cart.items.length > 0 && <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,.6fr)]">
      <div className="grid min-w-0 gap-4">{groups.map((group) => <section className="grid min-w-0 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-4 pt-3" key={group.store?.id ?? group.items[0].storeId}>
        <h2 className="flex items-center gap-2 break-words border-b border-[var(--kucur-border)] pb-3 text-base font-extrabold"><svg className="size-5 shrink-0 text-[var(--kucur-green-ink)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 9 5.5 4h13L20 9M4 9h16M4 9v11h16V9M10 20v-5h4v5"/></svg>{group.store?.name ?? t("commerce.store")}</h2>
        {group.items.map((item) => { const max = Number(item.currentStock ?? item.variant?.stock ?? item.product?.stock); return <article className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-[var(--kucur-border)] py-4 last:border-b-0" key={item.id}>
          <Link className="size-16 overflow-hidden rounded-xl bg-[var(--kucur-surface-elevated)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover" to={`/products/${item.product?.id ?? item.productId}`} aria-label={item.product?.name}><ProductImage product={item.product} image={item.variant?.image} alt=""/></Link>
          <div className="grid min-w-0 content-start gap-0.5"><strong className="break-words text-[15px] font-bold">{item.product?.name}</strong>{item.variant && <span className="text-sm text-[var(--kucur-text-muted)]">{Object.values(item.variant.options ?? {}).join(" · ")}</span>}<span className="text-base font-extrabold">{formatCurrency(item.unitPrice)}</span></div>
          <div className="col-start-2 flex items-center justify-between gap-3">
            <div className="flex items-center overflow-hidden rounded-xl border border-[var(--kucur-border-strong)]"><button className="grid size-11 place-items-center text-xl font-bold disabled:opacity-30" type="button" aria-label={copy.decrease} disabled={busy === item.id || item.quantity <= 1} onClick={() => mutate(item.id, () => cartService.update(item.id, item.quantity - 1))}>−</button><strong className="min-w-9 text-center text-base" aria-live="polite">{item.quantity}</strong><button className="grid size-11 place-items-center text-xl font-bold disabled:opacity-30" type="button" aria-label={copy.increase} disabled={busy === item.id || item.quantity >= max} onClick={() => mutate(item.id, () => cartService.update(item.id, item.quantity + 1))}>+</button></div>
            <button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950" type="button" disabled={busy === item.id} onClick={() => mutate(item.id, () => cartService.remove(item.id))}><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>{t("commerce.remove")}</button>
          </div>
        </article>; })}
      </section>)}</div>
      <aside className="hidden gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5 lg:sticky lg:top-24 lg:grid">{totalLine}<p className="text-sm text-[var(--kucur-text-muted)]">{t("commerce.cartShippingHint")}</p><Link className={primaryLink} to="/checkout">{t("commerce.continueCheckout")}</Link></aside>
      <p className="text-sm text-[var(--kucur-text-muted)] lg:hidden">{t("commerce.cartShippingHint")}</p>
    </div>}
    {!loading && cart.items.length > 0 && <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-4 py-3 md:bottom-0 lg:hidden">{totalLine}<Link className={primaryLink} to="/checkout">{t("commerce.continueCheckout")}</Link></div>}
  </PageContainer>;
}
