import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import { useStore } from "../../context/StoreContext";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { usePreferences } from "../../context/PreferencesContext";
import { financeService } from "../../services/financeService";
import { orderService } from "../../services/orderService";
import { getProductTotalStock, productService } from "../../services/productService";
import { getAverageRating, reviewService } from "../../services/reviewService";
import { filterByPeriod } from "../../utils/datePeriod";

const LOW_STOCK = 5;
const periods = ["today", "7d", "1m", "1y"];
const dayKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };

export default function MerchantDashboard() {
  const { activeStore, activeStoreId, stores } = useStore();
  const { formatCurrency, formatDate, language, t } = usePreferences();
  const copy = language === "id" ? {
    title: "Beranda Lapak", subtitle: "Ringkasan penjualan, pesanan, dan stok lapak Anda.", allStores: "Semua lapak", periods: { today: "Hari ini", "7d": "7 hari", "1m": "30 hari", "1y": "1 tahun" },
    revenue: { today: "Pendapatan hari ini", "7d": "Pendapatan 7 hari", "1m": "Pendapatan 30 hari", "1y": "Pendapatan 1 tahun" }, fromOrders: "dari {count} pesanan selesai", revenueHint: "Harga barang dari pesanan yang sudah sampai ke pembeli.",
    last7: "7 hari terakhir", todo: "Perlu dikerjakan", nothingTodo: "Tidak ada pesanan yang perlu dikerjakan", nothingTodoHint: "Pesanan baru akan muncul di sini.",
    newOrders: "Pesanan baru", newHint: "Terima supaya pembeli tahu pesanannya diproses.", accept: "Terima",
    pack: "Perlu dikemas", packHint: "Siapkan sebelum kurir datang sore ini.", ready: "Siap diambil kurir", readyHint: "Kurir mengambil di lapak sesuai jadwal.", open: "Lihat",
    alerts: "Perlu diperhatikan", lowStock: "Stok hampir habis", left: "sisa {count}", addStock: "Tambah stok",
    adminFee: "Tagihan biaya admin", payBefore: "bayar sebelum {date}", initialFee: "Cicilan iuran pokok", dueOn: "jatuh tempo {date}", overdue: "terlambat sejak {date}", pay: "Bayar",
    activeProducts: "Produk aktif", rating: "Rating lapak", noRating: "Belum ada", addProduct: "+ Tambah produk", loading: "Memuat beranda lapak", loadFailed: "Data lapak gagal dimuat.", retry: "Coba lagi",
    selectStore: "Pilih lapak produk", productOnly: "Beranda ini hanya untuk lapak produk.",
    mostViewed: "Produk paling sering dilihat (7 hari)", viewed: "{count} kali dilihat",
  } : {
    title: "Store Home", subtitle: "A summary of your store sales, orders, and stock.", allStores: "All stores", periods: { today: "Today", "7d": "7 days", "1m": "30 days", "1y": "1 year" },
    revenue: { today: "Revenue today", "7d": "Revenue, 7 days", "1m": "Revenue, 30 days", "1y": "Revenue, 1 year" }, fromOrders: "from {count} completed orders", fromOrder: "from 1 completed order", revenueHint: "Item prices from orders that reached the buyer.",
    last7: "Last 7 days", todo: "To do", nothingTodo: "No orders need attention", nothingTodoHint: "New orders will appear here.",
    newOrders: "New orders", newHint: "Accept them so buyers know their order is being prepared.", accept: "Accept",
    pack: "Needs packing", packHint: "Prepare them before the courier arrives this afternoon.", ready: "Ready for courier", readyHint: "The courier picks up at your store on schedule.", open: "View",
    alerts: "Needs attention", lowStock: "Running low", left: "{count} left", addStock: "Add stock",
    adminFee: "Admin fee bill", payBefore: "pay before {date}", initialFee: "Store fee installment", dueOn: "due {date}", overdue: "overdue since {date}", pay: "Pay",
    activeProducts: "Active products", rating: "Store rating", noRating: "None yet", addProduct: "+ Add product", loading: "Loading store home", loadFailed: "Store data could not be loaded.", retry: "Try again",
    selectStore: "Choose a product store", productOnly: "This page is only for product stores.",
    mostViewed: "Most viewed products (7 days)", viewed: "{count} views",
  };
  const [data, setData] = useState({ products: [], orders: [], reviews: [], finance: null });
  const [period, setPeriod] = useState("today");
  const [views, setViews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isOverview = activeStoreId === "all" || !activeStore;
  const selectedIds = useMemo(
    () => new Set(isOverview ? stores.filter((store) => store.type === "product").map((store) => store.id) : [activeStore?.id].filter(Boolean)),
    [activeStore?.id, isOverview, stores],
  );

  const load = async (options) => {
    const silent = options?.silent === true;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const [products, orders, reviews, finance] = await Promise.all([
        productService.list({ scope: "manage" }),
        orderService.list({ scope: "merchant" }),
        reviewService.merchant(isOverview ? undefined : activeStore.id),
        isOverview ? Promise.resolve(null) : financeService.summary(activeStore.id).catch(() => null),
      ]);
      setData({ products: products.filter((row) => selectedIds.has(row.storeId)), orders: orders.filter((row) => selectedIds.has(row.storeId)), reviews, finance });
      // Statistik dilihat bersifat pelengkap: gagal dimuat tidak menggagalkan beranda.
      Promise.all([...selectedIds].map((id) => productService.storeViews(id).catch(() => ({}))))
        .then((rows) => setViews(Object.assign({}, ...rows)))
        .catch(() => setViews({}));
    } catch (caught) {
      if (!silent) setError(caught.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [activeStoreId]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(() => load({ silent: true }), { enabled: !loading });

  const completed = useMemo(() => data.orders.filter((row) => row.status === "completed" && row.completedAt), [data.orders]);
  const periodOrders = useMemo(() => filterByPeriod(completed, (row) => row.completedAt, period), [completed, period]);
  const revenue = periodOrders.reduce((sum, row) => sum + Number(row.productTotal || 0), 0);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const total = completed.filter((row) => dayKey(row.completedAt) === dayKey(date)).reduce((sum, row) => sum + Number(row.productTotal || 0), 0);
    return { date, total };
  }), [completed]);
  const weekMax = Math.max(...week.map((day) => day.total), 1);
  const counts = {
    pending: data.orders.filter((row) => row.status === "pending").length,
    pack: data.orders.filter((row) => ["confirmed", "processing"].includes(row.status)).length,
    ready: data.orders.filter((row) => row.status === "ready-for-pickup").length,
  };
  const lowStock = data.products.filter((row) => row.status === "active" && getProductTotalStock(row) <= LOW_STOCK).sort((a, b) => getProductTotalStock(a) - getProductTotalStock(b)).slice(0, 3);
  const rating = getAverageRating(data.reviews);
  const topViewed = data.products.map((row) => ({ product: row, count: Number(views[row.id]?.last7Days ?? 0) })).filter((row) => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  const activeProducts = data.products.filter((row) => row.status === "active").length;
  const fill = (text, values) => Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, replacement), text);
  const ordersPath = (status) => `/merchant/orders?status=${status}`;
  const financePath = activeStore ? `/merchant/stores/${activeStore.id}/finance` : "/merchant/finance";
  const adminFee = data.finance?.adminFee;
  const initialFee = data.finance?.initialFee;

  if (activeStore && activeStore.type !== "product") return <PageContainer><EmptyState title={copy.selectStore} description={copy.productOnly} /></PageContainer>;
  if (loading) return <PageContainer><LoadingPanel label={copy.loading} rows={4} /></PageContainer>;

  const todo = [
    { key: "pending", count: counts.pending, label: copy.newOrders, hint: copy.newHint, action: copy.accept, to: ordersPath("pending"), tone: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200", primary: true },
    { key: "pack", count: counts.pack, label: copy.pack, hint: copy.packHint, action: copy.open, to: ordersPath("processing"), tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
    { key: "ready", count: counts.ready, label: copy.ready, hint: copy.readyHint, action: copy.open, to: "/merchant/pickup", tone: "bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" },
  ].filter((row) => row.count > 0);
  const alerts = [
    ...lowStock.map((product) => ({ key: `stock-${product.id}`, label: copy.lowStock, value: `${product.name}, ${fill(copy.left, { count: getProductTotalStock(product) })}`, action: copy.addStock, to: `/merchant/stores/${product.storeId}/stock` })),
    ...(adminFee?.outstanding > 0 ? [{ key: "admin-fee", label: copy.adminFee, value: `${formatCurrency(adminFee.outstanding)} · ${fill(copy.payBefore, { date: formatDate(adminFee.nextCutoffAt, { day: "numeric", month: "short" }) })}`, action: copy.pay, to: financePath }] : []),
    ...(initialFee?.outstanding > 0 && initialFee.nextDueAt ? [{ key: "initial-fee", label: copy.initialFee, value: `${formatCurrency(initialFee.outstanding)} · ${fill(new Date(initialFee.nextDueAt) < new Date() ? copy.overdue : copy.dueOn, { date: formatDate(initialFee.nextDueAt, { day: "numeric", month: "short" }) })}`, action: copy.pay, to: financePath, urgent: new Date(initialFee.nextDueAt) < new Date() }] : []),
  ];
  const actionClass = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-bold";

  return <PageContainer className="space-y-4">
    <PageHeader eyebrow={t("workspace.merchantEyebrow")} title={copy.title} description={copy.subtitle} actionsClassName="hidden sm:flex" actions={!isOverview ? <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[var(--kucur-green)] px-4 text-sm font-bold text-[var(--kucur-green-ink)]" to={`/merchant/stores/${activeStore.id}/products/add`}>{copy.addProduct}</Link> : null} />

    {error && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert"><strong>{copy.loadFailed}</strong><button className={`${actionClass} border border-current`} type="button" onClick={load}>{copy.retry}</button></section>}

    <div className="flex flex-wrap gap-2" role="group" aria-label={copy.revenue[period]}>{periods.map((key) => <button className={`min-h-11 rounded-full border px-4 text-sm font-bold ${period === key ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text-muted)]"}`} type="button" aria-pressed={period === key} key={key} onClick={() => setPeriod(key)}>{copy.periods[key]}</button>)}</div>

    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="grid gap-4 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="merchant-revenue">
        <div><span className="text-sm font-semibold text-[var(--kucur-text-muted)]" id="merchant-revenue">{copy.revenue[period]}</span><strong className="block text-[32px] font-extrabold leading-tight tracking-[-0.02em]">{formatCurrency(revenue)}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{fill(periodOrders.length === 1 && copy.fromOrder ? copy.fromOrder : copy.fromOrders, { count: periodOrders.length })}</span></div>
        <div>
          <span className="text-[13px] font-semibold text-[var(--kucur-text-muted)]">{copy.last7}</span>
          <div className="mt-2 grid h-28 grid-cols-7 items-end gap-2 border-b border-[var(--kucur-border)]" role="img" aria-label={`${copy.last7}: ${week.map((day) => `${formatDate(day.date, { weekday: "short" })} ${formatCurrency(day.total)}`).join(", ")}`}>
            {week.map((day, index) => <div className="flex h-full flex-col justify-end" key={day.date.toISOString()}><i className={`block rounded-t-md ${index === 6 ? "bg-[var(--kucur-green)]" : "bg-[color-mix(in_srgb,var(--kucur-green)_35%,var(--kucur-surface))]"}`} style={{ height: `${Math.max(day.total / weekMax * 100, day.total ? 6 : 2)}%` }} /></div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-2 text-center text-[12px] text-[var(--kucur-text-muted)]">{week.map((day, index) => <span className={index === 6 ? "font-bold text-[var(--kucur-text)]" : ""} key={day.date.toISOString()}>{formatDate(day.date, { weekday: "short" })}</span>)}</div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-[var(--kucur-border)] pt-3 text-[15px]"><div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.activeProducts}</dt><dd className="font-bold">{activeProducts}</dd></div><div><dt className="text-sm text-[var(--kucur-text-muted)]">{copy.rating}</dt><dd className="font-bold">{rating ? `★ ${Number(rating).toLocaleString(language === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : copy.noRating}</dd></div></dl>
      </section>

      <div className="grid gap-4">
        <section aria-labelledby="merchant-todo">
          <h2 className="mb-2 text-lg font-extrabold" id="merchant-todo">{copy.todo}</h2>
          {todo.length ? <div className="overflow-hidden rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]">{todo.map((row) => <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--kucur-border)] p-3 last:border-b-0" key={row.key}>
            <span className={`grid size-11 place-items-center rounded-xl text-lg font-extrabold ${row.tone}`}>{row.count}</span>
            <div className="min-w-0"><strong className="block text-[15px] leading-snug">{row.label}</strong><span className="text-[13px] leading-snug text-[var(--kucur-text-muted)]">{row.hint}</span></div>
            <Link className={`${actionClass} ${row.primary ? "bg-[var(--kucur-green)] text-[var(--kucur-on-green)]" : "border border-[var(--kucur-border-strong)] text-[var(--kucur-text)]"}`} to={row.to}>{row.action}</Link>
          </div>)}</div> : <div className="rounded-2xl border border-dashed border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-4"><strong className="block text-[15px]">{copy.nothingTodo}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{copy.nothingTodoHint}</span></div>}
        </section>

        {alerts.length > 0 && <section className="grid gap-2" aria-labelledby="merchant-alerts">
          <h2 className="text-lg font-extrabold" id="merchant-alerts">{copy.alerts}</h2>
          {alerts.map((row) => <div className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-dashed p-3 ${row.urgent ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)]"}`} key={row.key}><div className="min-w-0"><span className="block text-[13px] text-[var(--kucur-text-muted)]">{row.label}</span><strong className={`block break-words text-[15px] ${row.urgent ? "text-rose-700 dark:text-rose-300" : ""}`}>{row.value}</strong></div><Link className={`${actionClass} border border-[var(--kucur-border-strong)]`} to={row.to}>{row.action}</Link></div>)}
        </section>}

        {topViewed.length > 0 && <section className="grid gap-2" aria-labelledby="merchant-most-viewed">
          <h2 className="text-lg font-extrabold" id="merchant-most-viewed">{copy.mostViewed}</h2>
          <ol className="overflow-hidden rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]">{topViewed.map((row, index) => <li className="border-b border-[var(--kucur-border)] last:border-b-0" key={row.product.id}><Link className="grid min-h-12 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 p-3" to={`/merchant/stores/${row.product.storeId}/products/${row.product.id}/edit`}><span className="text-sm font-extrabold text-[var(--kucur-text-muted)]">{index + 1}</span><strong className="truncate text-[15px]">{row.product.name}</strong><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{fill(copy.viewed, { count: row.count.toLocaleString(language === "id" ? "id-ID" : "en-US") })}</span></Link></li>)}</ol>
        </section>}

        {!isOverview && <Link className={`${actionClass} min-h-12 w-full border border-[var(--kucur-green)] text-base text-[var(--kucur-green-ink)] sm:hidden`} to={`/merchant/stores/${activeStore.id}/products/add`}>{copy.addProduct}</Link>}
      </div>
    </div>
  </PageContainer>;
}
