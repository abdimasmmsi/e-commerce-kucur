const { errors } = require("../../errors/AppError");

function assertDedicatedTestDatabase(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw errors.validation({ TEST_DATABASE_URL: "URL MySQL test tidak valid." }); }
  if (parsed.protocol !== "mysql:") throw errors.validation({ TEST_DATABASE_URL: "Harus menggunakan MySQL." });
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("/")[0];
  if (!databaseName || !/_test$/i.test(databaseName) || /(^|[_-])(prod|production)([_-]|$)/i.test(databaseName)) {
    throw errors.forbidden("Operasi integration test hanya diizinkan pada database dengan nama berakhiran _test.");
  }
  return { databaseName, sanitizedUrl: `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/${databaseName}` };
}

module.exports = { assertDedicatedTestDatabase };
