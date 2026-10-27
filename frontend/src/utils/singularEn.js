// Rapikan kalimat Inggris berpola "{count} bills" saat jumlahnya 1 ("1 bill"). Teks Indonesia tidak terpengaruh.
export const fixOne = (text) => String(text).replace(/\b1 (unpaid bill|bill|store|order|day|installment|schedule)s\b/g, "1 $1");
