import { CONCEPTS, FAQS } from "../data/faq.js";

// Pencocok FAQ lokal: rapikan teks → kenali konsep (sinonim, singkatan, imbuhan, salah ketik) → beri skor tiap FAQ.

const SLANG = {
  gmn: "bagaimana", gimana: "bagaimana", bgmn: "bagaimana", gmna: "bagaimana", caranya: "cara",
  gk: "tidak", ga: "tidak", gak: "tidak", nggak: "tidak", ngga: "tidak", tdk: "tidak", enggak: "tidak",
  udh: "sudah", sdh: "sudah", dah: "sudah", blm: "belum", yg: "yang", dgn: "dengan", utk: "untuk", krn: "karena",
  bs: "bisa", bsa: "bisa", knp: "kenapa", brp: "berapa", dmn: "dimana", kpn: "kapan", tp: "tapi", sy: "saya", ak: "saya", aku: "saya",
  pesenan: "pesanan", psn: "pesan", brg: "barang", ongkos: "ongkir", hp: "hp", trs: "terus", jg: "juga", aja: "saja", lg: "lagi",
};
const STOP = new Set(["saya", "yang", "untuk", "dengan", "dan", "atau", "di", "ke", "dari", "ini", "itu", "cara", "bagaimana", "apa", "apakah", "bisa", "tidak", "mau", "ingin", "tolong", "dong", "kak", "ya", "sih", "nih", "juga", "saja", "lagi", "terus", "the", "how", "do", "i", "to", "my", "a", "can", "is", "what", "an"]);

const normalize = (text) => String(text ?? "")
  .toLowerCase()
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s-]/g, " ")
  .replace(/(.)\1{2,}/g, "$1")
  .split(/\s+/).filter(Boolean)
  .map((word) => SLANG[word] ?? word)
  .join(" ");

// Imbuhan bahasa Indonesia yang umum, cukup untuk mencocokkan kata dasar.
const stem = (word) => {
  let base = word.replace(/(nya|lah|kah|pun)$/, "");
  base = base.replace(/(kan|in|an|i)$/, (suffix) => (base.length - suffix.length >= 4 ? "" : suffix));
  base = base.replace(/^(meng|meny|mem|men|me|ber|ter|di|ke|pe|se)/, (prefix) => (base.length - prefix.length >= 4 ? "" : prefix));
  return base;
};

const distance = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
};

const ALL_TERMS = new Set(Object.values(CONCEPTS).flat().filter((term) => !term.includes(" ")));
const exactMatch = (token, term) => token === term || stem(token) === stem(term);
// Salah ketik hanya ditoleransi untuk kata yang bukan istilah lain (mis. "lapak" tidak boleh dibaca "lacak").
const fuzzyMatch = (token, term) => !ALL_TERMS.has(token) && token[0] === term[0] && term.length >= 5 && token.length >= 4 && distance(token, term) <= (term.length >= 8 ? 2 : 1);

// Konsep yang muncul di teks user.
export function detectConcepts(text) {
  const normalized = normalize(text);
  const tokens = normalized.split(" ").filter((token) => token && !STOP.has(token));
  const padded = ` ${normalized} `;
  const found = new Set();
  const matchedBy = {};
  for (const pass of [exactMatch, fuzzyMatch]) {
    for (const [concept, terms] of Object.entries(CONCEPTS)) {
      if (found.has(concept)) continue;
      for (const term of terms) {
        const token = term.includes(" ") ? (padded.includes(` ${term} `) ? term : null) : tokens.find((candidate) => pass(candidate, term));
        if (token) { found.add(concept); matchedBy[concept] = token; break; }
      }
    }
  }
  // "pesanan" juga berstem "pesan": kalau satu kata yang sama memicu PESANAN dan BELI, cukup PESANAN.
  if (found.has("ORDER") && found.has("BUY") && matchedBy.ORDER === matchedBy.BUY) found.delete("BUY");
  // "pesan" bisa berarti chat atau memesan: kalau ada konteks chat/admin, anggap chat.
  if (found.has("CHAT") && found.has("BUY") && !/\b(beli|belanja|memesan|checkout)\b/.test(normalized)) found.delete("BUY");
  return { concepts: [...found], tokens };
}

// Skor 0..1: semua konsep wajib FAQ harus ada; konsep tambahan dan halaman aktif menaikkan skor.
// Kata kunci FAQ buatan Admin: konsep "KW:<kata>" dianggap ada kalau kata itu muncul di teks user.
const keywordHit = (normalizedText, tokens) => (concept) => {
  const word = concept.slice(3);
  if (word.includes(" ")) return ` ${normalizedText} `.includes(` ${word} `);
  return tokens.some((token) => token === word || stem(token) === stem(word));
};

// Skor 0..1: semua konsep wajib FAQ harus ada; konsep tambahan dan halaman aktif menaikkan skor.
const scoreFaq = (faq, concepts, pathname, hasKeyword = () => false) => {
  const user = new Set(concepts);
  const has = (concept) => (concept.startsWith("KW:") ? hasKeyword(concept) : user.has(concept));
  const variants = [faq.concepts, ...(faq.alt ?? [])];
  let best = 0;
  for (const required of variants) {
    const hit = required.filter(has).length;
    if (!hit) continue;
    const recall = hit / required.length;
    const extraHit = (faq.extra ?? []).filter(has).length;
    const relevant = required.filter((concept) => !concept.startsWith("KW:") && user.has(concept)).length + (faq.extra ?? []).filter((concept) => !concept.startsWith("KW:") && user.has(concept)).length;
    const precision = user.size ? Math.min(relevant / user.size, 1) : 1;
    const score = recall === 1 ? 0.55 + 0.35 * precision + Math.min(extraHit, 2) * 0.05 : recall * 0.45;
    best = Math.max(best, score);
  }
  if (best > 0 && pathname && (faq.pages ?? []).some((page) => (page === "/" ? pathname === "/" : pathname.startsWith(page)))) best += 0.04;
  return Math.min(best, 1);
};

export const faqsForRole = (role, faqs = FAQS) => faqs.filter((faq) => faq.roles.includes(role));

// Gabungkan FAQ bawaan dengan FAQ dari Admin (menu FAQ Chatbot): bawaan bisa diubah/disembunyikan, entri baru ditambahkan.
export const keywordConcept = (word) => `KW:${normalize(word)}`;
export function buildFaqList(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const overrides = new Map(list.filter((entry) => entry.builtin).map((entry) => [entry.id, entry]));
  const merged = [];
  for (const faq of FAQS) {
    const override = overrides.get(faq.id);
    if (!override) { merged.push(faq); continue; }
    if (override.hidden || override.deletedAt) continue;
    const keywords = (override.keywords ?? []).map(keywordConcept);
    merged.push({ ...faq, roles: override.roles ?? faq.roles, q: override.q ?? faq.q, a: override.a ?? faq.a, link: override.link === undefined ? faq.link : override.link, keywords: override.keywords ?? [], pinned: override.pinned, alt: [...(faq.alt ?? []), ...keywords.map((concept) => [concept])], extra: [...(faq.extra ?? []), ...keywords], edited: true });
  }
  for (const entry of list.filter((item) => !item.builtin && !item.hidden && !item.deletedAt && item.q && item.a)) {
    const keywords = (entry.keywords ?? []).map(keywordConcept);
    const variants = [detectConcepts(entry.q.id).concepts, detectConcepts(entry.q.en).concepts, ...keywords.map((concept) => [concept])].filter((variant) => variant.length);
    merged.push({ ...entry, custom: true, concepts: variants[0] ?? [keywordConcept(entry.q.id)], alt: variants.slice(1), extra: keywords });
  }
  return merged;
}

// Hasil: { status: "confirm" | "choose" | "unknown", matches: [faq...] }
export function matchFaq(text, role, pathname = "", faqs = FAQS) {
  const { concepts, tokens } = detectConcepts(text);
  const hasKeyword = keywordHit(normalize(text), tokens);
  const candidates = faqsForRole(role, faqs);
  if (!concepts.length && !candidates.some((faq) => [faq.concepts, ...(faq.alt ?? [])].flat().some((concept) => concept.startsWith("KW:") && hasKeyword(concept)))) return { status: "unknown", matches: [], concepts };
  const ranked = candidates
    .map((faq) => ({ faq, score: scoreFaq(faq, concepts, pathname, hasKeyword) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { status: "unknown", matches: [], concepts };
  const [top, second] = ranked;
  if (top.score >= 0.55 && (!second || top.score - second.score >= 0.08)) return { status: "confirm", matches: [top.faq], concepts };
  return { status: "choose", matches: ranked.slice(0, 3).map((row) => row.faq), concepts };
}

export const fillFaqText = (text, values) => text.replace(/\{(\w+)\}/g, (whole, key) => (values[key] ?? whole));

// Membuka chatbot dari mana saja (mis. menu Akun → Bantuan).
export const OPEN_FAQ_EVENT = "kucur:open-faq";
export const openFaqBot = () => window.dispatchEvent(new Event(OPEN_FAQ_EVENT));

// Bahasa pertanyaan user (ID atau EN) dari mayoritas kata yang dikenali; seri → bahasa aplikasi.
const ID_WORDS = new Set("yang saya aku ak sy gimana gmn bagaimana cara caranya tidak ga gak gk nggak bisa bs mau ingin apa apakah kapan berapa brp dimana mana kenapa knp pesanan pesenan barang beli belanja bayar kirim dikirim ongkir batal batalkan batalin lapak toko alamat sudah udah udh belum blm dan di ke dari untuk utk dengan dgn ini itu min kak dong sih kok ada lupa sandi ulasan akun daftar masuk harga jual jualan penjual pembeli tolong buat bikin ganti ubah lagi juga saja aja kalau kalo kurir antar sampai lama jam hari besok stok produk rusak libur iuran biaya pajak gratis cek lihat tambah hapus apa".split(" "));
const EN_WORDS = new Set("the how do does did i my me to can could is are was what when where why which who will would should please want need help with for of and it its your you an a cost much many time get items item arrive arrives track change language buy pay delivery deliver shipping fee address account sign forgot store shop seller product products stock close open add remove hi hello thanks thank there this that be have has not no yes from on in at by".split(" "));
export function detectLanguage(text, fallback = "id") {
  const words = String(text ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  let id = 0; let en = 0;
  for (const word of words) { if (ID_WORDS.has(word)) id += 1; else if (EN_WORDS.has(word)) en += 1; }
  if (id === en) return fallback === "en" ? "en" : "id";
  return en > id ? "en" : "id";
}
