const test = require("node:test");
const assert = require("node:assert/strict");
const { createPrismaRepository } = require("./repositories/prismaRepository");

test("audit tetap tercatat (tanpa FK) saat aktor belum ada di tabel pengguna lama, dan error lain tetap dilempar", async () => {
  const calls = [];
  const client = { auditRecord: { create: async ({ data }) => { calls.push(data); if (data.actorId) throw Object.assign(new Error("fk"), { code: "P2003" }); return data; } } };
  const row = await createPrismaRepository(client).audits.append({ entityType: "user", entityId: "U1", actorId: "A1", actorRole: "admin", activityType: "ADMIN_COURIER_CREATED", description: "Admin membuat akun kurir." });
  assert.equal(calls.length, 2); assert.equal(row.actorId, null); assert.match(row.description, /\[aktor: A1\]$/);
  const broken = createPrismaRepository({ auditRecord: { create: async () => { throw Object.assign(new Error("lain"), { code: "P2002" }); } } });
  await assert.rejects(broken.audits.append({ entityType: "a", entityId: "b", actorId: "A1", activityType: "X", description: "d" }), /lain/);
  const system = createPrismaRepository({ auditRecord: { create: async () => { throw Object.assign(new Error("fk"), { code: "P2003" }); } } });
  await assert.rejects(system.audits.append({ entityType: "a", entityId: "b", activityType: "X", description: "d" }), /fk/);
});
