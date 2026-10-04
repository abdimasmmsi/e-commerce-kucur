import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "../../components/ProductImage";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import { getStores } from "../../data/mockStores";
import { getSchedulesByStoreId, getTourismServices, isTourismScheduleBookable, TOURISM_UPDATED_EVENT } from "../../services/tourismService";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const duration = (minutes) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} jam` : ""}${minutes % 60 ? ` ${minutes % 60} menit` : ""}`.trim();

function EducationalTourism() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [, setRevision] = useState(0);
  const stores = useMemo(() => getStores(), []);
  useEffect(() => { const refresh = () => setRevision((value) => value + 1); window.addEventListener(TOURISM_UPDATED_EVENT, refresh); return () => window.removeEventListener(TOURISM_UPDATED_EVENT, refresh); }, []);
  const rows = getTourismServices().filter((item) => item.status === "active" && item.name.toLowerCase().includes(search.trim().toLowerCase())).map((item) => ({ ...item, schedules: getSchedulesByStoreId(item.storeId, item.id).filter((schedule) => isTourismScheduleBookable(schedule) && (!date || schedule.date === date)).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)) })).filter((item) => !date || item.schedules.length);
  return <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader title="Wisata Edukasi" description="Temukan pengalaman belajar langsung bersama warga Desa Kucur." />
    <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-sm font-semibold text-[var(--kucur-text)]"><span>Cari pengalaman</span><input className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama wisata" /></label><label className="grid min-w-0 gap-1.5 text-sm font-semibold text-[var(--kucur-text)]"><span>Tanggal tersedia</span><input className="w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 py-2.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((tour) => { const store = stores.find((item) => String(item.id) === String(tour.storeId)); const next = tour.schedules[0]; return <article className="group grid min-w-0 overflow-hidden rounded-2xl border border-amber-200 bg-[var(--kucur-surface)]" key={tour.id}><ProductImage className="aspect-[4/3] w-full bg-amber-50 object-cover transition group-hover:scale-[1.02]" product={tour} alt={tour.name} /><div className="grid min-w-0 gap-2 p-4"><span className="text-xs font-bold uppercase tracking-wide text-amber-700">{store?.name ?? "Lapak Wisata"}</span><h2 className="break-words text-lg font-bold text-[var(--kucur-text)]">{tour.name}</h2><p className="line-clamp-3 text-sm leading-6 text-[var(--kucur-text-muted)]">{tour.shortDescription}</p><div className="flex flex-wrap gap-2 text-xs text-[var(--kucur-text-muted)]"><span className="rounded-full bg-slate-100 px-2.5 py-1">Durasi {duration(tour.durationMinutes)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{tour.location?.label ?? "Lokasi belum diatur"}</span></div><strong className="text-lg text-emerald-700">{rupiah.format(tour.pricePerPerson)} / orang</strong>{next ? <span className="break-words text-sm font-medium text-amber-800">Jadwal berikutnya: {new Date(`${next.date}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "medium" })}, {next.startTime}</span> : <span className="text-sm text-[var(--kucur-text-muted)]">Belum ada jadwal tersedia</span>}<Link className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 font-bold text-white" to={`/educational-tourism/${tour.id}`}>Lihat Pengalaman</Link></div></article>; })}</div>
    {!rows.length && <EmptyState title="Wisata tidak ditemukan" description="Coba ubah pencarian atau tanggal kunjungan." />}
  </div>;
}

export default EducationalTourism;
