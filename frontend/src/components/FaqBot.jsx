import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { usePreferences } from "../context/PreferencesContext";
import { useSystemSettings } from "../context/SystemSettingsContext";
import { STARTER_TOPICS } from "../data/faq.js";
import { buildFaqList, detectLanguage, faqsForRole, fillFaqText, matchFaq, OPEN_FAQ_EVENT } from "../utils/faqMatcher.js";
import { faqEntriesService } from "../services/faqEntriesService.js";
import "./FaqBot.css";

// Halaman dengan tombol aksi di bawah layar: tombol bot disembunyikan supaya tidak menutupi (bot tetap bisa dibuka dari Akun).
const HIDDEN_ON = [/^\/checkout/, /^\/products\/[^/]+$/, /^\/messages\/[^/]+$/, /^\/admin\/support-chats\/[^/]+$/, /^\/courier\/batches\/[^/]+$/, /^\/admin\/faq$/];

const COPY = {
  id: { open: "Buka bantuan", title: "Bantuan Kucur", subtitle: "Jawaban cepat seputar aplikasi", close: "Tutup", restart: "Mulai ulang", hello: "Halo! Mau tanya apa? Pilih topik di bawah, atau tulis pertanyaanmu.", placeholder: "Tulis pertanyaan, mis. cara batal pesanan", send: "Kirim", confirm: "Maksud kamu: **{q}**?", yes: "Ya", no: "Bukan", choose: "Mungkin maksudmu salah satu ini:", unknown: "Maaf, aku belum paham pertanyaannya. Coba tulis dengan kata lain, atau pilih topik di bawah.", retry: "Oke. Coba tulis ulang pertanyaanmu dengan kata lain, atau pilih yang paling mirip:", more: "Ada lagi yang bisa dibantu?", topics: "Topik lain", stillConfused: "Masih bingung?", chatAdmin: "Chat Admin", loginForAdmin: "Masuk untuk chat Admin", popular: "Pertanyaan populer" },
  en: { open: "Open help", title: "Kucur Help", subtitle: "Quick answers about the app", close: "Close", restart: "Start over", hello: "Hi! What do you need? Pick a topic below or type your question.", placeholder: "Type a question, e.g. how to cancel an order", send: "Send", confirm: "Do you mean: **{q}**?", yes: "Yes", no: "No", choose: "Maybe you mean one of these:", unknown: "Sorry, I didn't get that. Try other words, or pick a topic below.", retry: "Okay. Try rephrasing your question, or pick the closest one:", more: "Anything else?", topics: "Other topics", stillConfused: "Still stuck?", chatAdmin: "Chat with Admin", loginForAdmin: "Log in to chat with Admin", popular: "Popular questions" },
};

// Logo chatbot (public/logo-chatbot.svg) sebagai komponen supaya warnanya ikut tema: kepala = currentColor, layar wajah = warna latar.
const BotIcon = ({ className, face }) => <svg className={className} viewBox="40 40 432 410" aria-hidden="true">
  <line x1="256" y1="92" x2="256" y2="140" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
  <circle cx="256" cy="76" r="20" fill="currentColor"/>
  <rect x="70" y="236" width="34" height="86" rx="14" fill="currentColor"/>
  <rect x="408" y="236" width="34" height="86" rx="14" fill="currentColor"/>
  <rect x="112" y="140" width="288" height="236" rx="64" fill="currentColor"/>
  <rect x="146" y="174" width="220" height="168" rx="42" fill={face}/>
  <circle cx="212" cy="244" r="24" fill="currentColor"/>
  <circle cx="300" cy="244" r="24" fill="currentColor"/>
  <path d="M208 292 Q256 328 304 292" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
  <rect x="216" y="376" width="80" height="26" rx="8" fill="currentColor"/>
  <rect x="176" y="398" width="160" height="30" rx="15" fill="currentColor"/>
</svg>;

// **tebal** → <strong>
const Rich = ({ text }) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);

const timeText = (value) => String(value ?? "").slice(0, 5).replace(":", ".");

export default function FaqBot() {
  const { activeRole, isAuthenticated, user } = useAuth();
  const { startSupportChat } = useChat();
  const { formatCurrency, language } = usePreferences();
  const { settings } = useSystemSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const appLang = language === "en" ? "en" : "id";
  const copy = COPY[appLang];
  // Bahasa balasan mengikuti bahasa pertanyaan terakhir user (ID/EN); awalnya bahasa aplikasi.
  const [chatLang, setChatLang] = useState(appLang);
  const role = isAuthenticated ? (activeRole || "customer") : "visitor";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const lastResult = useRef(null);
  // FAQ dari Admin (menu FAQ Chatbot) diambil setiap bantuan dibuka, digabung dengan FAQ bawaan.
  const [entries, setEntries] = useState([]);
  useEffect(() => { if (!open) return undefined; let active = true; faqEntriesService.list().then((rows) => { if (active) setEntries(rows); }).catch(() => {}); return () => { active = false; }; }, [open]);
  const faqs = useMemo(() => buildFaqList(entries), [entries]);

  // Angka di jawaban selalu mengikuti Admin Settings terbaru.
  const valuesFor = useMemo(() => (lang) => {
    const s = settings ?? {};
    const money = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? formatCurrency(Number(value)) : null);
    const fallback = lang === "id" ? "yang berlaku" : "the current amount";
    const contactName = s.adminContactName?.trim(); const contactPhone = s.adminContactPhone?.trim();
    return {
      cutoff: timeText(s.deliveryOrderCutoffTime) || "16.00",
      dispatch: timeText(s.deliveryDispatchTime) || "17.00",
      rate: money(s.deliveryRatePerKm) ?? fallback,
      tax: Number.isFinite(Number(s.taxPercent)) && s.taxPercent !== null ? `${Number(s.taxPercent)}%` : fallback,
      maxDaily: s.maxDailyDeliveries ?? (lang === "id" ? "sesuai kuota" : "the daily quota"),
      initialFee: money(s.initialStoreFeeAmount) ?? fallback,
      adminFee: s.adminFeeType === "percentage" ? `${Number(s.adminFeeValue)}%${lang === "id" ? " dari transaksi" : " of each transaction"}` : money(s.adminFeeValue) ?? fallback,
      adminFeeDay: s.adminFeeCutoffDay ?? 1,
      graceTime: timeText(s.adminFeeGraceTime) || "12.00",
      lateInterest: Number.isFinite(Number(s.installmentLateInterestPercent)) && s.installmentLateInterestPercent !== null ? `${Number(s.installmentLateInterestPercent)}%` : fallback,
      distance: s.maxDeliveryDistanceKm ? (lang === "id" ? `Jarak antar maksimal ${s.maxDeliveryDistanceKm} km dari lapak.` : `Maximum delivery distance is ${s.maxDeliveryDistanceKm} km from the store.`) : (lang === "id" ? "Alamat di luar jangkauan kurir desa akan ditolak saat checkout." : "Addresses outside the village courier range are rejected at checkout."),
      contact: contactPhone ? (lang === "id" ? `Kontak admin desa: ${contactName ? `${contactName}, ` : ""}${contactPhone}.` : `Village admin contact: ${contactName ? `${contactName}, ` : ""}${contactPhone}.`) : (lang === "id" ? "Admin biasanya membalas di jam kerja." : "The Admin usually replies during working hours."),
    };
  }, [formatCurrency, settings]);

  // Topik awal: yang relevan dengan halaman ini dulu, lalu topik populer role ini.
  const topics = useMemo(() => {
    const available = faqsForRole(role);
    const byId = new Map(available.map((faq) => [faq.id, faq]));
    const onPage = available.filter((faq) => (faq.pages ?? []).some((page) => (page === "/" ? pathname === "/" : pathname.startsWith(page))));
    const starters = (STARTER_TOPICS[role] ?? []).map((id) => byId.get(id)).filter(Boolean);
    return [...new Map([...onPage, ...starters].map((faq) => [faq.id, faq])).values()].slice(0, 8);
  }, [pathname, role]);

  const push = useCallback((...items) => setMessages((current) => [...current, ...items.map((item) => ({ id: `${Date.now()}-${Math.random()}`, ...item }))]), []);
  const start = useCallback(() => { lastResult.current = null; setChatLang(appLang); setMessages([{ id: "hello", from: "bot", kind: "hello", lang: appLang }]); }, [appLang]);

  useEffect(() => {
    const openBot = () => setOpen(true);
    window.addEventListener(OPEN_FAQ_EVENT, openBot);
    return () => window.removeEventListener(OPEN_FAQ_EVENT, openBot);
  }, []);
  useEffect(() => { if (open && !messages.length) queueMicrotask(start); }, [open, messages.length, start]);
  // Ganti akun/role: mulai percakapan baru supaya topiknya sesuai.
  useEffect(() => { queueMicrotask(() => setMessages([])); }, [role, user?.id]);
  useEffect(() => { if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const answer = (faq, lang = chatLang) => push({ from: "user", text: faq.q[lang] }, { from: "bot", kind: "answer", faq, lang });
  const ask = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    const lang = detectLanguage(text, chatLang);
    setChatLang(lang);
    const result = matchFaq(text, role, pathname, faqs);
    lastResult.current = result;
    push({ from: "user", text });
    if (result.status === "confirm") push({ from: "bot", kind: "confirm", faq: result.matches[0], lang });
    else if (result.status === "choose") push({ from: "bot", kind: "choices", faqs: result.matches, text: COPY[lang].choose, lang });
    else push({ from: "bot", kind: "unknown", lang });
  };
  const confirmYes = (faq, lang) => push({ from: "user", text: COPY[lang].yes }, { from: "bot", kind: "answer", faq, lang });
  const confirmNo = (faq, lang) => {
    const others = (lastResult.current?.matches ?? []).filter((row) => row.id !== faq.id);
    push({ from: "user", text: COPY[lang].no }, { from: "bot", kind: "choices", faqs: others, text: COPY[lang].retry, withTopics: true, lang });
    inputRef.current?.focus();
  };
  const go = (to) => { setOpen(false); navigate(to); };
  const chatAdmin = async () => {
    if (!isAuthenticated) { go("/login"); return; }
    try { const conversation = await startSupportChat("Chat Bantuan"); go(`/messages/${conversation.id}`); } catch { go("/messages"); }
  };

  const chip = "min-h-10 rounded-full border border-[var(--kucur-green)] bg-[var(--kucur-surface)] px-3.5 py-2 text-left text-sm font-semibold text-[var(--kucur-green-ink)] hover:bg-[var(--kucur-green-soft)]";
  const topicChips = (lang) => <div className="flex flex-wrap gap-2">{topics.map((faq) => <button className={chip} type="button" key={faq.id} onClick={() => answer(faq, lang)}>{faq.q[lang]}</button>)}</div>;
  const bubble = "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-6";
  const adminButton = (lang) => role !== "admin" && <button className="min-h-10 rounded-full border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3.5 text-sm font-bold" type="button" onClick={() => void chatAdmin()}>{isAuthenticated ? COPY[lang].chatAdmin : COPY[lang].loginForAdmin}</button>;

  const renderBot = (message) => {
    const lang = message.lang ?? appLang;
    const copy = COPY[lang];
    if (message.kind === "hello") return <div className="grid gap-2"><p className={`${bubble} bg-[var(--kucur-surface-muted)]`}>{copy.hello}</p><span className="text-xs font-bold uppercase tracking-wide text-[var(--kucur-text-muted)]">{copy.popular}</span>{topicChips(lang)}</div>;
    if (message.kind === "confirm") return <div className="grid gap-2"><p className={`${bubble} bg-[var(--kucur-surface-muted)]`}><Rich text={copy.confirm.replace("{q}", message.faq.q[lang].replace(/[?]$/, ""))} /></p><div className="flex gap-2"><button className="min-h-11 rounded-xl bg-[var(--kucur-green)] px-5 text-sm font-bold text-[var(--kucur-on-green)]" type="button" onClick={() => confirmYes(message.faq, lang)}>{copy.yes}</button><button className="min-h-11 rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-5 text-sm font-bold" type="button" onClick={() => confirmNo(message.faq, lang)}>{copy.no}</button></div></div>;
    if (message.kind === "choices") return <div className="grid gap-2"><p className={`${bubble} bg-[var(--kucur-surface-muted)]`}>{message.text}</p>{message.faqs.length > 0 && <div className="flex flex-wrap gap-2">{message.faqs.map((faq) => <button className={chip} type="button" key={faq.id} onClick={() => answer(faq, lang)}>{faq.q[lang]}</button>)}</div>}{(message.withTopics || !message.faqs.length) && topicChips(lang)}</div>;
    if (message.kind === "unknown") return <div className="grid gap-2"><p className={`${bubble} bg-[var(--kucur-surface-muted)]`}>{copy.unknown}</p>{topicChips(lang)}<div className="flex flex-wrap items-center gap-2 text-sm text-[var(--kucur-text-muted)]">{copy.stillConfused} {adminButton(lang)}</div></div>;
    const { faq } = message;
    const values = valuesFor(lang);
    const steps = faq.a[lang].map((line) => fillFaqText(line, values)).filter(Boolean);
    const showLink = faq.link && (!faq.link.roles || faq.link.roles.includes(role));
    return <div className="grid gap-2">
      <div className={`${bubble} grid gap-2 border border-[var(--kucur-border)] bg-[var(--kucur-surface)]`}>
        <strong className="text-[15px]">{faq.q[lang]}</strong>
        {steps.length > 1 ? <ol className="m-0 grid list-decimal gap-1.5 pl-5">{steps.map((line, index) => <li key={index}><Rich text={line} /></li>)}</ol> : <p className="m-0"><Rich text={steps[0]} /></p>}
        {showLink && <button className="mt-1 min-h-11 w-fit rounded-xl bg-[var(--kucur-green)] px-4 text-sm font-bold text-[var(--kucur-on-green)]" type="button" onClick={() => go(faq.link.to)}>{faq.link.label[lang]} →</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--kucur-text-muted)]"><span>{copy.more}</span><button className={chip} type="button" onClick={() => push({ from: "bot", kind: "choices", faqs: [], text: copy.topics, withTopics: true, lang })}>{copy.topics}</button>{adminButton(lang)}</div>
    </div>;
  };

  const hidden = HIDDEN_ON.some((pattern) => pattern.test(pathname));
  const workspaceNav = isAuthenticated && ["merchant", "courier", "admin"].includes(activeRole);
  return <>
    {!hidden && !open && <button className={`faq-bot-launcher ${workspaceNav ? "has-workspace-nav" : ""}`} type="button" aria-label={copy.open} onClick={() => setOpen(true)}>
      <BotIcon face="var(--kucur-green)" />
    </button>}
    {open && createPortal(<div className="faq-bot-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="faq-bot-panel" role="dialog" aria-modal="true" aria-labelledby="faq-bot-title">
        <header className="flex items-center gap-3 border-b border-[var(--kucur-border)] px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--kucur-green-soft)] text-[var(--kucur-green-ink)]" aria-hidden="true"><BotIcon className="size-6" face="var(--kucur-green-soft)" /></span>
          <div className="grid min-w-0 flex-1"><strong className="text-base" id="faq-bot-title">{copy.title}</strong><span className="truncate text-xs text-[var(--kucur-text-muted)]">{copy.subtitle}</span></div>
          <button className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--kucur-text-muted)] hover:text-[var(--kucur-text)]" type="button" onClick={start}>{copy.restart}</button>
          <button className="grid size-10 place-items-center rounded-lg text-xl text-[var(--kucur-text-muted)] hover:text-[var(--kucur-text)]" type="button" aria-label={copy.close} onClick={() => setOpen(false)}>×</button>
        </header>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-4" ref={listRef} aria-live="polite">
          {messages.map((message) => message.from === "user"
            ? <p className={`${bubble} ml-auto bg-[var(--kucur-green)] text-[var(--kucur-on-green)]`} key={message.id}>{message.text}</p>
            : <div key={message.id}>{renderBot(message)}</div>)}
        </div>
        <form className="flex gap-2 border-t border-[var(--kucur-border)] p-3" onSubmit={ask}>
          <label className="min-w-0 flex-1"><span className="sr-only">{copy.placeholder}</span><input ref={inputRef} className="min-h-12 w-full rounded-xl border border-[var(--kucur-border-strong)] bg-[var(--kucur-surface)] px-3 text-base text-[var(--kucur-text)]" value={input} onChange={(event) => setInput(event.target.value)} placeholder={copy.placeholder} autoComplete="off" enterKeyHint="send" /></label>
          <button className="min-h-12 shrink-0 rounded-xl bg-[var(--kucur-green)] px-4 font-bold text-[var(--kucur-on-green)] disabled:opacity-50" type="submit" disabled={!input.trim()}>{copy.send}</button>
        </form>
      </section>
    </div>, document.body)}
  </>;
}

