import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { usePreferences } from "../../context/PreferencesContext";
import PageHeader from "../../components/ui/PageHeader";
import LoadingPanel from "../../components/ui/LoadingPanel";
import "../auth/Profile.css";
import "./Chat.css";
import "./ChatInbox.css";

function ChatInbox({ adminMode = false }) {
  const navigate = useNavigate();
  const { activeRole, user } = useAuth();
  const { conversations, error, loading, markRead, startSupportChat } = useChat();
  const { formatDate, t } = usePreferences();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleConversations = useMemo(() => conversations
    .filter((conversation) => adminMode
      ? conversation.type === "admin-support"
      : conversation.participants.some((participant) => participant.userId === user.id))
    .filter((conversation) => filter === "all" || conversation.type === filter)
    .filter((conversation) => {
      const query = search.trim().toLowerCase();
      return !query || conversation.subject.toLowerCase().includes(query)
        || conversation.participants.some((participant) => participant.name.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const statusDifference = (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1);
      if (statusDifference) return statusDifference;
      const unreadDifference = Number(b.unreadCount ?? 0) - Number(a.unreadCount ?? 0);
      return unreadDifference || new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    }), [adminMode, conversations, filter, search, user.id]);

  const openSupport = async () => {
    const conversation = await startSupportChat("Live Chat Customer Service");
    navigate(`/messages/${conversation.id}`);
  };
  const routePrefix = adminMode ? "/admin/support-chats" : "/messages";
  const filterOptions = [
    { key: "all", title: t("chat.all"), description: t("chatInbox.allHint") },
    { key: "admin-support", title: t("chat.customerService"), description: t("chatInbox.supportHint") },
    !adminMode && { key: "customer-seller", title: t("chat.customerSeller"), description: t("chatInbox.sellerHint") },
  ].filter(Boolean);
  const currentFilter = filterOptions.find((item) => item.key === filter) ?? filterOptions[0];

  if (!adminMode && activeRole === "admin") return <Navigate to="/admin/support-chats" replace />;

  // Pembeli/merchant biasanya cuma punya sedikit percakapan: cari & filter baru muncul kalau sudah banyak.
  const showTools = adminMode || conversations.length > 5;

  return <div className="page-container chat-page">
    <PageHeader eyebrow={t(adminMode ? "workspace.adminEyebrow" : "account.eyebrow")} title={t(adminMode ? "chat.supportTitle" : "chat.inboxTitle")} description={t(adminMode ? "chat.adminSubtitle" : "chat.inboxSubtitle")} actions={!adminMode && activeRole !== "admin" ? <button className="primary-button chat-support-button" type="button" onClick={openSupport}>{t("chat.chatAdmin")}</button> : null} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {showTools && <div className="chat-inbox-toolbar"><label><span>{t("chat.search")}</span><input id="chat-inbox-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("chat.searchPlaceholder")} /></label><label><span>{t("chat.type")}</span><select id="chat-inbox-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>{filterOptions.map((item) => <option value={item.key} key={item.key}>{item.title}</option>)}</select></label></div>}
    <div className="chat-inbox-workspace">
      <section className="chat-conversation-pane">{showTools && <header><div><h2>{currentFilter.title}</h2><p>{t("chatInbox.conversationCount", { count: visibleConversations.length })}</p></div></header>}<div className="chat-conversation-list">
      {visibleConversations.map((conversation) => {
        const counterpart = conversation.participants.find((participant) => participant.userId !== user.id) ?? conversation.participants[0];
        const lastMessage = conversation.messages.at(-1);
        const unread = conversation.unreadCount ?? 0;
        const path = `${routePrefix}/${conversation.id}`;
        const openConversation = async (event) => {
          if (!unread) return;
          event.preventDefault();
          await markRead(conversation.id);
          navigate(path);
        };
        return <Link className="chat-conversation-card" to={path} onClick={openConversation} key={conversation.id}>
          <span className="chat-avatar" aria-hidden="true">{counterpart?.name?.charAt(0).toUpperCase() ?? "C"}</span>
          <div className="chat-conversation-copy"><div><strong>{adminMode ? conversation.participants.find((participant) => participant.role !== "admin")?.name : counterpart?.name}</strong><time>{formatDate(conversation.lastMessageAt, { dateStyle: "medium", timeStyle: "short" })}</time></div><span>{conversation.type === "admin-support" ? t("chat.customerService") : conversation.storeName}</span><h2>{conversation.subject}</h2><p>{lastMessage?.text ?? t("chat.noMessages")}</p></div>
          <div className="chat-card-status"><span className={`chat-status ${conversation.status}`}>{t(conversation.status === "open" ? "chat.active" : "chat.closed")}</span>{unread > 0 && <strong>{unread}</strong>}</div>
        </Link>;
      })}
      {loading && !visibleConversations.length && <LoadingPanel compact label={t("chat.loading")} rows={4} />}
      {!loading && !visibleConversations.length && <section className="chat-empty-state"><h2>{t("chat.empty")}</h2><p>{t(adminMode ? "chat.adminEmptyHint" : "chat.userEmptyHint")}</p>{!adminMode && activeRole !== "admin" && <button className="primary-button" type="button" onClick={openSupport}>{t("chat.startSupport")}</button>}</section>}
      </div></section>
      <aside className="chat-inbox-empty-panel"><span className="chat-empty-icon" aria-hidden="true">✦</span><h2>{currentFilter.title}</h2><p>{t(adminMode ? "chat.adminEmptyHint" : "chat.userEmptyHint")}</p></aside>
    </div>
  </div>;
}

export default ChatInbox;
