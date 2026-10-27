import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { deliveryApi } from "../../services/deliveryApiService";
import { useLiveRefresh } from "../../utils/liveRefresh";

export default function CourierDetail() {
  const { courierId } = useParams();
  const { language, t } = usePreferences();
  const copy = language === "id" ? { description: "Profil operasional dan kapasitas pengiriman.", back: "Kembali ke Kurir", loading: "Memuat detail kurir", missing: "Kurir tidak ditemukan", missingHint: "Profil kurir tidak tersedia atau gagal dimuat.", email: "Email", phone: "Telepon", status: "Status", capacity: "Kapasitas pengiriman aktif", active: "Aktif", inactive: "Tidak aktif" } : { description: "Operational profile and delivery capacity.", back: "Back to Couriers", loading: "Loading courier details", missing: "Courier not found", missingHint: "The courier profile is unavailable or could not be loaded.", email: "Email", phone: "Phone", status: "Status", capacity: "Active delivery capacity", active: "Active", inactive: "Inactive" };
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState("");
  useEffect(() => { let active = true; deliveryApi.couriers().then((items) => { if (active) setRow(items.find((item) => item.userId === courierId) || null); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [courierId]);
  useLiveRefresh(() => deliveryApi.couriers().then((items) => setRow(items.find((item) => item.userId === courierId) || null)).catch(() => {}), { enabled: !loading });
  if (loading) return <div className="page-container"><LoadingPanel label={copy.loading} rows={4} /></div>;
  if (!row) return <div className="page-container"><EmptyState title={copy.missing} description={copy.missingHint} action={<Link className="secondary-button" to="/admin/couriers">{copy.back}</Link>} /></div>;
  return <div className="page-container admin-operations-page"><PageHeader eyebrow={t("workspace.adminEyebrow")} title={row.user.fullName} description={copy.description} actions={<Link className="secondary-button" to="/admin/couriers">{copy.back}</Link>} /><section className="card"><dl className="admin-info-grid"><div><span>{copy.email}</span><strong className="break-all">{row.user.email}</strong></div><div><span>{copy.phone}</span><strong>{row.user.phone || "—"}</strong></div><div><span>{copy.status}</span><StatusBadge status={row.isActive ? "active" : "inactive"}>{row.isActive ? copy.active : copy.inactive}</StatusBadge></div><div><span>{copy.capacity}</span><strong>{row.maxActiveDeliveries}</strong></div></dl></section></div>;
}
