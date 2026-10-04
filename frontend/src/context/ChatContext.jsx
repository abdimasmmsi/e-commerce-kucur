import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { chatApiService } from "../services/chatApiService";
import { chatRealtimeService } from "../services/chatRealtimeService";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { activeRole, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refreshChats = useCallback(async () => {
    if (!user?.id) { setConversations([]); return; }
    setLoading(true);
    try { const result = await chatApiService.list({ page: 1, limit: 50 }); setConversations(result.items || []); setError(""); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [user?.id]);
  const merge = useCallback((row) => { setConversations((rows) => [row, ...rows.filter((item) => item.id !== row.id)]); return row; }, []);
  const refreshConversation = useCallback(async (id) => merge(await chatApiService.get(id)), [merge]);

  useEffect(() => { const timer = window.setTimeout(() => { void refreshChats(); }, 0); return () => window.clearTimeout(timer); }, [refreshChats]);
  useEffect(() => {
    if (!user?.id) { chatRealtimeService.disconnect(); const timer = window.setTimeout(() => setRealtimeConnected(false), 0); return () => window.clearTimeout(timer); }
    const socket = chatRealtimeService.connect();
    const canonicalRefresh = () => void refreshChats();
    const refreshEventConversation = ({ conversationId }) => { void refreshConversation(conversationId).catch(canonicalRefresh); };
    const onConnect = () => { setRealtimeConnected(true); canonicalRefresh(); };
    const onDisconnect = () => setRealtimeConnected(false);
    socket.on("connect", onConnect); socket.on("disconnect", onDisconnect);
    socket.on("chat:message", refreshEventConversation); socket.on("chat:read", refreshEventConversation);
    socket.on("chat:closed", refreshEventConversation); socket.on("chat:inbox-updated", canonicalRefresh);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect); socket.off("disconnect", onDisconnect);
      socket.off("chat:message", refreshEventConversation); socket.off("chat:read", refreshEventConversation);
      socket.off("chat:closed", refreshEventConversation); socket.off("chat:inbox-updated", canonicalRefresh);
      chatRealtimeService.disconnect();
    };
  }, [refreshChats, refreshConversation, user?.id]);

  const startSupportChat = useCallback(async (subject) => merge(await chatApiService.support(subject, activeRole)), [activeRole, merge]);
  const startSellerChat = useCallback(async (payload) => {
    const body = payload.product ? { productId: payload.product.id }
      : payload.order ? { commerceOrderId: payload.order.id } : null;
    if (!body) throw new Error("Konteks chat canonical belum tersedia.");
    return merge(await chatApiService.customerMerchant(body));
  }, [merge]);
  const sendMessage = useCallback(async (id, text) => { await chatApiService.send(id, text); return refreshConversation(id); }, [refreshConversation]);
  const markRead = useCallback(async (id) => {
    await chatApiService.read(id);
    setConversations((rows) => rows.map((row) => row.id === id ? { ...row, unreadCount: 0 } : row));
    return refreshChats();
  }, [refreshChats]);
  const closeConversation = useCallback(async (id) => merge(await chatApiService.close(id)), [merge]);
  const deleteDraft = useCallback(async (id) => { await chatApiService.deleteDraft(id); setConversations((rows) => rows.filter((row) => row.id !== id)); }, []);
  const joinConversation = useCallback((id) => chatRealtimeService.join(id), []);
  const leaveConversation = useCallback((id) => chatRealtimeService.leave(id), []);
  const value = useMemo(() => ({ conversations, refreshChats, refreshConversation, startSupportChat, startSellerChat, sendMessage, markRead, closeConversation, deleteDraft, joinConversation, leaveConversation, realtimeConnected, loading, error }), [conversations, refreshChats, refreshConversation, startSupportChat, startSellerChat, sendMessage, markRead, closeConversation, deleteDraft, joinConversation, leaveConversation, realtimeConnected, loading, error]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() { const context = useContext(ChatContext); if (!context) throw new Error("useChat must be used inside ChatProvider"); return context; }
