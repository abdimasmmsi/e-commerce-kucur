#!/usr/bin/env node
// Hitung skor SUS dari CSV. Tanpa dependensi.
// Pemakaian: node docs/uat/hitung-sus.mjs berkas.csv
// Kolom: id, peran, q1..q10 (nilai 1-5). Pemisah koma atau titik koma.
// Baris yang diawali '#' diabaikan.

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Pemakaian: node docs/uat/hitung-sus.mjs berkas.csv");
  process.exit(1);
}

let text;
try {
  text = readFileSync(file, "utf8").replace(/^﻿/, "");
} catch (e) {
  console.error(`Tidak bisa membaca berkas: ${e.message}`);
  process.exit(1);
}

const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
if (lines.length < 2) {
  console.error("Berkas kosong atau tidak ada baris data.");
  process.exit(1);
}

const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
const split = (l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
const header = split(lines[0]).map((h) => h.toLowerCase());
const idx = (name) => header.indexOf(name);
const iId = idx("id");
const iRole = idx("peran");
const iQ = Array.from({ length: 10 }, (_, i) => idx(`q${i + 1}`));
if (iId < 0 || iRole < 0 || iQ.some((i) => i < 0)) {
  console.error("Kolom wajib: id, peran, q1..q10");
  process.exit(1);
}

const interpret = (s) => (s < 51 ? "Buruk" : s < 68 ? "Di bawah rata-rata" : s <= 80 ? "Baik" : "Sangat baik");
const fmt = (n) => n.toFixed(1).replace(".", ",");

const rows = [];
const problems = [];
lines.slice(1).forEach((line, n) => {
  const c = split(line);
  const id = c[iId] || `baris-${n + 2}`;
  const answers = iQ.map((i) => Number(String(c[i] ?? "").replace(",", ".")));
  if (answers.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    problems.push(`${id}: ada nilai bukan 1-5, dilewati`);
    return;
  }
  const sum = answers.reduce((t, v, i) => t + (i % 2 === 0 ? v - 1 : 5 - v), 0);
  rows.push({ id, role: c[iRole] || "(tanpa peran)", score: sum * 2.5 });
});

if (!rows.length) {
  problems.forEach((p) => console.error(p));
  console.error("Tidak ada baris valid.");
  process.exit(1);
}

const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

console.log("\nSkor SUS per responden");
console.log(`${pad("ID", 10)}${pad("Peran", 14)}${padL("Skor", 7)}  Interpretasi`);
console.log("-".repeat(50));
rows.forEach((r) => console.log(`${pad(r.id, 10)}${pad(r.role, 14)}${padL(fmt(r.score), 7)}  ${interpret(r.score)}`));

const stat = (list) => {
  const n = list.length;
  const mean = list.reduce((t, v) => t + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(list.reduce((t, v) => t + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd };
};

const groups = new Map();
rows.forEach((r) => groups.set(r.role, [...(groups.get(r.role) || []), r.score]));

console.log("\nRata-rata");
console.log(`${pad("Kelompok", 16)}${padL("n", 4)}${padL("Rata-rata", 11)}${padL("SB", 8)}  Interpretasi`);
console.log("-".repeat(58));
[...groups.entries()].forEach(([role, list]) => {
  const s = stat(list);
  console.log(`${pad(role, 16)}${padL(s.n, 4)}${padL(fmt(s.mean), 11)}${padL(fmt(s.sd), 8)}  ${interpret(s.mean)}`);
});
const all = stat(rows.map((r) => r.score));
console.log("-".repeat(58));
console.log(`${pad("KESELURUHAN", 16)}${padL(all.n, 4)}${padL(fmt(all.mean), 11)}${padL(fmt(all.sd), 8)}  ${interpret(all.mean)}`);
console.log(`\nAmbang umum 68: ${all.mean >= 68 ? "TERCAPAI" : "BELUM tercapai"}`);
console.log("Keterangan: <51 Buruk; 51-<68 Di bawah rata-rata; 68-80 Baik; >80 Sangat baik. SB = simpangan baku.");
if (all.n < 10) console.log(`Catatan: responden ${all.n} (<10); hasil hanya gambaran awal.`);
if (problems.length) {
  console.log("\nPeringatan:");
  problems.forEach((p) => console.log(`- ${p}`));
}
