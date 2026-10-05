const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./app");
const { createMemoryRepository } = require("./repositories/memoryRepository");
const { hashPassword } = require("./services/authService");
const { createAuthRateLimits, createRateLimiter, isLoopback } = require("./middleware/rateLimit");

const address = { label: "Rumah", recipientName: "Warga", phone: "081299999999", address: "Dusun Krajan, Desa Kucur", latitude: -7.955, longitude: 112.548 };

async function fixture(limits) {
  const passwordHash = await hashPassword("password123");
  const now = new Date().toISOString();
  const repository = createMemoryRepository({ users: [
    { id: "USR-C", fullName: "Customer", email: "customer@example.test", phone: "081234567890", passwordHash, status: "active", roles: ["customer"], createdAt: now, updatedAt: now },
    { id: "USR-D", fullName: "Customer Dua", email: "dua@example.test", phone: "081234567891", passwordHash, status: "active", roles: ["customer"], createdAt: now, updatedAt: now },
  ] });
  const clock = { time: Date.parse("2026-10-05T08:00:00Z") };
  // Test lewat 127.0.0.1, jadi pengecualian loopback dimatikan; IP klien disimulasikan via X-Forwarded-For.
  const authRateLimits = createAuthRateLimits({ skip: () => false, now: () => clock.time, limits });
  const server = createApp({ repository, authRateLimits }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { body, method = "GET", ip = "10.0.0.1" } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { "X-Forwarded-For": ip, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, retryAfter: response.headers.get("retry-after"), body: await response.json().catch(() => null) };
  };
  const login = (email, password, ip) => request("/api/auth/login", { method: "POST", body: { email, password }, ip });
  return { clock, request, login, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("email-status returns 429 with Retry-After beyond the limit, per client IP, and resets after the window", async (t) => {
  const app = await fixture({ emailStatus: { max: 3, windowMs: 60_000 } }); t.after(app.close);
  for (let i = 0; i < 3; i += 1) assert.equal((await app.request("/api/auth/email-status?email=a@example.test")).status, 200);
  const limited = await app.request("/api/auth/email-status?email=a@example.test");
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "TOO_MANY_REQUESTS");
  assert.equal(limited.retryAfter, "60");
  assert.equal((await app.request("/api/auth/email-status?email=a@example.test", { ip: "10.0.0.2" })).status, 200);
  app.clock.time += 30_000;
  assert.equal((await app.request("/api/auth/email-status?email=a@example.test")).retryAfter, "30");
  app.clock.time += 30_000;
  assert.equal((await app.request("/api/auth/email-status?email=a@example.test")).status, 200);
});

test("login is limited per IP+email, other accounts stay usable, and success resets the account counter", async (t) => {
  const app = await fixture({ loginPerAccount: { max: 3, windowMs: 15 * 60_000 } }); t.after(app.close);
  assert.equal((await app.login("customer@example.test", "salah123", "10.0.0.1")).status, 401);
  assert.equal((await app.login("customer@example.test", "salah123", "10.0.0.1")).status, 401);
  assert.equal((await app.login("Customer@Example.test", "password123", "10.0.0.1")).status, 200);
  for (let i = 0; i < 3; i += 1) assert.equal((await app.login("customer@example.test", "salah123", "10.0.0.1")).status, 401);
  const limited = await app.login("customer@example.test", "password123", "10.0.0.1");
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.retryAfter) > 0);
  assert.equal((await app.login("dua@example.test", "password123", "10.0.0.1")).status, 200);
  assert.equal((await app.login("customer@example.test", "password123", "10.0.0.9")).status, 200);
  app.clock.time += 15 * 60_000;
  assert.equal((await app.login("customer@example.test", "password123", "10.0.0.1")).status, 200);
});

test("login per-IP cap only counts failed attempts", async (t) => {
  const app = await fixture({ loginPerIp: { max: 3, windowMs: 15 * 60_000 } }); t.after(app.close);
  for (let i = 0; i < 5; i += 1) assert.equal((await app.login("customer@example.test", "password123")).status, 200);
  for (let i = 0; i < 3; i += 1) assert.equal((await app.login(`orang${i}@example.test`, "salah123")).status, 401);
  assert.equal((await app.login("dua@example.test", "password123")).status, 429);
  assert.equal((await app.login("dua@example.test", "password123", "10.0.0.2")).status, 200);
});

test("register is limited per IP", async (t) => {
  const app = await fixture({ register: { max: 2, windowMs: 60 * 60_000 } }); t.after(app.close);
  const register = (n, ip) => app.request("/api/auth/register", { method: "POST", ip, body: { fullName: `Warga ${n}`, email: `warga${n}@example.test`, phone: "081299999999", password: "password123", address } });
  assert.equal((await register(1)).status, 201);
  assert.equal((await register(2)).status, 201);
  const limited = await register(3);
  assert.equal(limited.status, 429);
  assert.equal(limited.retryAfter, "3600");
  assert.equal((await register(4, "10.0.0.2")).status, 201);
});

test("default skip exempts loopback client IPs unless RATE_LIMIT_LOCAL=true, and sweep drops expired keys", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED, RATE_LIMIT_LOCAL: process.env.RATE_LIMIT_LOCAL };
  try {
    delete process.env.NODE_ENV; delete process.env.RATE_LIMIT_DISABLED; delete process.env.RATE_LIMIT_LOCAL;
    assert.ok(isLoopback("127.0.0.1") && isLoopback("::1") && isLoopback("::ffff:127.0.0.1"));
    assert.equal(isLoopback("192.168.1.20"), false);
    let time = 0;
    const run = (limiter, ip) => { let result; const res = { set() {}, on() {} }; limiter({ ip, body: {} }, res, (error) => { result = error?.statusCode || 200; }); return result; };
    const local = createRateLimiter({ max: 1, windowMs: 1000, key: (req) => req.ip, now: () => time });
    assert.deepEqual([run(local, "127.0.0.1"), run(local, "127.0.0.1"), run(local, "::1")], [200, 200, 200]);
    assert.deepEqual([run(local, "192.168.1.20"), run(local, "192.168.1.20")], [200, 429]);
    local.stop();
    process.env.RATE_LIMIT_LOCAL = "true";
    const strict = createRateLimiter({ max: 1, windowMs: 1000, key: (req) => req.ip, now: () => time });
    assert.deepEqual([run(strict, "127.0.0.1"), run(strict, "127.0.0.1")], [200, 429]);
    assert.equal(strict.size(), 1);
    time += 1000; strict.sweep();
    assert.equal(strict.size(), 0);
    strict.stop();
    process.env.RATE_LIMIT_DISABLED = "true";
    const disabled = createRateLimiter({ max: 1, windowMs: 1000, key: (req) => req.ip, now: () => time });
    assert.deepEqual([run(disabled, "192.168.1.20"), run(disabled, "192.168.1.20")], [200, 200]);
    disabled.stop();
  } finally {
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
