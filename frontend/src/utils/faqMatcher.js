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
const scoreFaq = (faq, concepts, pathname) => {
  const user = new Set(concepts);
  const variants = [faq.concepts, ...(faq.alt ?? [])];
  let best = 0;
  for (const required of variants) {
    const hit = required.filter((concept) => user.has(concept)).length;
    if (!hit) continue;
    const recall = hit / required.length;
    const extraHit = (faq.extra ?? []).filter((concept) => user.has(concept)).length;
    const relevant = hit + extraHit;
    const precision = relevant / Math.max(user.size, 1);
    const score = recall === 1 ? 0.55 + 0.35 * precision + Math.min(extraHit, 2) * 0.05 : recall * 0.45;
    best = Math.max(best, score);
  }
  if (best > 0 && pathname && (faq.pages ?? []).some((page) => (page === "/" ? pathname === "/" : pathname.startsWith(page)))) best += 0.04;
  return Math.min(best, 1);
};

export const faqsForRole = (role) => FAQS.filter((faq) => faq.roles.includes(role));

// Hasil: { status: "confirm" | "choose" | "unknown", matches: [faq...] }
export function matchFaq(text, role, pathname = "") {
  const { concepts } = detectConcepts(text);
  if (!concepts.length) return { status: "unknown", matches: [], concepts };
  const ranked = faqsForRole(role)
    .map((faq) => ({ faq, score: scoreFaq(faq, concepts, pathname) }))
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
