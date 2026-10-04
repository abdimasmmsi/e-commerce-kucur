import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { paginate } from "../../utils/pagination";

const PAGE_SIZE = 12;

export default function Couriers() {
  const { language, t } = usePreferences();
  const copy = language === "id" ? { title: "Manajemen Kurir", description: "Pantau status dan kapasitas kurir E-Commerce.", search: "Cari nama, email, atau telepon", loading: "Memuat daftar kurir", error: "Daftar kurir gagal dimuat", empty: "Kurir tidak ditemukan", emptyHint: "Belum ada kurir yang sesuai dengan pencarian ini.", active: "Aktif", inactive: "Tidak aktif", capacity: "Kapasitas aktif", detail: "Lihat detail" } : { title: "Courier Management", description: "Monitor E-Commerce courier status and capacity.", search: "Search name, email, or phone", loading: "Loading couriers", error: "Could not load couriers", empty: "No couriers found", emptyHint: "No courier matches the current search.", active: "Active", inactive: "Inactive", capacity: "Active capacity", detail: "View details" };
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { let active = true; deliveryApi.couriers().then((data) => { if (active) setRows(data); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return rows.filter((row) => !value || [row.user?.fullName, row.user?.email, row.user?.phone].some((item) => String(item ?? "").toLowerCase().includes(value))); }, [query, rows]);
  const visibleRows = paginate(filtered, page, PAGE_SIZE);
  return <div className="page-container admin-operations-page min-w-0">
    <PageHeader eyebrow={t("workspace.admin")} title={copy.title} description={copy.description} />
    <section className="mb-5 rounded-kucur-card border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4"><label className="admin-form-control max-w-2xl"><span>{copy.search}</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={copy.search} /></label></section>
    {error && <p className="admin-error mb-4" role="alert">{copy.error}</p>}
    {loading ? <LoadingPanel label={copy.loading} rows={5} /> : filtered.length ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleRows.map((row) => <article className="card grid min-w-0 gap-3" key={row.userId}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{row.user.fullName}</h2><p className="break-all text-sm text-[var(--kucur-text-muted)]">{row.user.email}</p></div><StatusBadge status={row.isActive ? "active" : "inactive"}>{row.isActive ? copy.active : copy.inactive}</StatusBadge></div><dl className="grid gap-1 text-sm"><div className="flex justify-between gap-3"><dt>{copy.capacity}</dt><dd className="font-semibold">{row.maxActiveDeliveries}</dd></div></dl><Link className="secondary-button justify-self-start" to={`/admin/couriers/${row.userId}`}>{copy.detail}</Link></article>)}</section><Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage}/></> : <EmptyState title={copy.empty} description={copy.emptyHint} />}
  </div>;
}
