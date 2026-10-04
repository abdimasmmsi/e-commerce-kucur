import { Link, useParams } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import "./AdminOperations.css";
import "./AdminTransactionDetail.css";

const transactions = {
  "TRX-EC-001": {
    status: "picked_up",
    summary: { order: "ORD-1049", customer: "Budi Santoso", merchant: "Toko Oleh-Oleh Kucur", products: "3", total: 285000, courier: "Courier C" },
    activities: [
      ["17 Agu 2026, 08.00", "Budi Santoso", "Customer", "Order created", "—", "Pending", "—"],
      ["17 Agu 2026, 08.12", "Toko Oleh-Oleh Kucur", "Merchant", "Order accepted", "Pending", "Ready for Pickup", "—"],
      ["17 Agu 2026, 08.14", "Assignment Engine", "System", "Courier C assigned", "Waiting for Courier", "Courier Assigned", "Round robin"],
      ["17 Agu 2026, 08.26", "Courier C", "Courier", "Assignment accepted", "Courier Assigned", "Assignment Accepted", "—"],
      ["17 Agu 2026, 09.05", "Courier C", "Courier", "Picked up", "Assignment Accepted", "Picked Up", "Package received from merchant"],
    ],
  },
  "TRX-EC-002": {
    status: "waiting_for_courier",
    summary: { order: "ORD-1058", customer: "Rani Puspita", merchant: "Toko Rasa Nusantara", products: "2", total: 219000, courier: null },
    activities: [
      ["17 Agu 2026, 07.10", "Rani Puspita", "Customer", "Order created", "—", "Pending", "—"],
      ["17 Agu 2026, 07.30", "Toko Rasa Nusantara", "Merchant", "Ready for pickup", "Processing", "Waiting for Courier", "Package is ready"],
      ["17 Agu 2026, 07.35", "Assignment Engine", "System", "No eligible courier", "Waiting for Courier", "Waiting for Courier", "All couriers are unavailable"],
    ],
  },
};

export default function AdminTransactionDetail() {
  const { transactionId } = useParams();
  const { formatCurrency, language, statusLabel } = usePreferences();
  const detail = transactions[transactionId];
  const copy = language === "id" ? {
    eyebrow: "TRANSAKSI E-COMMERCE", description: "Riwayat aktivitas lengkap dan hanya-baca.", back: "Kembali ke Transaksi", missing: "Transaksi tidak ditemukan", missingHint: "ID transaksi ini tidak tersedia pada daftar transaksi E-Commerce.", information: "Informasi Transaksi", order: "Pesanan", customer: "Pelanggan", merchant: "Merchant", products: "Jumlah produk", total: "Total", courier: "Kurir", unassigned: "Belum ditentukan", history: "Riwayat Aktivitas", readonly: "Riwayat hanya-baca dan tidak dapat dihapus.", actor: "Pelaku", status: "Perubahan status", reason: "Alasan", system: "Dibuat Sistem",
  } : {
    eyebrow: "E-COMMERCE TRANSACTION", description: "Complete read-only activity history.", back: "Back to Transactions", missing: "Transaction not found", missingHint: "This transaction ID is not available in the E-Commerce transaction list.", information: "Transaction Information", order: "Order", customer: "Customer", merchant: "Merchant", products: "Product count", total: "Total", courier: "Courier", unassigned: "Unassigned", history: "Activity History", readonly: "This history is read-only and cannot be deleted.", actor: "Actor", status: "Status change", reason: "Reason", system: "System Generated",
  };

  if (!detail) return <div className="page-container admin-operations-page"><PageHeader eyebrow={copy.eyebrow} title={transactionId} description={copy.description} /><EmptyState title={copy.missing} description={copy.missingHint} action={<Link className="secondary-button" to="/admin/transactions">{copy.back}</Link>} /></div>;

  const fields = [
    [copy.order, detail.summary.order], [copy.customer, detail.summary.customer], [copy.merchant, detail.summary.merchant], [copy.products, detail.summary.products], [copy.total, formatCurrency(detail.summary.total)], [copy.courier, detail.summary.courier ?? copy.unassigned],
  ];
  return <div className="page-container admin-operations-page admin-transaction-detail-page">
    <PageHeader eyebrow={copy.eyebrow} title={transactionId} description={copy.description} actions={<Link className="secondary-button" to="/admin/transactions">{copy.back}</Link>} />
    <section className="card transaction-detail-summary"><div><span>{copy.status}</span><StatusBadge status={detail.status} /></div></section>
    <section className="card transaction-type-info"><h2 className="admin-section-title">{copy.information}</h2><div className="admin-info-grid">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
    <section className="card full-activity-section"><p className="readonly-history-note">{copy.readonly}</p><h2 className="admin-section-title">{copy.history}</h2><div className="admin-timeline">{detail.activities.map(([timestamp, name, role, action, oldStatus, nextStatus, reason], index) => <article className={`admin-timeline-item actor-${role.toLowerCase()}`} key={`${timestamp}-${index}`}><i /><div className="full-activity-card"><div className="admin-timeline-heading"><span className="actor">{role}</span><strong>{action}</strong><time>{timestamp}</time>{role === "System" && <em>{copy.system}</em>}</div><dl className="activity-meta"><div><dt>{copy.actor}</dt><dd>{name}</dd></div><div><dt>{copy.status}</dt><dd>{statusLabel(oldStatus)} → {statusLabel(nextStatus)}</dd></div><div><dt>{copy.reason}</dt><dd>{reason}</dd></div></dl></div></article>)}</div></section>
  </div>;
}
