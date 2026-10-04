import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useChat } from "../../context/ChatContext";
import { tourismApi } from "../../services/tourismApiService";
import { usePreferences } from "../../context/PreferencesContext";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function TourismBookingDetail() {
  const { statusLabel } = usePreferences();
  const { bookingId } = useParams(); const navigate = useNavigate(); const { startSellerChat } = useChat();
  const [item, setItem] = useState(null); const [state, setState] = useState({ loading: true, error: "" });
  const load = useCallback(() => tourismApi.getBooking(bookingId).then((data) => { setItem(data); setState({ loading: false, error: "" }); }).catch((error) => setState({ loading: false, error: error.message })), [bookingId]);
  useEffect(() => { void load(); }, [load]);
  const cancel = async () => { try { await tourismApi.transitionBooking(bookingId, "CANCELLED", "Dibatalkan customer"); await load(); } catch (error) { setState((value) => ({ ...value, error: error.message })); } };
  const chatMerchant = async () => { try { const conversation = await startSellerChat({ tourismBooking: item }); navigate(`/messages/${conversation.id}`); } catch (error) { setState((value) => ({ ...value, error: error.message })); } };
  if (state.loading) return <main className="mx-auto max-w-7xl p-6">Memuat…</main>;
  if (!item) return <main className="mx-auto max-w-7xl p-6" role="alert">{state.error}</main>;
  const details = [["Paket", item.packageNameSnapshot], ["Lapak", item.storeNameSnapshot], ["Jenis", item.bookingType], ["Peserta", item.paxCount], ["Subtotal", money.format(item.subtotal)], ["PPN", `${item.taxPercentSnapshot}% · ${money.format(item.taxAmount)}`], ["Total", money.format(item.grandTotal)], ["Pembayaran", item.paymentStatus]];
  return <main className="mx-auto w-full max-w-4xl min-w-0 space-y-5 px-4 py-6 sm:px-6"><Link to="/tourism-bookings">← Semua booking</Link><section className="grid min-w-0 gap-4 rounded-2xl border border-[var(--kucur-border)] p-4 sm:p-6"><div className="flex min-w-0 flex-wrap justify-between gap-2"><div className="min-w-0"><span className="text-xs font-bold uppercase text-emerald-700">Booking Wisata</span><h1 className="break-all text-2xl font-extrabold">{item.bookingCode}</h1></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{statusLabel(item.status)}</span></div><dl className="grid min-w-0 gap-3 sm:grid-cols-2">{details.map(([key, value]) => <div className="min-w-0" key={key}><dt className="text-sm text-[var(--kucur-text-muted)]">{key}</dt><dd className="break-words font-bold">{value}</dd></div>)}</dl><button className="min-h-11 rounded-xl bg-emerald-700 px-4 font-bold text-white" type="button" onClick={chatMerchant}>Chat dengan Merchant</button>{["PENDING_APPROVAL", "APPROVED", "CONFIRMED"].includes(item.status) && <button className="min-h-11 rounded-xl border border-red-300 px-4 font-bold text-red-700" type="button" onClick={cancel}>Batalkan Booking</button>}{state.error && <p className="text-red-700" role="alert">{state.error}</p>}</section><section className="rounded-2xl border border-[var(--kucur-border)] p-4"><h2 className="font-bold">Riwayat</h2><ol className="mt-3 grid gap-3">{item.activities?.map((activity) => <li className="break-words text-sm" key={activity.id}>{new Date(activity.createdAt).toLocaleString("id-ID")} · {statusLabel(activity.oldStatus || "created")} → {statusLabel(activity.newStatus)}</li>)}</ol></section></main>;
}
