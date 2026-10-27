import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ActionDialog from "../../components/ui/ActionDialog";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { useStore } from "../../context/StoreContext";
import { merchantTransitions, orderService } from "../../services/orderService";
import { canonicalStoreId } from "../../services/legacyStoreReferences";
import { useLiveRefresh } from "../../utils/liveRefresh";
import { filterByPeriod } from "../../utils/datePeriod";
import { shortOrderCode } from "../../utils/orderCode";
import { paginate } from "../../utils/pagination";
import { downloadCsv, orderReportColumns, reportFileName } from "../../utils/csv";

const PAGE_SIZE = 10;
// Tab mengikuti alur kerja lapak; status lama di URL (?status=) dipetakan ke tab yang sesuai.
const tabs = [
  { key: "new", statuses: ["pending"] },
  { key: "pack", statuses: ["confirmed", "processing"] },
  { key: "ready", statuses: ["ready-for-pickup", "courier-assigned"] },
  { key: "shipping", statuses: ["picked-up", "on-delivery"] },
  { key: "done", statuses: ["delivered", "completed"] },
  { key: "cancelled", statuses: ["cancelled", "failed"] },
];
const tabForStatus = (status) => tabs.find((tab) => tab.key === status || tab.statuses.includes(status))?.key;
const periods = ["today", "7d", "1m", "1y"];
const actionLabelKeys = { confirmed: "actionConfirmed", processing: "actionProcessing", "ready-for-pickup": "actionReady" };
const confirmKeys = { confirmed: "confirmConfirmed", processing: "confirmProcessing", "ready-for-pickup": "confirmReady" };

function OrderManagementWorkspace({ storeId, routeStore }) {
  const { errorMessage, formatCurrency, formatDate, language, statusLabel, t } = usePreferences();
  const copy = language === "id"
    ? { tabs: { new: "Baru", pack: "Dikemas", ready: "Siap diambil", shipping: "Dikirim", done: "Selesai", cancelled: "Batal" }, tabsLabel: "Tahap pesanan", search: "Cari kode pesanan atau nama pembeli", items: "{name} ×{qty}", more: "dan {count} produk lain", cod: "Total COD", detail: "Detail", periods: { all: "Semua waktu", today: "Hari ini", "7d": "7 hari", "1m": "30 hari", "1y": "1 tahun" }, revenue: "Pendapatan produk", empty: "Belum ada pesanan di tahap ini", emptyHint: "Pesanan akan pindah ke sini sesuai tahapnya.", done: "Status pesanan diperbarui." }
    : { tabs: { new: "New", pack: "Packing", ready: "Ready", shipping: "Shipping", done: "Completed", cancelled: "Cancelled" }, tabsLabel: "Order stages", search: "Search order code or buyer name", items: "{name} ×{qty}", more: "and {count} more", cod: "COD total", detail: "Details", periods: { all: "All time", today: "Today", "7d": "7 days", "1m": "30 days", "1y": "1 year" }, revenue: "Product revenue", empty: "No orders in this stage", emptyHint: "Orders move here as they progress.", done: "Order status updated." };
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(() => tabForStatus(searchParams.get("status")) ?? "");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    orderService.list({ scope: "merchant", storeId })
      .then((rows) => { if (active) setOrders(rows); })
      .catch((caught) => { if (active) setError(errorMessage(caught.code, t("orderManagement.loadFailed"))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [errorMessage, storeId, t]);
  // Muat ulang diam-diam: filter/tab/pencarian/dialog tidak disentuh, galat sementara diabaikan.
  useLiveRefresh(() => orderService.list({ scope: "merchant", storeId }).then(setOrders), { enabled: !loading });

  const counts = useMemo(() => Object.fromEntries(tabs.map((item) => [item.key, orders.filter((order) => item.statuses.includes(order.status)).length])), [orders]);
  // Tanpa pilihan, buka tahap pertama yang punya pesanan (yang paling perlu dikerjakan).
  const activeTab = tab || tabs.find((item) => counts[item.key] > 0)?.key || "new";
  const rows = useMemo(() => {
    const current = tabs.find((item) => item.key === activeTab);
    const query = search.trim().toLowerCase();
    const matching = orders.filter((order) => current.statuses.includes(order.status) && (!query || String(order.orderNumber ?? order.orderCode).toLowerCase().includes(query) || String(order.customerName).toLowerCase().includes(query)));
    const inPeriod = activeTab === "done" && period ? filterByPeriod(matching, (order) => order.completedAt ?? order.createdAt, period) : matching;
    return inPeriod.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [activeTab, orders, period, search]);
  const visible = useMemo(() => paginate(rows, page, PAGE_SIZE), [page, rows]);
  const revenue = rows.reduce((sum, order) => sum + Number(order.productTotal || 0), 0);

  const chooseTab = (key) => {
    setTab(key); setPage(1); setPeriod("");
    const next = new URLSearchParams(searchParams); next.delete("status"); next.delete("period"); setSearchParams(next, { replace: true });
  };
  const advance = async () => {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      const updated = await orderService.transitionFulfillment(pending.order.id, pending.next);
      setOrders((current) => current.map((order) => order.id === updated.id ? { ...order, ...updated } : order));
      // Ikuti pesanan ke tab barunya (mis. Baru -> Dikemas setelah diterima).
      const nextTab = tabForStatus(updated.status ?? updated.fulfillmentStatus ?? pending.next);
      if (nextTab) { setTab(nextTab); setPage(1); setPeriod(""); }
      setNotice(copy.done);
      setPending(null);
    } catch (caught) {
      setError(errorMessage(caught.code, t("merchantOrderDetail.processFailed")));
      setPending(null);
      // Status di daftar bisa basi (mis. pembeli sudah membatalkan); muat ulang supaya kartu sesuai server.
      orderService.list({ scope: "merchant", storeId }).then(setOrders).catch(() => null);
    } finally { setBusy(false); }
  };

  const header = <PageHeader eyebrow={t("workspace.merchantEyebrow")} title={t("orderManagement.title")} description={t("orderManagement.subtitle", { store: routeStore?.name ?? t("orderManagement.activeStore") })} />;
  if (loading) return <PageContainer className="space-y-4">{header}<LoadingPanel label={t("orderManagement.loading")} rows={5} /></PageContainer>;

  const exportRows = () => downloadCsv(reportFileName(`${language === "id" ? "pesanan" : "orders"}-${String(routeStore?.name ?? "lapak").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${activeTab}`), orderReportColumns(language, statusLabel, { withStore: false }), rows);

  return <PageContainer className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">{header}<button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-4 text-sm font-bold text-[var(--kucur-text)] hover:border-[var(--kucur-green)] disabled:opacity-50" type="button" disabled={!rows.length} onClick={exportRows}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>{language === "id" ? `Unduh CSV (${rows.length})` : `Download CSV (${rows.length})`}</button></div>
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label={copy.tabsLabel}>
      {tabs.map((item) => <button className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold ${activeTab === item.key ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] text-[var(--kucur-text)]"}`} type="button" role="tab" aria-selected={activeTab === item.key} key={item.key} onClick={() => chooseTab(item.key)}>{copy.tabs[item.key]}{counts[item.key] > 0 && <span className={`rounded-full px-2 text-xs ${activeTab === item.key ? "bg-[var(--kucur-bg)] text-[var(--kucur-text)]" : "bg-[var(--kucur-surface-muted)]"}`}>{counts[item.key]}</span>}</button>)}
    </div>
    <label className="relative block sm:max-w-md"><span className="sr-only">{t("orderManagement.search")}</span><svg className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--kucur-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input className="min-h-12 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] !pl-11 pr-3 text-base text-[var(--kucur-text)]" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={copy.search} /></label>

    {activeTab === "done" && <div className="grid gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:flex sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">{["", ...periods].map((key) => <button className={`min-h-11 rounded-full border px-3 text-sm font-bold ${period === key ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)]"}`} type="button" aria-pressed={period === key} key={key || "all"} onClick={() => { setPeriod(key); setPage(1); }}>{copy.periods[key || "all"]}</button>)}</div>
      <div><span className="block text-sm text-[var(--kucur-text-muted)]">{copy.revenue}</span><strong className="text-xl font-extrabold">{formatCurrency(revenue)}</strong></div>
    </div>}

    {notice && <p className="rounded-xl bg-[var(--kucur-green-soft)] p-3 text-[15px] font-semibold" role="status">{notice}</p>}
    {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[15px] text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}

    {rows.length ? <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((order) => {
      const [first, ...others] = order.items ?? [];
      const next = merchantTransitions[order.status];
      const code = order.orderNumber ?? order.orderCode;
      return <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" key={order.id}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <Link className="min-w-0 min-h-11 hover:underline" to={`/merchant/stores/${storeId}/orders/${order.id}`}><strong className="block text-base text-[var(--kucur-text)]">{t("customerOrders.orderReference", { number: shortOrderCode(code).slice(1) })}</strong><span className="block truncate text-[12px] text-[var(--kucur-text-muted)]" title={code}>{code}</span></Link>
          <StatusBadge className="shrink-0" status={order.status} />
        </div>
        <div className="grid gap-0.5 text-[15px]"><strong>{order.customerName}</strong>{first && <span className="text-[var(--kucur-text-muted)]">{copy.items.replace("{name}", first.productName).replace("{qty}", first.quantity)}{others.length > 0 && ` ${copy.more.replace("{count}", others.length)}`}</span>}<time className="text-[13px] text-[var(--kucur-text-muted)]" dateTime={order.createdAt}>{formatDate(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time></div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kucur-border)] pt-3">
          <div><span className="block text-[13px] text-[var(--kucur-text-muted)]">{copy.cod}</span><strong className="text-lg font-extrabold">{formatCurrency(order.totalAmount)}</strong></div>
          <div className="flex gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-[var(--kucur-border-strong)] px-3 text-sm font-bold" to={`/merchant/stores/${storeId}/orders/${order.id}`}>{copy.detail}</Link>
            {next && <button className="inline-flex min-h-11 items-center rounded-xl bg-[var(--kucur-green)] px-3 text-sm font-bold text-[var(--kucur-on-green)]" type="button" onClick={() => setPending({ order, next })}>{t(`merchantOrderDetail.${actionLabelKeys[next]}`)}</button>}
          </div>
        </div>
      </article>;
    })}</div> : !error && <EmptyState title={copy.empty} description={copy.emptyHint} />}
    {rows.length > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} />}

    <ActionDialog open={Boolean(pending)} busy={busy} title={pending ? t(`merchantOrderDetail.${confirmKeys[pending.next]}`) : ""} description={pending?.next === "processing" ? `${t("merchantOrderDetail.noCancelAfterPacking")} ${t("merchantOrderDetail.irreversible")}` : t("merchantOrderDetail.irreversible")} cancelLabel={t("merchantOrderDetail.cancel")} confirmLabel={busy ? t("merchantOrderDetail.processing") : t("merchantOrderDetail.continue")} onCancel={() => setPending(null)} onConfirm={advance} />
  </PageContainer>;
}

export default function OrderManagement() {
  const { storeId } = useParams(); const resolvedStoreId = canonicalStoreId(storeId); const { stores } = useStore();
  const routeStore = stores.find((store) => String(store.id) === resolvedStoreId);
  return <OrderManagementWorkspace key={resolvedStoreId} storeId={resolvedStoreId} routeStore={routeStore}/>;
}
