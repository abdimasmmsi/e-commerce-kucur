// Helper database demo `kucur_demo` (terpisah dari `kucur` yang dipakai e2e).
//   node scripts/demo.js reset          -> hapus isi kucur_demo, jalankan migrasi, lalu isi data demo
//   node scripts/demo.js dev            -> jalankan backend (port 3000) yang tersambung ke kucur_demo
//   node scripts/demo.js backup [nama]  -> simpan isi kucur_demo ke backups/kucur_demo-YYYYMMDD-HHmm[-nama].sql
//   node scripts/demo.js restore [file] -> kembalikan kucur_demo dari file backup (default: yang terbaru)
//   node scripts/demo.js backups        -> daftar file backup
require("dotenv").config();
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEMO_DB = "kucur_demo";
const source = process.env.DATABASE_URL || "";
const demoUrl = source.replace(/\/[^/?]+(\?|$)/, `/${DEMO_DB}$1`);
if (!/\/kucur_demo(\?|$)/.test(demoUrl)) {
  console.error("DATABASE_URL di .env tidak bisa diturunkan ke database kucur_demo.");
  process.exit(1);
}
process.env.DATABASE_URL = demoUrl;
const backendRoot = path.resolve(__dirname, "..");
const backupDir = path.join(backendRoot, "backups");
const container = process.env.MYSQL_CONTAINER || "kucur-mysql-dev";
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: backendRoot, env: process.env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
};

// User & password diambil dari DATABASE_URL. Password dikirim lewat env MYSQL_PWD, bukan argumen.
const mysqlAuth = () => {
  const url = new URL(demoUrl);
  return {
    args: ["-u", decodeURIComponent(url.username)],
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
  };
};

// Jalankan perintah di container; stdin/stdout bisa berupa file descriptor (tanpa shell, byte apa adanya).
const dockerExec = (execArgs, stdio) =>
  new Promise((resolve) => {
    const auth = mysqlAuth();
    const child = spawn("docker", ["exec", ...execArgs.flags, "-e", "MYSQL_PWD", container, ...execArgs.cmd(auth.args)], {
      env: auth.env,
      stdio,
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ code: 1, stderr: String(error.message) }));
    child.on("close", (code) => resolve({ code, stderr }));
  });

const pad = (n) => String(n).padStart(2, "0");
const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);
const listBackups = () =>
  fs.existsSync(backupDir)
    ? fs
        .readdirSync(backupDir)
        .filter((name) => /^kucur_demo-.*\.sql$/.test(name))
        .map((name) => ({ name, stat: fs.statSync(path.join(backupDir, name)) }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    : [];

async function backup(label) {
  fs.mkdirSync(backupDir, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const suffix = label ? `-${String(label).replace(/[^A-Za-z0-9_-]+/g, "-")}` : "";
  const file = path.join(backupDir, `kucur_demo-${stamp}${suffix}.sql`);
  console.log(`Membuat backup database ${DEMO_DB} ...`);
  const fd = fs.openSync(file, "w");
  const result = await dockerExec(
    {
      flags: [],
      cmd: (auth) => [
        "mysqldump", ...auth,
        "--default-character-set=utf8mb4", "--single-transaction", "--routines", "--triggers",
        "--no-tablespaces", "--set-gtid-purged=OFF", "--hex-blob",
        DEMO_DB,
      ],
    },
    ["ignore", fd, "pipe"],
  );
  fs.closeSync(fd);
  const size = fs.statSync(file).size;
  if (result.code !== 0 || size === 0) {
    fs.rmSync(file, { force: true });
    console.error(`Backup gagal.\n${result.stderr.trim()}`);
    process.exit(1);
  }
  console.log(`Backup selesai: backups/${path.basename(file)} (${sizeText(size)})`);
}

async function restore(fileArg) {
  let file;
  if (fileArg) {
    const candidates = [path.resolve(fileArg), path.join(backupDir, fileArg)];
    file = candidates.find((p) => fs.existsSync(p));
    if (!file) {
      console.error(`File backup tidak ditemukan: ${fileArg}`);
      process.exit(1);
    }
  } else {
    const newest = listBackups()[0];
    if (!newest) {
      console.error("Belum ada file backup di backend/backups. Jalankan dulu: npm run db:demo:backup");
      process.exit(1);
    }
    file = path.join(backupDir, newest.name);
  }
  // Pengaman: hanya terima dump database kucur_demo, tanpa USE/CREATE DATABASE ke database lain.
  const text = fs.readFileSync(file, "utf8");
  if (!/Database: kucur_demo\b/.test(text.slice(0, 4000)) || /^\s*(USE|CREATE DATABASE)\b/im.test(text)) {
    console.error("File ini bukan backup database kucur_demo. Restore dibatalkan.");
    process.exit(1);
  }
  console.log(`Mengembalikan database ${DEMO_DB} dari ${path.basename(file)} ...`);
  console.log("Data kucur_demo saat ini akan diganti isi backup.");
  const fd = fs.openSync(file, "r");
  const result = await dockerExec(
    { flags: ["-i"], cmd: (auth) => ["mysql", ...auth, "--default-character-set=utf8mb4", DEMO_DB] },
    [fd, "inherit", "pipe"],
  );
  fs.closeSync(fd);
  if (result.code !== 0) {
    console.error(`Restore gagal.\n${result.stderr.trim()}`);
    process.exit(1);
  }
  console.log(`Restore selesai. Database ${DEMO_DB} sudah kembali seperti saat backup.`);
}

function showBackups() {
  const items = listBackups();
  if (!items.length) {
    console.log("Belum ada file backup di backend/backups.");
    return;
  }
  console.log("Backup kucur_demo (terbaru di atas):");
  for (const { name, stat } of items) {
    const d = stat.mtime;
    const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    console.log(`  ${name}  ${sizeText(stat.size).padStart(8)}  ${when}`);
  }
}

const command = process.argv[2];
if (command === "reset") {
  run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
  run("node", ["prisma/seed-demo.js"]);
} else if (command === "dev") {
  console.log("Backend memakai database DEMO (kucur_demo).");
  require("../server");
} else if (command === "backup") {
  backup(process.argv[3]);
} else if (command === "restore") {
  restore(process.argv[3]);
} else if (command === "backups") {
  showBackups();
} else {
  console.error("Pakai: node scripts/demo.js reset | dev | backup [nama] | restore [file] | backups");
  process.exit(1);
}
