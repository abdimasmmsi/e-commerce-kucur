// Pencarian yang memaafkan salah ketik ("kripik" → keripik, "kopii" → kopi) untuk katalog & saran cari.
const clean = (value) => String(value ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const words = (value) => clean(value).split(" ").filter(Boolean);

// Jarak edit (Levenshtein) dengan batas; berhenti cepat kalau sudah melewati batas.
function withinDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

const tolerance = (length) => (length >= 7 ? 2 : length >= 4 ? 1 : 0);

// Skor 0 = tidak cocok. Kata yang persis/awalan lebih tinggi daripada yang cocok karena salah ketik.
function tokenScore(token, candidates) {
  let best = 0;
  for (const word of candidates) {
    if (word === token) return 3;
    if (word.startsWith(token)) best = Math.max(best, 2.5);
    else if (token.length >= 3 && word.includes(token)) best = Math.max(best, 2);
    else {
      const max = tolerance(token.length);
      if (max && (withinDistance(token, word, max) || (word.length > token.length && withinDistance(token, word.slice(0, token.length + 1), max)))) best = Math.max(best, 1);
    }
  }
  return best;
}

export function searchScore(fields, query) {
  const tokens = words(query);
  if (!tokens.length) return 1;
  const candidates = words(Array.isArray(fields) ? fields.join(" ") : fields);
  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, candidates);
    if (!score) return 0;
    total += score;
  }
  return total;
}

export const matchesSearch = (fields, query) => searchScore(fields, query) > 0;
