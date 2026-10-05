import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AddressForm from "../../components/location/AddressForm";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { addressProblem, emptyAddress, saveCheckoutDraft } from "../../utils/address";

const MAX_ADDRESSES = 5;
const toPayload = (address) => ({ ...address, latitude: Number(address.latitude), longitude: Number(address.longitude) });

// Akun → Alamat Saya: maksimal 5 alamat, satu alamat utama yang dipakai otomatis saat checkout.
export default function Addresses() {
  const { updateAddresses, user } = useAuth();
  const { language } = usePreferences();
  const copy = language === "id" ? {
    eyebrow: "Akun Kucur", title: "Alamat Saya", subtitle: "Alamat utama dipakai otomatis saat checkout. Maksimal {max} alamat.", primary: "Utama", makePrimary: "Jadikan utama", edit: "Ubah", remove: "Hapus", add: "+ Tambah alamat", full: "Sudah {max} alamat. Hapus salah satu untuk menambah.",
    newTitle: "Alamat baru", editTitle: "Ubah alamat", save: "Simpan alamat", saving: "Menyimpan...", cancel: "Batal", saved: "Alamat tersimpan.", empty: "Belum ada alamat", emptyHint: "Tambahkan alamat supaya checkout lebih cepat.", confirmRemove: "Hapus alamat ini?", yes: "Ya, hapus", backToCheckout: "← Kembali ke checkout",
  } : {
    eyebrow: "Kucur account", title: "My Addresses", subtitle: "Your main address is used automatically at checkout. Up to {max} addresses.", primary: "Main", makePrimary: "Make main", edit: "Edit", remove: "Delete", add: "+ Add address", full: "You already have {max} addresses. Delete one to add another.",
    newTitle: "New address", editTitle: "Edit address", save: "Save address", saving: "Saving...", cancel: "Cancel", saved: "Address saved.", empty: "No addresses yet", emptyHint: "Add an address to make checkout faster.", confirmRemove: "Delete this address?", yes: "Yes, delete", backToCheckout: "← Back to checkout",
  };
  const addresses = user?.addresses ?? [];
  const navigate = useNavigate();
  const { state } = useLocation();
  // Dibuka dari checkout: tombol kembali + setelah alamat baru tersimpan langsung balik ke checkout.
  const fromCheckout = typeof state?.returnTo === "string" && state.returnTo.startsWith("/checkout");
  const startNew = fromCheckout && state.openNew && addresses.length < MAX_ADDRESSES;
  const [editing, setEditing] = useState(startNew ? "new" : null);
  const [draft, setDraft] = useState(() => startNew ? emptyAddress({ recipientName: user?.fullName ?? "", phone: user?.phone ?? "" }) : null);
  const backToCheckout = () => { if (window.history.state?.idx > 0) navigate(-1); else navigate(state.returnTo, { replace: true }); };
  const [confirmId, setConfirmId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const persist = async (next) => {
    setBusy(true); setMessage({ type: "", text: "" });
    const result = await updateAddresses(next.map(toPayload));
    setBusy(false);
    if (!result.success) { setMessage({ type: "error", text: result.message }); return null; }
    setMessage({ type: "success", text: copy.saved });
    return result;
  };
  const openNew = () => { setEditing("new"); setDraft(emptyAddress({ recipientName: user?.fullName ?? "", phone: user?.phone ?? "" })); setMessage({ type: "", text: "" }); };
  const openEdit = (address) => { setEditing(address.id); setDraft({ ...address }); setMessage({ type: "", text: "" }); };
  const saveDraft = async () => {
    const problem = addressProblem(draft, language);
    if (problem) { setMessage({ type: "error", text: problem }); return; }
    const next = editing === "new" ? [...addresses, { ...draft, isPrimary: addresses.length === 0 }] : addresses.map((row) => row.id === editing ? { ...draft, isPrimary: row.isPrimary } : row);
    const result = await persist(next);
    if (!result) return;
    if (fromCheckout && editing === "new") {
      const known = new Set(addresses.map((row) => row.id));
      const added = result.user?.addresses?.find((row) => !known.has(row.id));
      if (added) saveCheckoutDraft({ addressId: added.id });
      backToCheckout();
      return;
    }
    setEditing(null); setDraft(null);
  };
  const makePrimary = (id) => persist(addresses.map((row) => ({ ...row, isPrimary: row.id === id })));
  const remove = async (id) => { await persist(addresses.filter((row) => row.id !== id)); setConfirmId(""); };
  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold disabled:opacity-50";
  const form = <section className="grid gap-4 rounded-2xl border border-[var(--kucur-green)] bg-[var(--kucur-surface)] p-4 sm:p-5">
    <h2 className="text-lg font-extrabold">{editing === "new" ? copy.newTitle : copy.editTitle}</h2>
    <AddressForm value={draft} onChange={setDraft} />
    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><button className={`${buttonClass} border border-[var(--kucur-border-strong)]`} type="button" disabled={busy} onClick={() => { setEditing(null); setDraft(null); }}>{copy.cancel}</button><button className={`${buttonClass} bg-[var(--kucur-green)] text-[var(--kucur-on-green)]`} type="button" disabled={busy} onClick={saveDraft}>{busy ? copy.saving : copy.save}</button></div>
  </section>;

  return <div className="grid min-w-0 max-w-3xl gap-4">
    {fromCheckout && <button className={`${buttonClass} w-fit border border-[var(--kucur-green)] text-[var(--kucur-green-ink)]`} type="button" onClick={backToCheckout}>{copy.backToCheckout}</button>}
    <header className="grid gap-1"><span className="text-sm font-bold text-[var(--kucur-green-ink)]">{copy.eyebrow}</span><h1 className="text-2xl font-extrabold sm:text-3xl">{copy.title}</h1><p className="text-[15px] text-[var(--kucur-text-muted)]">{copy.subtitle.replace("{max}", MAX_ADDRESSES)}</p></header>
    {message.text && <p className={`rounded-xl p-3 text-[15px] font-semibold ${message.type === "error" ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)]"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
    {addresses.length === 0 && editing !== "new" && <section className="grid gap-1 rounded-2xl border border-dashed border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] p-5 text-center"><strong className="text-base">{copy.empty}</strong><span className="text-sm text-[var(--kucur-text-muted)]">{copy.emptyHint}</span></section>}
    {addresses.map((address) => editing === address.id ? <div key={address.id}>{form}</div> : <article className={`grid gap-2 rounded-2xl border bg-[var(--kucur-surface)] p-4 ${address.isPrimary ? "border-[var(--kucur-green)]" : "border-[var(--kucur-border)]"}`} key={address.id}>
      <div className="flex flex-wrap items-center gap-2"><strong className="text-base">{address.label}</strong>{address.isPrimary && <span className="rounded-full bg-[var(--kucur-green-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--kucur-green-ink)]">{copy.primary}</span>}</div>
      <p className="text-[15px]"><span className="font-semibold">{address.recipientName}</span> · {address.phone}</p>
      <p className="break-words text-[15px] leading-6 text-[var(--kucur-text-muted)]">{address.address}</p>
      {confirmId === address.id ? <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-2 dark:bg-rose-950/40"><span className="text-sm font-semibold">{copy.confirmRemove}</span><button className={`${buttonClass} bg-rose-600 text-white`} type="button" disabled={busy} onClick={() => void remove(address.id)}>{copy.yes}</button><button className={`${buttonClass} border border-[var(--kucur-border-strong)]`} type="button" onClick={() => setConfirmId("")}>{copy.cancel}</button></div>
        : <div className="flex flex-wrap gap-2">{!address.isPrimary && <button className={`${buttonClass} border border-[var(--kucur-green)] text-[var(--kucur-green-ink)]`} type="button" disabled={busy || Boolean(editing)} onClick={() => void makePrimary(address.id)}>{copy.makePrimary}</button>}<button className={`${buttonClass} border border-[var(--kucur-border-strong)]`} type="button" disabled={busy || Boolean(editing)} onClick={() => openEdit(address)}>{copy.edit}</button><button className={`${buttonClass} text-rose-700 dark:text-rose-300`} type="button" disabled={busy || Boolean(editing)} onClick={() => setConfirmId(address.id)}>{copy.remove}</button></div>}
    </article>)}
    {editing === "new" && form}
    {!editing && (addresses.length < MAX_ADDRESSES ? <button className={`${buttonClass} min-h-12 w-full border border-[var(--kucur-green)] text-base text-[var(--kucur-green-ink)] sm:w-fit`} type="button" onClick={openNew}>{copy.add}</button> : <p className="text-sm text-[var(--kucur-text-muted)]">{copy.full.replace("{max}", MAX_ADDRESSES)}</p>)}
  </div>;
}
