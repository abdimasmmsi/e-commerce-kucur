const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { assertDedicatedTestDatabase } = require("./helpers/testDatabaseGuard");

require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error("TEST_DATABASE_URL wajib diisi untuk MySQL integration tests.");
  process.exit(1);
}
let target;
try {
  target = assertDedicatedTestDatabase(testUrl);
} catch (error) {
  console.error(`${error.code || "UNSAFE_TEST_DATABASE"}: ${error.message}`);
  process.exit(1);
}
console.log(`Integration database verified: ${target.sanitizedUrl}`);

const backendRoot = path.resolve(__dirname, "..");
const environment = { ...process.env, NODE_ENV: "test", DATABASE_URL: testUrl, DEV_SEED_PASSWORD: process.env.DEV_SEED_PASSWORD || "KucurIntegration123!" };
const prismaCli = require.resolve("prisma/build/index.js");
const commands = [
  [prismaCli, "migrate", "deploy"],
  [prismaCli, "db", "seed"],
  [prismaCli, "db", "seed"],
  ["--test", "tests/integration/mysql.integration.test.js"],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd: backendRoot, env: environment, stdio: "inherit" });
  if (result.error) {
    console.error(`Failed to start child process: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (result.signal) console.error(`Child process terminated by signal ${result.signal}.`);
    process.exit(result.status === null ? 1 : result.status);
  }
}
