import { useEffect, useMemo, useState } from "react";
import ActionDialog from "../../components/ui/ActionDialog";
import Button from "../../components/ui/Button";
import LoadingPanel from "../../components/ui/LoadingPanel";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePreferences } from "../../context/PreferencesContext";
import { FAQS } from "../../data/faq.js";
import { faqEntriesService } from "../../services/faqEntriesService";
import { buildFaqList, detectConcepts, matchFaq } from "../../utils/faqMatcher.js";
import { exportFaqExcel, parseFaqExcel } from "../../utils/faqExcel.js";

const ROLES = ["visitor", "customer", "merchant", "courier", "admin"];
const copyByLanguage = {
  id: {
    title: "FAQ Chatbot", description: "Atur jawaban chatbot bantuan: ubah FAQ bawaan, sembunyikan, atau tambah FAQ baru. Perubahan langsung dipakai chatbot semua pengguna.",
    roles: { all: "Semua", visitor: "Pengunjung", customer: "Pembeli", merchant: "Lapak", courier: "Kurir", admin: "Admin" },
    add: "+ Tambah FAQ", search: "Cari pertanyaan", count: "{count} FAQ", builtin: "Bawaan", edited: "Diubah", custom: "Buatan admin", hidden: "Disembunyikan", pinned: "Topik awal",
    edit: "Ubah", hide: "Sembunyikan", show: "Tampilkan", reset: "Kembalikan bawaan", remove: "Hapus", empty: "Tidak ada FAQ yang cocok.",
    tester: "Coba chatbot", testerHint: "Tulis pertanyaan seperti pengguna, lalu lihat FAQ mana yang dipilih chatbot.", testerPlaceholder: "Contoh: gimana cara batal pesanan", asRole: "Sebagai", resultConfirm: "Chatbot menjawab:", resultChoose: "Chatbot menawarkan pilihan:", resultUnknown: "Chatbot belum paham. Tambahkan kata kunci di FAQ yang sesuai.",
    formNew: "Tambah FAQ", formEdit: "Ubah FAQ", questionId: "Pertanyaan (Indonesia)", questionEn: "Pertanyaan (Inggris)", answerId: "Jawaban (Indonesia)", answerEn: "Jawaban (Inggris)", answerHint: "Satu langkah per baris (maks 8). Tulis **teks** untuk huruf tebal. Angka dari Admin Settings: {cutoff}, {dispatch}, {rate}, {tax}, {adminFee}, {contact}.",
    rolesLabel: "Tampil untuk", keywords: "Kata kunci tambahan", keywordsHint: "Pisahkan dengan koma. Dipakai chatbot untuk mengenali pertanyaan, mis. wifi, jam buka, parkir.", link: "Tombol pintasan", noLink: "Tanpa tombol", pinnedLabel: "Tampilkan di topik awal chatbot",
    save: "Simpan", saving: "Menyimpan...", cancel: "Batal", saved: "FAQ tersimpan dan langsung dipakai chatbot.", notRecognized: "Chatbot belum bisa mengenali pertanyaan ini dari kata-katanya. Tambahkan kata kunci supaya mudah ditemukan.",
    excelExport: "Unduh Excel", excelTemplate: "Unduh contoh", excelImport: "Impor Excel", excelHint: "Ubah banyak FAQ sekaligus lewat Excel: unduh, ubah, lalu impor. Gunakan contoh untuk melihat format.", importTitle: "Impor FAQ dari Excel", importText: "Isi file menggantikan semua perubahan FAQ sebelumnya. FAQ bawaan yang tidak ada di file kembali ke versi bawaan.", importAdded: "{count} FAQ baru", importChanged: "{count} FAQ bawaan diubah", importHidden: "{count} FAQ disembunyikan", importErrors: "Perbaiki dulu baris berikut di Excel, lalu impor ulang:", importRow: "Baris {row}", importConfirm: "Impor & simpan", importDone: "FAQ dari Excel tersimpan dan langsung dipakai chatbot.", reading: "Membaca file...",
    removeTitle: "Hapus FAQ ini?", removeText: "FAQ buatan admin ini akan dihapus dari chatbot.", resetTitle: "Kembalikan ke bawaan?", resetText: "Perubahan admin pada FAQ ini dibuang dan jawaban bawaan dipakai lagi.",
  },
  en: {
    title: "Chatbot FAQ", description: "Manage the help chatbot answers: edit built-in FAQs, hide them, or add new ones. Changes apply to every user's chatbot right away.",
    roles: { all: "All", visitor: "Visitors", customer: "Buyers", merchant: "Stores", courier: "Couriers", admin: "Admin" },
    add: "+ Add FAQ", search: "Search questions", count: "{count} FAQs", builtin: "Built-in", edited: "Edited", custom: "Admin-made", hidden: "Hidden", pinned: "Starter topic",
    edit: "Edit", hide: "Hide", show: "Show", reset: "Restore built-in", remove: "Delete", empty: "No FAQ matches.",
    tester: "Try the chatbot", testerHint: "Type a question like a user would and see which FAQ the chatbot picks.", testerPlaceholder: "Example: how do I cancel an order", asRole: "As", resultConfirm: "Chatbot answers:", resultChoose: "Chatbot offers choices:", resultUnknown: "The chatbot does not understand yet. Add keywords to the right FAQ.",
    formNew: "Add FAQ", formEdit: "Edit FAQ", questionId: "Question (Indonesian)", questionEn: "Question (English)", answerId: "Answer (Indonesian)", answerEn: "Answer (English)", answerHint: "One step per line (max 8). Write **text** for bold. Admin Settings values: {cutoff}, {dispatch}, {rate}, {tax}, {adminFee}, {contact}.",
    rolesLabel: "Show to", keywords: "Extra keywords", keywordsHint: "Separate with commas. Helps the chatbot recognise the question, e.g. wifi, opening hours, parking.", link: "Shortcut button", noLink: "No button", pinnedLabel: "Show in the chatbot starter topics",
    save: "Save", saving: "Saving...", cancel: "Cancel", saved: "FAQ saved and used by the chatbot right away.", notRecognized: "The chatbot cannot recognise this question from its words yet. Add keywords so users can find it.",
    excelExport: "Download Excel", excelTemplate: "Download example", excelImport: "Import Excel", excelHint: "Change many FAQs at once in Excel: download, edit, then import. Use the example to see the format.", importTitle: "Import FAQs from Excel", importText: "The file replaces all earlier FAQ changes. Built-in FAQs missing from the file go back to their built-in version.", importAdded: "{count} new FAQs", importChanged: "{count} built-in FAQs changed", importHidden: "{count} FAQs hidden", importErrors: "Fix these rows in Excel first, then import again:", importRow: "Row {row}", importConfirm: "Import & save", importDone: "FAQs from Excel saved and used by the chatbot right away.", reading: "Reading file...",
    removeTitle: "Delete this FAQ?", removeText: "This admin-made FAQ will be removed from the chatbot.", resetTitle: "Restore built-in?", resetText: "Admin changes to this FAQ are discarded and the built-in answer is used again.",
  },
};
const inputClass = "min-h-11 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-[15px] text-[var(--kucur-text)]";
const areaClass = `${inputClass} min-h-28 resize-y py-2.5`;
// Pilihan tombol pintasan diambil dari tautan FAQ bawaan (rute yang pasti ada).
const LINK_OPTIONS = [...new Map(FAQS.filter((faq) => faq.link).map((faq) => [faq.link.to, faq.link])).values()];
const emptyForm = { id: "", builtin: false, qId: "", qEn: "", aId: "", aEn: "", roles: ["customer"], keywords: "", linkTo: "", pinned: false };
const newId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function FaqManager() {
  const { language, t } = usePreferences();
  const lang = language === "en" ? "en" : "id";
  const copy = copyByLanguage[lang];
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [test, setTest] = useState({ text: "", role: "customer" });
  const [importing, setImporting] = useState(null);

  useEffect(() => {
    let active = true;
    faqEntriesService.list().then((rows) => { if (active) setEntries(rows); }).catch((caught) => { if (active) setMessage({ type: "error", text: caught.message }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const merged = useMemo(() => buildFaqList(entries), [entries]);
  // Daftar admin: semua FAQ bawaan (termasuk yang disembunyikan) + FAQ buatan admin.
  const rows = useMemo(() => {
    const visible = new Map(merged.map((faq) => [faq.id, faq]));
    const builtins = FAQS.map((faq) => { const entry = entryById.get(faq.id); return { ...(visible.get(faq.id) ?? faq), kind: entry ? (entry.hidden ? "hidden" : "edited") : "builtin", entry }; });
    const customs = entries.filter((entry) => !entry.builtin).map((entry) => ({ ...(visible.get(entry.id) ?? entry), kind: entry.hidden ? "hidden" : "custom", custom: true, entry }));
    const query = search.trim().toLowerCase();
    return [...customs, ...builtins].filter((faq) => (roleFilter === "all" || faq.roles?.includes(roleFilter)) && (!query || `${faq.q?.id ?? ""} ${faq.q?.en ?? ""}`.toLowerCase().includes(query)));
  }, [entries, entryById, merged, roleFilter, search]);
  const testResult = useMemo(() => (test.text.trim() ? matchFaq(test.text, test.role, "", merged) : null), [merged, test]);

  const persist = async (next) => {
    setBusy(true); setMessage({ type: "", text: "" });
    try { const saved = await faqEntriesService.save(next); setEntries(Array.isArray(saved?.faqEntries) ? saved.faqEntries : next); setMessage({ type: "success", text: copy.saved }); return true; }
    catch (caught) { setMessage({ type: "error", text: caught.message }); return false; }
    finally { setBusy(false); }
  };
  const withEntry = (entry) => [...entries.filter((item) => item.id !== entry.id), entry];
  const openEdit = (faq) => setForm({ id: faq.id, builtin: !faq.custom, qId: faq.q?.id ?? "", qEn: faq.q?.en ?? "", aId: (faq.a?.id ?? []).join("\n"), aEn: (faq.a?.en ?? []).join("\n"), roles: faq.roles ?? ["customer"], keywords: (faq.keywords ?? faq.entry?.keywords ?? []).join(", "), linkTo: faq.link?.to ?? "", pinned: Boolean(faq.pinned ?? faq.entry?.pinned) });
  const toEntry = (value) => {
    const link = LINK_OPTIONS.find((option) => option.to === value.linkTo);
    return { id: value.id || newId(), builtin: value.builtin, hidden: false, pinned: value.pinned, roles: value.roles, keywords: value.keywords.split(",").map((word) => word.trim()).filter(Boolean), link: link ? { to: link.to, label: link.label } : null, q: { id: value.qId.trim(), en: value.qEn.trim() }, a: { id: value.aId.split("\n").map((line) => line.trim()).filter(Boolean), en: value.aEn.split("\n").map((line) => line.trim()).filter(Boolean) } };
  };
  const saveForm = async () => { if (await persist(withEntry(toEntry(form)))) setForm(null); };
  const toggleHidden = (faq) => {
    if (faq.custom) return persist(withEntry({ ...faq.entry, hidden: !faq.entry.hidden }));
    if (faq.kind === "hidden") return persist(faq.entry.q ? withEntry({ ...faq.entry, hidden: false }) : entries.filter((item) => item.id !== faq.id));
    return persist(withEntry(faq.entry ? { ...faq.entry, hidden: true } : { id: faq.id, builtin: true, hidden: true }));
  };
  const exportExcel = async (template) => { setBusy(true); try { await exportFaqExcel({ faqs: merged, entries, template }); } catch (caught) { setMessage({ type: "error", text: caught.message }); } finally { setBusy(false); } };
  const readExcel = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy(true); setMessage({ type: "", text: "" });
    try { setImporting({ fileName: file.name, ...(await parseFaqExcel(file)) }); }
    catch (caught) { setMessage({ type: "error", text: caught.message }); }
    finally { setBusy(false); }
  };
  const confirmImport = async () => { if (await persist(importing.entries)) { setImporting(null); setMessage({ type: "success", text: copy.importDone }); } };
  const runConfirm = async () => { const { faq } = confirm; if (await persist(entries.filter((item) => item.id !== faq.id))) setConfirm(null); };

  const formValid = form && form.qId.trim() && form.qEn.trim() && form.aId.trim() && form.aEn.trim() && form.roles.length;
  const formRecognized = form && (detectConcepts(form.qId).concepts.length || form.keywords.trim());
  const badge = (kind) => <StatusBadge status={{ builtin: "inactive", edited: "confirmed", custom: "active", hidden: "pending" }[kind]}>{copy[kind]}</StatusBadge>;

  return <div className="page-container admin-operations-page min-w-0 text-[var(--kucur-text)]">
    <PageHeader eyebrow={t("workspace.adminEyebrow")} title={copy.title} description={copy.description} actions={<Button onClick={() => setForm({ ...emptyForm })}>{copy.add}</Button>} />
    {message.text && <p className={`mb-4 rounded-xl p-4 text-[15px] font-semibold ${message.type === "error" ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-[var(--kucur-green-soft)] text-[var(--kucur-text)]"}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}

    <section className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4" aria-label="Excel">
      <p className="w-full text-sm text-[var(--kucur-text-muted)] sm:w-auto sm:flex-1">{copy.excelHint}</p>
      <Button variant="secondary" disabled={busy} onClick={() => exportExcel(false)}>{copy.excelExport}</Button>
      <Button variant="secondary" disabled={busy} onClick={() => exportExcel(true)}>{copy.excelTemplate}</Button>
      <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[var(--kucur-green)] px-5 text-[15px] font-bold text-[var(--kucur-green-ink)] sm:min-h-11 ${busy ? "pointer-events-none opacity-50" : ""}`}>{busy ? copy.reading : copy.excelImport}<input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readExcel} /></label>
    </section>
    <section className="mb-4 grid gap-3 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)] p-4 sm:p-5" aria-labelledby="faq-tester">
      <div><h2 className="text-lg font-extrabold" id="faq-tester">{copy.tester}</h2><p className="text-sm text-[var(--kucur-text-muted)]">{copy.testerHint}</p></div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label><span className="sr-only">{copy.tester}</span><input className={inputClass} value={test.text} placeholder={copy.testerPlaceholder} onChange={(event) => setTest((value) => ({ ...value, text: event.target.value }))} /></label>
        <label className="flex items-center gap-2 text-sm font-semibold"><span className="shrink-0">{copy.asRole}</span><select className={inputClass} value={test.role} onChange={(event) => setTest((value) => ({ ...value, role: event.target.value }))}>{ROLES.map((role) => <option value={role} key={role}>{copy.roles[role]}</option>)}</select></label>
      </div>
      {testResult && <div className="rounded-xl bg-[var(--kucur-surface-elevated)] p-3 text-[15px]" aria-live="polite">{testResult.status === "unknown" ? <p className="font-semibold text-[var(--kucur-amber-ink)]">{copy.resultUnknown}</p> : <><p className="mb-1 text-sm text-[var(--kucur-text-muted)]">{testResult.status === "confirm" ? copy.resultConfirm : copy.resultChoose}</p><ul className="grid gap-1">{testResult.matches.map((faq) => <li className="font-semibold" key={faq.id}>• {faq.q[lang]}</li>)}</ul></>}</div>}
    </section>

    <section className="min-w-0 rounded-xl border border-[var(--kucur-border)] bg-[var(--kucur-surface)]">
      <div className="grid gap-3 p-4 sm:p-5">
        <label><span className="sr-only">{copy.search}</span><input className={inputClass} type="search" value={search} placeholder={copy.search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" role="group">{["all", ...ROLES].map((role) => <button className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-bold ${roleFilter === role ? "border-[var(--kucur-brand)] bg-[var(--kucur-brand)] text-[var(--kucur-on-brand)]" : "border-[var(--kucur-border)] text-[var(--kucur-text)]"}`} type="button" aria-pressed={roleFilter === role} key={role} onClick={() => setRoleFilter(role)}>{copy.roles[role]}</button>)}</div>
        <p className="text-sm text-[var(--kucur-text-muted)]">{copy.count.replace("{count}", rows.length)}</p>
      </div>
      {loading ? <div className="p-4"><LoadingPanel label={copy.title} rows={4} /></div> : rows.length ? <ul>{rows.map((faq) => <li className={`grid min-w-0 gap-2 border-t border-[var(--kucur-border)] px-4 py-3.5 sm:px-5 ${faq.kind === "hidden" ? "opacity-70" : ""}`} key={faq.id}>
        <div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 flex-1 break-words text-[15px]">{faq.q?.[lang] ?? faq.id}</strong><div className="flex flex-wrap gap-1.5">{badge(faq.kind)}{faq.pinned && faq.kind !== "hidden" && <StatusBadge status="planned">{copy.pinned}</StatusBadge>}</div></div>
        <p className="text-sm text-[var(--kucur-text-muted)]">{(faq.roles ?? []).map((role) => copy.roles[role]).join(" · ")}</p>
        <div className="flex flex-wrap gap-2">
          {faq.kind !== "hidden" && <Button variant="secondary" className="!min-h-10 !px-4 !text-sm" disabled={busy} onClick={() => openEdit(faq)}>{copy.edit}</Button>}
          <Button variant="secondary" className="!min-h-10 !px-4 !text-sm" disabled={busy} onClick={() => void toggleHidden(faq)}>{faq.kind === "hidden" ? copy.show : copy.hide}</Button>
          {faq.kind === "edited" && <Button variant="secondary" className="!min-h-10 !px-4 !text-sm" disabled={busy} onClick={() => setConfirm({ faq, type: "reset" })}>{copy.reset}</Button>}
          {faq.custom && <Button variant="secondary" className="!min-h-10 !px-4 !text-sm" disabled={busy} onClick={() => setConfirm({ faq, type: "remove" })}>{copy.remove}</Button>}
        </div>
      </li>)}</ul> : <p className="border-t border-[var(--kucur-border)] px-4 py-5 text-[15px] text-[var(--kucur-text-muted)] sm:px-5">{copy.empty}</p>}
    </section>

    <ActionDialog open={Boolean(form)} busy={busy} title={form?.id ? copy.formEdit : copy.formNew} confirmLabel={busy ? copy.saving : copy.save} cancelLabel={copy.cancel} confirmDisabled={!formValid} onCancel={() => setForm(null)} onConfirm={saveForm}>
      {form && <>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.questionId}<input className={inputClass} maxLength="200" value={form.qId} onChange={(event) => setForm((value) => ({ ...value, qId: event.target.value }))} /></label>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.questionEn}<input className={inputClass} maxLength="200" value={form.qEn} onChange={(event) => setForm((value) => ({ ...value, qEn: event.target.value }))} /></label>
        <p className="text-[13px] text-[var(--kucur-text-muted)]">{copy.answerHint}</p>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.answerId}<textarea className={areaClass} value={form.aId} onChange={(event) => setForm((value) => ({ ...value, aId: event.target.value }))} /></label>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.answerEn}<textarea className={areaClass} value={form.aEn} onChange={(event) => setForm((value) => ({ ...value, aEn: event.target.value }))} /></label>
        <fieldset className="grid gap-2"><legend className="mb-1.5 text-[15px] font-semibold">{copy.rolesLabel}</legend><div className="flex flex-wrap gap-2">{ROLES.map((role) => { const on = form.roles.includes(role); return <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${on ? "border-[var(--kucur-green)] bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" : "border-[var(--kucur-border-strong)]"}`} key={role}><input className="size-4 accent-[var(--kucur-green)]" type="checkbox" checked={on} onChange={() => setForm((value) => ({ ...value, roles: on ? value.roles.filter((item) => item !== role) : [...value.roles, role] }))} />{copy.roles[role]}</label>; })}</div></fieldset>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.keywords}<input className={inputClass} value={form.keywords} onChange={(event) => setForm((value) => ({ ...value, keywords: event.target.value }))} /><span className="text-[13px] font-normal text-[var(--kucur-text-muted)]">{copy.keywordsHint}</span></label>
        <label className="grid gap-1.5 text-[15px] font-semibold">{copy.link}<select className={inputClass} value={form.linkTo} onChange={(event) => setForm((value) => ({ ...value, linkTo: event.target.value }))}><option value="">{copy.noLink}</option>{LINK_OPTIONS.map((option) => <option value={option.to} key={option.to}>{option.label[lang]} ({option.to})</option>)}</select></label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold"><input className="size-5 accent-[var(--kucur-green)]" type="checkbox" checked={form.pinned} onChange={(event) => setForm((value) => ({ ...value, pinned: event.target.checked }))} />{copy.pinnedLabel}</label>
        {form.qId.trim() && !formRecognized && <p className="rounded-lg bg-[var(--kucur-amber-soft)] px-3 py-2 text-sm font-semibold text-[var(--kucur-amber-ink)]">{copy.notRecognized}</p>}
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(importing)} busy={busy} title={copy.importTitle} description={importing ? `${importing.fileName} · ${copy.importText}` : ""} confirmLabel={busy ? copy.saving : copy.importConfirm} cancelLabel={copy.cancel} confirmDisabled={Boolean(importing?.errors.length)} onCancel={() => setImporting(null)} onConfirm={confirmImport}>
      {importing && <>
        <ul className="grid gap-1 text-[15px] font-semibold">{[["importAdded", importing.summary.added], ["importChanged", importing.summary.changed], ["importHidden", importing.summary.hidden]].map(([key, count]) => <li key={key}>• {copy[key].replace("{count}", count)}</li>)}</ul>
        {importing.errors.length > 0 && <div className="grid gap-1 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert"><strong>{copy.importErrors}</strong><ul className="grid gap-1">{importing.errors.slice(0, 20).map((item) => <li key={`${item.row}-${item.message}`}>{copy.importRow.replace("{row}", item.row)}: {item.message}</li>)}</ul></div>}
      </>}
    </ActionDialog>
    <ActionDialog open={Boolean(confirm)} busy={busy} destructive={confirm?.type === "remove"} title={confirm?.type === "remove" ? copy.removeTitle : copy.resetTitle} description={confirm?.type === "remove" ? copy.removeText : copy.resetText} confirmLabel={confirm?.type === "remove" ? copy.remove : copy.reset} cancelLabel={copy.cancel} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
  </div>;
}
