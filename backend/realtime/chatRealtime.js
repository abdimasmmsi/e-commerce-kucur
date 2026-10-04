const { Server } = require("socket.io");
const chatEvents = require("../services/chatEventBus");

const userRoom = (userId) => `user:${String(userId)}`;
const conversationRoom = (conversationId) => `conversation:${String(conversationId)}`;
const bearerToken = (header) => /^Bearer\s+(.+)$/i.exec(String(header || ""))?.[1] || null;
const socketToken = (socket) => socket.handshake.auth?.token || bearerToken(socket.handshake.headers.authorization);
const messagePayload = (payload) => ({
  conversationId: payload.conversationId,
  message: {
    id: payload.message.id,
    senderId: payload.message.senderId,
    text: payload.message.text,
    attachmentUrl: payload.message.attachmentUrl || null,
    createdAt: payload.message.createdAt,
  },
});

function attachChatRealtime(httpServer, { authService, chatService, allowedOrigins }) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin tidak diizinkan."));
      },
      credentials: false,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socketToken(socket);
      const user = token && await authService.authenticate(token);
      if (!user) return next(new Error("UNAUTHENTICATED"));
      socket.data.user = user;
      socket.data.token = token;
      return next();
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const actor = socket.data.user;
    socket.join(userRoom(actor.id));
    socket.on("chat:join", async ({ conversationId } = {}, acknowledge = () => {}) => {
      try {
        const currentUser = await authService.authenticate(socket.data.token);
        if (!currentUser) { socket.disconnect(true); return acknowledge({ ok: false, code: "UNAUTHENTICATED" }); }
        await chatService.get(String(conversationId || ""), currentUser);
        await socket.join(conversationRoom(conversationId));
        acknowledge({ ok: true });
      } catch (error) {
        acknowledge({ ok: false, code: error.code || "FORBIDDEN", message: error.message });
      }
    });
    socket.on("chat:leave", ({ conversationId } = {}, acknowledge = () => {}) => {
      socket.leave(conversationRoom(conversationId));
      acknowledge({ ok: true });
    });
  });

  const unsubscribe = chatEvents.subscribe((event, payload) => {
    const room = conversationRoom(payload.conversationId);
    if (event === "chat:message") io.to(room).emit(event, messagePayload(payload));
    if (event === "chat:read") io.to(room).emit(event, { conversationId: payload.conversationId, userId: payload.userId, readAt: payload.readAt });
    if (event === "chat:closed") io.to(room).emit(event, { conversationId: payload.conversationId, closedByUserId: payload.closedByUserId, closedAt: payload.closedAt });
    for (const userId of payload.participantUserIds || []) io.to(userRoom(userId)).emit("chat:inbox-updated", { conversationId: payload.conversationId, reason: event });
  });
  httpServer.once("close", unsubscribe);
  return io;
}

module.exports = { attachChatRealtime, bearerToken, conversationRoom, messagePayload, socketToken, userRoom };
