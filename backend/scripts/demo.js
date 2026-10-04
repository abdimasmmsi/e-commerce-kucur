// Helper database demo `kucur_demo` (terpisah dari `kucur` yang dipakai e2e).
//   node scripts/demo.js reset  -> hapus isi kucur_demo, jalankan migrasi, lalu isi data demo
//   node scripts/demo.js dev    -> jalankan backend (port 3000) yang tersambung ke kucur_demo
require("dotenv").config();
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const source = process.env.DATABASE_URL || "";
const demoUrl = source.replace(/\/[^/?]+(\?|$)/, "/kucur_demo$1");
if (!/\/kucur_demo(\?|$)/.test(demoUrl)) {
  console.error("DATABASE_URL di .env tidak bisa diturunkan ke database kucur_demo.");
  process.exit(1);
}
process.env.DATABASE_URL = demoUrl;
const backendRoot = path.resolve(__dirname, "..");
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: backendRoot, env: process.env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
};

const command = process.argv[2];
if (command === "reset") {
  run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
  run("node", ["prisma/seed-demo.js"]);
} else if (command === "dev") {
  console.log("Backend memakai database DEMO (kucur_demo).");
  require("../server");
} else {
  console.error("Pakai: node scripts/demo.js reset | dev");
  process.exit(1);
}
