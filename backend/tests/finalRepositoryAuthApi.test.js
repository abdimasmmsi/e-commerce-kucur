const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { getPrisma, disconnectPrisma } = require("../config/prisma");
const { createFinalPrismaRepository } = require("../repositories/finalPrismaRepository");
const { createApp } = require("../app");

const prisma = getPrisma();
const ROLLBACK = Symbol("ROLLBACK");
test("real login me logout uses the canonical final user and session repository", async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const repository = createFinalPrismaRepository(tx);
      const server = createApp({ repository }).listen(0);
      try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "customer@kucur.test", password: "KucurDev123!" }) });
        assert.equal(login.status, 200); const loginBody = await login.json(); const token = loginBody.data.token;
        const tokenHash = createHash("sha256").update(token).digest("hex");
        assert.equal(await tx.session.count({ where: { tokenHash } }), 0);
        assert.equal(await tx.targetSession.count({ where: { tokenHash, revokedAt: null } }), 1);
        const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
        assert.equal(me.status, 200); const meBody = await me.json(); assert.equal(meBody.data.email, "customer@kucur.test");
        const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
        assert.equal(logout.status, 204);
        assert.equal(await tx.targetSession.count({ where: { tokenHash, revokedAt: null } }), 0);
      } finally { await new Promise((resolve) => server.close(resolve)); }
      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (error) { if (error !== ROLLBACK) throw error; }
});
test.after(disconnectPrisma);
