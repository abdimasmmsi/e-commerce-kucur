// Pemeriksa data FAQ chatbot (dijalankan lewat `npm run lint`).
// Menjaga supaya FAQ tetap sinkron dengan aplikasi: ID/EN lengkap, konsep dikenal, placeholder valid, tautan menuju rute yang ada.
import fs from "node:fs";
import { CONCEPTS, FAQS, STARTER_TOPICS } from "../src/data/faq.js";
import { detectLanguage, matchFaq } from "../src/utils/faqMatcher.js";

const ROLES = new Set(["visitor", "customer", "merchant", "courier", "admin"]);
const PLACEHOLDERS = new Set(["cutoff", "dispatch", "rate", "tax", "maxDaily", "initialFee", "adminFee", "adminFeeDay", "graceTime", "lateInterest", "distance", "contact"]);
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
// Rute dari App.jsx (rute anak di dalam /merchant, /courier, /admin digabung dengan induknya).
const routes = new Set(["/"]);
let parent = "";
for (const [, path] of app.matchAll(/<Route path="([^"]+)"/g)) {
  if (["/merchant", "/courier", "/admin"].includes(path)) { parent = path; routes.add(path); continue; }
  if (path.startsWith("/")) { if (!path.startsWith(parent)) parent = ""; routes.add(path); } else routes.add(`${parent || ""}/${path}`.replace(/\/+/g, "/"));
}
const routeExists = (to) => [...routes].some((route) => new RegExp(`^${route.replace(/:[^/]+/g, "[^/]+").replace(/\/\*$/, "(/.*)?")}$`).test(to));

const errors = [];
const ids = new Set();
for (const faq of FAQS) {
  const where = `FAQ "${faq.id}"`;
  if (ids.has(faq.id)) errors.push(`${where}: id dobel`);
  ids.add(faq.id);
  if (!faq.roles?.length || faq.roles.some((role) => !ROLES.has(role))) errors.push(`${where}: role tidak valid`);
  for (const concept of [...faq.concepts, ...(faq.extra ?? []), ...(faq.alt ?? []).flat()]) if (!CONCEPTS[concept]) errors.push(`${where}: konsep ${concept} tidak ada di CONCEPTS`);
  if (!faq.q?.id || !faq.q?.en) errors.push(`${where}: pertanyaan ID/EN belum lengkap`);
  if (!faq.a?.id?.length || faq.a.id.length !== faq.a?.en?.length) errors.push(`${where}: jumlah langkah jawaban ID dan EN harus sama`);
  for (const line of [...(faq.a?.id ?? []), ...(faq.a?.en ?? [])]) for (const [, key] of line.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS.has(key)) errors.push(`${where}: placeholder {${key}} tidak dikenal`);
  if (faq.link && (!faq.link.label?.id || !faq.link.label?.en)) errors.push(`${where}: label tautan ID/EN belum lengkap`);
  if (faq.link && !routeExists(faq.link.to)) errors.push(`${where}: tautan ${faq.link.to} tidak ada di App.jsx`);
  // Pertanyaan FAQ itu sendiri harus dikenali sebagai FAQ yang sama (untuk role pertamanya).
  for (const lang of ["id", "en"]) {
    const self = matchFaq(faq.q[lang], faq.roles.find((role) => role !== "visitor") ?? faq.roles[0]);
    if (!self.matches.some((row) => row.id === faq.id)) errors.push(`${where}: pertanyaan ${lang.toUpperCase()} tidak cocok ke FAQ ini (konsep terdeteksi: ${self.concepts.join(", ") || "-"})`);
    if (detectLanguage(faq.q[lang], lang === "id" ? "en" : "id") !== lang) errors.push(`${where}: pertanyaan ${lang.toUpperCase()} tidak terdeteksi sebagai ${lang.toUpperCase()}`);
  }
}
for (const [role, list] of Object.entries(STARTER_TOPICS)) for (const id of list) {
  const faq = FAQS.find((row) => row.id === id);
  if (!faq) errors.push(`STARTER_TOPICS.${role}: FAQ ${id} tidak ada`);
  else if (!faq.roles.includes(role)) errors.push(`STARTER_TOPICS.${role}: FAQ ${id} tidak untuk role ini`);
}

if (errors.length) { console.error(`FAQ check gagal (${errors.length}):\n- ${errors.join("\n- ")}`); process.exit(1); }
console.log(`FAQ check passed (${FAQS.length} FAQ, ${Object.keys(CONCEPTS).length} konsep).`);
