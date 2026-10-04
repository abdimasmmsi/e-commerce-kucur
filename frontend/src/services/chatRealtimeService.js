import { io } from "socket.io-client";
import { getAuthToken } from "./authStorage";

const SOCKET_URL = String(import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let socket;
const joinedConversations = new Set();

export const mergeMessageById = (messages, incoming) => messages.some((message) => message.id === incoming.id)
  ? messages
  : [...messages, incoming];

export const chatRealtimeService = {
  connect() {
    const token = getAuthToken();
    if (!token) return null;
    if (!socket) {
      socket = io(SOCKET_URL, { auth: { token }, autoConnect: false, reconnection: true });
      socket.on("connect", () => joinedConversations.forEach((conversationId) => socket.emit("chat:join", { conversationId })));
    }
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  },
  disconnect() { socket?.disconnect(); socket = undefined; joinedConversations.clear(); },
  join(conversationId) { joinedConversations.add(conversationId); if (socket?.connected) socket.emit("chat:join", { conversationId }); },
  leave(conversationId) { joinedConversations.delete(conversationId); if (socket?.connected) socket.emit("chat:leave", { conversationId }); },
  get connected() { return Boolean(socket?.connected); },
};
