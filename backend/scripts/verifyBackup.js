// Verifikasi file backup TANPA memulihkan apa pun (tidak ada data yang diubah):
//   node scripts/verifyBackup.js [file.sql]     (default: backup terbaru di backend/backups)
// Membaca file backup, menghitung baris tiap tabel, lalu membandingkan dengan database demo yang sedang hidup.
// Selisih kecil wajar bila ada transaksi baru setelah backup dibuat; selisih besar / tabel hilang = backup bermasalah.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const backupDir = path.resolve(__dirname, "../backups");
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(backupDir, fs.readdirSync(backupDir).filter((name) => name.endsWith(".sql")).map((name) => ({ name, time: fs.statSync(path.join(backupDir, name)).mtimeMs })).sort((a, b) => b.time - a.time)[0].name);
const text = fs.readFileSync(file, "utf8");

// Hitung baris pada satu pernyataan INSERT (tuple tingkat atas), mengabaikan tanda kurung di dalam string.
function countRows(payload) {
  let depth = 0; let rows = 0; let inString = false;
  for (let i = 0; i < payload.length; i += 1) {
    const char = payload[i];
    if (inString) { if (char === "\\") i += 1; else if (char === "'") inString = false; continue; }
    if (char === "'") inString = true;
    else if (char === "(") { if (depth === 0) rows += 1; depth += 1; }
    else if (char === ")") depth -= 1;
  }
  return rows;
}
const tables = new Map();
for (const match of text.matchAll(/^CREATE TABLE `([^`]+)`/gm)) tables.set(match[1], 0);
for (const match of text.matchAll(/^INSERT INTO `([^`]+)` VALUES (.*);$/gm)) tables.set(match[1], (tables.get(match[1]) || 0) + countRows(match[2]));
const complete = /-- Dump completed/.test(text);

// Database demo diturunkan dari DATABASE_URL dengan cara yang sama seperti scripts/demo.js (backup dibuat dari kucur_demo).
const url = new URL(String(process.env.DATABASE_URL || "").replace(/\/[^/?]+(\?|$)/, "/kucur_demo$1"));
const database = url.pathname.replace(/^\//, "");
const sql = [...tables.keys()].map((name) => `SELECT '${name}', COUNT(*) FROM \`${name}\``).join(" UNION ALL ");
const result = spawnSync("docker", ["exec", "-e", "MYSQL_PWD", process.env.MYSQL_CONTAINER || "kucur-mysql-dev", "mysql", "-u", decodeURIComponent(url.username), "-N", database, "-e", sql], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, encoding: "utf8" });
const live = new Map((result.stdout || "").trim().split("\n").filter(Boolean).map((line) => { const [name, count] = line.split("\t"); return [name, Number(count)]; }));

console.log(`File: ${path.basename(file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB), database pembanding: ${database}`);
console.log(`Penutup dump lengkap ("Dump completed"): ${complete ? "ada" : "TIDAK ADA (file terpotong?)"}`);
let problems = complete ? 0 : 1; let totalBackup = 0;
for (const [name, rows] of [...tables].sort()) {
  totalBackup += rows;
  const now = live.get(name);
  const status = now === undefined ? "tabel tidak ditemukan di database" : now === rows ? "sama" : `berbeda (database sekarang ${now})`;
  if (now === undefined || Math.abs(now - rows) > Math.max(3, rows * 0.1)) problems += 1;
  if (rows || now) console.log(`  ${name.padEnd(28)} backup ${String(rows).padStart(5)}  ${status}`);
}
console.log(`\n${tables.size} tabel di backup, total ${totalBackup} baris. ${problems ? `${problems} masalah` : "Backup lengkap & cocok dengan database."}`);
process.exit(problems ? 1 : 0);
