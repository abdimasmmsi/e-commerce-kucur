import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useChat } from "../../context/ChatContext";
import { liveInApi } from "../../services/liveInApiService";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function LiveInBookingDetail() {
  const { bookingId } = useParams(); const navigate = useNavigate(); const { startSellerChat } = useChat();
  const [item, setItem] = useState(null); const [error, setError] = useState("");
  const load = useCallback(() => liveInApi.getBooking(bookingId).then(setItem).catch((cause) => setError(cause.message)), [bookingId]);
  useEffect(() => { void load(); }, [load]);
  const cancel = async () => { try { await liveInApi.transition(bookingId, "CANCELLED", "Dibatalkan customer"); await load(); } catch (cause) { setError(cause.message); } };
  const chatMerchant = async () => { try { const conversation = await startSellerChat({ liveInBooking: item }); navigate(`/messages/${conversation.id}`); } catch (cause) { setError(cause.message); } };
  if (!item) return <main className="p-6">{error || "Memuat…"}</main>;
  return <main className="mx-auto w-full max-w-4xl min-w-0 space-y-5 px-4 py-6 sm:px-6"><Link to="/live-in-bookings">← Semua booking</Link><section className="grid min-w-0 gap-4 rounded-2xl border p-5"><div className="flex min-w-0 flex-wrap justify-between gap-2"><h1 className="break-all text-2xl font-extrabold">{item.bookingCode}</h1><span>{item.bookingStatus}</span></div><p>{item.checkIn.slice(0, 10)} → {item.checkOut.slice(0, 10)} · {item.nightCount} malam</p>{item.rooms.map((room) => <article className="grid min-w-0 gap-1 rounded-xl bg-[var(--kucur-surface-elevated)] p-3" key={room.id}><strong>{room.roomNameSnapshot}</strong><span>Kapasitas {room.capacitySnapshot} · Makan {room.mealsPerDaySnapshot}x/hari</span><span>{money.format(room.pricePerNightSnapshot)} / malam · subtotal {money.format(room.subtotal)}</span></article>)}<dl className="grid gap-2"><div>Subtotal: <strong>{money.format(item.subtotal)}</strong></div><div>PPN {item.taxPercentSnapshot}%: <strong>{money.format(item.taxAmount)}</strong></div><div>Total: <strong>{money.format(item.grandTotal)}</strong></div></dl><button className="min-h-11 rounded-xl bg-emerald-700 px-4 font-bold text-white" type="button" onClick={chatMerchant}>Chat dengan Merchant</button>{["PENDING_APPROVAL", "CONFIRMED"].includes(item.bookingStatus) && <button className="min-h-11 rounded-xl border border-red-300 px-4 font-bold text-red-700" type="button" onClick={cancel}>Batalkan Booking</button>}{error && <p className="text-red-700" role="alert">{error}</p>}</section></main>;
}
