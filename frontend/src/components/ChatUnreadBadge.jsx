import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import "./ChatUnreadBadge.css";

function ChatUnreadBadge({ adminMode = false }) {
  const { user } = useAuth();
  const { conversations } = useChat();
  const count = conversations
    .filter((conversation) => adminMode
      ? conversation.type === "admin-support"
      : conversation.participants.some((participant) => participant.userId === user?.id))
    .reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
  if (!count) return null;
  return <span className="chat-unread-badge" aria-label={`${count} pesan belum dibaca`}>{count > 99 ? "99+" : count}</span>;
}

export default ChatUnreadBadge;
