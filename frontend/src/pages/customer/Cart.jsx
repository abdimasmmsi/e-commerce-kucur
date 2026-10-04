import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import { usePreferences } from "../../context/PreferencesContext";
import { cartService } from "../../services/commerceService";
import Button from "../../components/ui/Button";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";

function EmptyCart({ t }) {
  return <section className="grid min-h-[360px] min-w-0 place-items-center rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] px-5 py-10 text-center shadow-sm sm:px-8">
    <div className="grid max-w-lg justify-items-center gap-4">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--kucur-green-soft)] text-[var(--kucur-forest)]" aria-hidden="true">
        <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6M9.5 20a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM17.5 20a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z"/></svg>
      </span>
      <div className="grid gap-2"><h2 className="text-xl font-extrabold sm:text-2xl">{t("cartEmpty.title")}</h2><p className="text-sm leading-6 text-[var(--kucur-text-muted)] sm:text-base">{t("cartEmpty.description")}</p></div>
      <div className="flex w-full min-w-0 flex-col justify-center gap-2 sm:w-auto sm:flex-row">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--kucur-green)] px-5 font-bold text-[var(--kucur-navy)] hover:bg-[var(--kucur-green-hover)]" to="/products">{t("cartEmpty.exploreProducts")}</Link>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-5 font-semibold text-[var(--kucur-text)] hover:bg-[var(--kucur-green-soft)]" to="/">{t("cartEmpty.backHome")}</Link>
      </div>
    </div>
  </section>;
}

export default function Cart() {
  const { formatCurrency, t } = usePreferences();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { let active = true; cartService.get().then((value) => { if (active) setCart(value); }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const mutate = async (id, action) => { setBusy(id); setError(""); try { setCart(await action()); } catch (cause) { setError(cause.message); } finally { setBusy(""); } };
  const groups = Object.values(cart.items.reduce((map, item) => { const key = String(item.product?.storeId ?? item.storeId); map[key] ??= { store: item.product?.store, items: [] }; map[key].items.push(item); return map; }, {}));
  const total = Number(cart.total ?? cart.items.reduce((sum, item) => sum + Number(item.subtotal || item.unitPrice * item.quantity), 0));

  return <PageContainer className="space-y-5">
    <PageHeader title={t("commerce.cartTitle")} description={t("commerce.cartHint")} />
    {loading && <LoadingPanel label={t("commerce.loadingCart")} rows={4}/>} 
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800" role="alert">{error}</p>}
    {!loading && !cart.items.length && <EmptyCart t={t}/>} 
    {!loading && cart.items.length > 0 && <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,.6fr)]">
      <main className="grid min-w-0 gap-4">{groups.map((group) => <section className="grid min-w-0 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" key={group.store?.id ?? group.items[0].storeId}>
        <h2 className="mb-3 break-words text-lg font-bold">{group.store?.name ?? t("commerce.store")}</h2>
        {group.items.map((item) => <article className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-[var(--kucur-border)] py-4 sm:grid-cols-[48px_minmax(0,1fr)_auto_auto] sm:items-center" key={item.id}>
          <div className="h-12 w-12 overflow-hidden rounded-xl"><ProductImage product={item.product} image={item.variant?.image} alt={item.product?.name ?? ""}/></div>
          <div className="grid min-w-0"><strong className="break-words">{item.product?.name}</strong>{item.variant && <span className="text-sm text-[var(--kucur-text-muted)]">{Object.values(item.variant.options ?? {}).join(" · ")}</span>}<span>{formatCurrency(item.unitPrice)}</span></div>
          <div className="col-start-2 flex w-fit items-center overflow-hidden rounded-lg border border-[var(--kucur-border-strong)] sm:col-auto"><button className="h-9 w-9" disabled={busy === item.id || item.quantity <= 1} onClick={() => mutate(item.id, () => cartService.update(item.id, item.quantity - 1))}>−</button><strong className="w-9 text-center">{item.quantity}</strong><button className="h-9 w-9" disabled={busy === item.id || item.quantity >= Number(item.currentStock ?? item.variant?.stock ?? item.product?.stock)} onClick={() => mutate(item.id, () => cartService.update(item.id, item.quantity + 1))}>+</button></div>
          <button className="col-start-2 w-fit text-sm font-semibold text-rose-700 sm:col-auto" disabled={busy === item.id} onClick={() => mutate(item.id, () => cartService.remove(item.id))}>{t("commerce.remove")}</button>
        </article>)}
      </section>)}</main>
      <aside className="grid gap-4 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-5 lg:sticky lg:top-24"><h2 className="font-semibold">{t("commerce.summary")}</h2><div className="flex justify-between gap-3"><span>{t("commerce.productTotal")}</span><strong>{formatCurrency(total)}</strong></div><Button as={Link} to="/checkout">{t("commerce.continueCheckout")}</Button></aside>
    </div>}
  </PageContainer>;
}
