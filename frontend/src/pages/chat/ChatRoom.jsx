import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { usePreferences } from "../../context/PreferencesContext";
import "./Chat.css";
import "./ChatOrderToolbar.css";

function ChatRoom({ adminMode = false }) {
  const { conversationId } = useParams();
  const { activeRole, user } = useAuth();
  const { closeConversation, conversations, deleteDraft, joinConversation, leaveConversation, markRead, refreshConversation, sendMessage } = useChat();
  const { formatDate, t } = usePreferences();
  const quickReplies = [t("chatRoom.quickHello"), t("chatRoom.quickWait"), t("chatRoom.quickThanks")];
  const roleLabel = (role) => t(`role.${String(role).toLowerCase()}`);
  const [text, setText] = useState("");
  const messageOrder = "asc";
  const conversation = useMemo(() => conversations.find((item) => String(item.id) === String(conversationId)), [conversationId, conversations]);
  const canAccess = conversation && (adminMode
    ? activeRole === "admin" && conversation.type === "admin-support"
    : conversation.participants.some((participant) => participant.userId === user.id));
  const requesterId = conversation?.participants.find((participant) => participant.role !== "admin" && participant.role !== "merchant")?.userId;
  const isEmptyRequesterDraft = !adminMode
    && requesterId === user.id
    && conversation?.status === "open"
    && conversation.messages.length === 0;
  const emptyDraftRef = useRef(isEmptyRequesterDraft);
  const deleteDraftRef = useRef(deleteDraft);
  const draftCleanupTimerRef = useRef(null);
  const orderedMessages = useMemo(() => [...(conversation?.messages ?? [])].sort((a, b) => {
    const difference = new Date(a.createdAt) - new Date(b.createdAt);
    return messageOrder === "asc" ? difference : -difference;
  }), [conversation?.messages, messageOrder]);

  useEffect(() => {
    void refreshConversation(conversationId).catch(() => undefined);
  }, [conversationId, refreshConversation]);

  useEffect(() => {
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  useEffect(() => {
    if (canAccess) void markRead(conversationId);
  }, [canAccess, conversation?.lastMessageAt, conversationId, markRead]);

  useEffect(() => {
    emptyDraftRef.current = isEmptyRequesterDraft;
    deleteDraftRef.current = deleteDraft;
  }, [deleteDraft, isEmptyRequesterDraft]);

  useEffect(() => {
    if (draftCleanupTimerRef.current) globalThis.clearTimeout(draftCleanupTimerRef.current);
    return () => {
      draftCleanupTimerRef.current = globalThis.setTimeout(() => {
        if (emptyDraftRef.current) void deleteDraftRef.current(conversationId).catch(() => undefined);
      }, 0);
    };
  }, [conversationId]);

  if (!canAccess) return <div className="page-container chat-page"><section className="card chat-empty-state"><h1>{t("chat.unavailable")}</h1><p>{t("chat.unavailableHint")}</p><Link to={adminMode ? "/admin/support-chats" : "/messages"}>{t("chat.backInbox")}</Link></section></div>;

  const counterpart = conversation.participants.find((participant) => participant.userId !== user.id) ?? conversation.participants[0];
  const currentParticipant = conversation.participants.find((participant) => participant.userId === user.id);
  const requesterCanClose = !adminMode
    && conversation.type === "admin-support"
    && currentParticipant?.role !== "admin"
    && conversation.messages.length > 0
    && conversation.status === "open";
  const sendCurrentMessage = async () => {
    if (!text.trim() || conversation.status !== "open") return;
    await sendMessage(conversation.id, text);
    setText("");
  };
  const submit = (event) => {
    event.preventDefault();
    sendCurrentMessage();
  };
  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendCurrentMessage();
    }
  };

  const contextPath = conversation.orderId
        ? (activeRole === "merchant" ? `/merchant/stores/${conversation.storeId}/orders/${conversation.orderId}` : `/orders/${conversation.orderId}`)
        : conversation.productId ? `/products/${conversation.productId}` : null;

  return <div className="page-container chat-page">
    <div className="chat-room-header"><Link to={adminMode ? "/admin/support-chats" : "/messages"}>← {t("chat.backInbox")}</Link><div><span className="chat-avatar">{counterpart.name.charAt(0).toUpperCase()}</span><div><h1>{adminMode ? conversation.participants.find((participant) => participant.role !== "admin")?.name : counterpart.name}</h1><p>{conversation.subject} · {conversation.type === "admin-support" ? t("chat.customerService") : conversation.storeName}</p></div></div>{adminMode && conversation.status === "open" && <button type="button" onClick={() => closeConversation(conversation.id)}>{t("chat.markComplete")}</button>}</div>
    {contextPath && <section className="chat-context-card"><div><span>{conversation.orderId ? t("chat.orderContext") : t("chat.productContext")}</span><strong>{conversation.orderNumber ?? conversation.productName ?? conversation.subject}</strong></div><Link to={contextPath}>{t("chat.viewDetail")}</Link></section>}
    <section className="card chat-room">
      <div className="chat-order-toolbar"><span>{t("chat.messages", { count: conversation.messages.length })}</span></div>
      <div className="chat-message-list" aria-live="polite">
        {!conversation.messages.length && <div className="chat-room-welcome"><strong>{t("chat.startConversation")}</strong><p>{t("chat.safety")}</p></div>}
        {orderedMessages.map((message) => {
          const own = message.senderId === user.id;
          return <article className={`chat-message ${own ? "own" : "other"}`} key={message.id}><div><span>{message.senderName}</span>{message.senderRole && <em>{roleLabel(message.senderRole)}</em>}</div><p>{message.text}</p><time>{formatDate(message.createdAt, { dateStyle: "medium", timeStyle: "short" })}</time></article>;
        })}
      </div>
      {requesterCanClose && <label className="chat-requester-close"><input type="checkbox" onChange={(event) => { if (event.target.checked) closeConversation(conversation.id); }} /><span><strong>{t("chat.completeConversation")}</strong><small>{t("chat.completeHint")}</small></span></label>}
      {adminMode && conversation.status === "open" && <div className="chat-quick-replies">{quickReplies.map((reply) => <button type="button" onClick={() => setText(reply)} key={reply}>{reply}</button>)}</div>}
      {conversation.status === "open" ? <form className="chat-composer" onSubmit={submit}><label><span>{t("chat.composerLabel")}</span><textarea rows="2" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength="2000" placeholder={t("chat.placeholder")} /></label><div><small>{text.length}/2000</small><button className="primary-button" type="submit" disabled={!text.trim()}>{t("chat.send")}</button></div></form> : <div className="chat-closed-notice">{t("chat.closedNotice")}</div>}
    </section>
  </div>;
}

export default ChatRoom;
