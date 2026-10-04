const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { io: createClient } = require("socket.io-client");
const chatEvents = require("./services/chatEventBus");
const { attachChatRealtime, bearerToken, conversationRoom, messagePayload, userRoom } = require("./realtime/chatRealtime");

test("room helpers and message sanitizer expose only canonical chat fields", () => {
  assert.equal(userRoom("u1"), "user:u1");
  assert.equal(conversationRoom("c1"), "conversation:c1");
  assert.equal(bearerToken("Bearer secret"), "secret");
  assert.deepEqual(messagePayload({ conversationId: "c1", message: { id: "m1", senderId: "u1", text: "Halo", attachmentUrl: null, createdAt: "now", passwordHash: "hidden" } }), { conversationId: "c1", message: { id: "m1", senderId: "u1", text: "Halo", attachmentUrl: null, createdAt: "now" } });
});

test("authenticated participant joins and receives sanitized committed event", async (t) => {
  const server = createServer();
  const io = attachChatRealtime(server, {
    allowedOrigins: ["http://localhost:5173"],
    authService: { authenticate: async (token) => token === "valid" ? { id: "u1", roles: ["customer"] } : null },
    chatService: { get: async (id, actor) => { if (id !== "c1" || actor.id !== "u1") throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" }); return { id }; } },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { io.close(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const client = createClient(url, { auth: { token: "valid" }, transports: ["websocket"] });
  t.after(() => client.close());
  await new Promise((resolve, reject) => { client.once("connect", resolve); client.once("connect_error", reject); });
  const joined = await new Promise((resolve) => client.emit("chat:join", { conversationId: "c1" }, resolve));
  assert.equal(joined.ok, true);
  const received = new Promise((resolve) => client.once("chat:message", resolve));
  chatEvents.emit("chat:message", { conversationId: "c1", participantUserIds: ["u1"], message: { id: "m1", senderId: "u1", text: "Persisted", createdAt: "now", passwordHash: "hidden" } });
  assert.deepEqual(await received, { conversationId: "c1", message: { id: "m1", senderId: "u1", text: "Persisted", attachmentUrl: null, createdAt: "now" } });
});

test("unauthenticated socket is rejected", async (t) => {
  const server = createServer();
  const io = attachChatRealtime(server, { allowedOrigins: [], authService: { authenticate: async () => null }, chatService: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { io.close(); server.close(); });
  const client = createClient(`http://127.0.0.1:${server.address().port}`, { transports: ["websocket"], reconnection: false });
  t.after(() => client.close());
  const error = await new Promise((resolve) => client.once("connect_error", resolve));
  assert.equal(error.message, "UNAUTHENTICATED");
});
