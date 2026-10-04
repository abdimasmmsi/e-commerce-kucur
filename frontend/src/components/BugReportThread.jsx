import { useMemo, useState } from "react";
import ChronologyOrderControl from "./ChronologyOrderControl";
import "./BugReportThread.css";
import "./BugReportThreadOrder.css";

function BugReportThread({ report, currentUserId, onSend }) {
  const [text, setText] = useState("");
  const [order, setOrder] = useState("asc");
  const isResolved = report.status === "resolved";
  const orderedMessages = useMemo(() => [...report.messages].sort((a, b) => {
    const difference = new Date(a.createdAt) - new Date(b.createdAt);
    return order === "asc" ? difference : -difference;
  }), [order, report.messages]);
  const send = () => {
    if (!text.trim() || isResolved) return;
    onSend(text);
    setText("");
  };
  const submit = (event) => { event.preventDefault(); send(); };
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      send();
    }
  };

  return <section className="card bug-thread"><div className="bug-thread-heading"><div><span>Klarifikasi</span><h2>Percakapan Reporter & Admin</h2></div><div className="bug-thread-tools"><small>{report.messages.length} pesan</small><ChronologyOrderControl value={order} onChange={setOrder} /></div></div><div className="bug-thread-messages">{orderedMessages.map((message) => <article className={message.senderId === currentUserId ? "own" : "other"} key={message.id}><div><strong>{message.senderName}</strong><span>{message.senderRole}</span></div><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}{!report.messages.length && <div className="bug-thread-empty"><strong>Belum ada percakapan</strong><p>Gunakan thread ini jika Admin membutuhkan detail tambahan atau reporter ingin memberi klarifikasi.</p></div>}</div>{!isResolved ? <form onSubmit={submit}><label><span>Pesan · Ctrl+Enter untuk mengirim</span><textarea rows="3" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown} maxLength="2000" placeholder="Tulis pertanyaan atau klarifikasi..." /></label><div><small>{text.length}/2000</small><button className="primary-button" type="submit" disabled={!text.trim()}>Kirim Pesan</button></div></form> : <div className="bug-thread-closed">Laporan sudah selesai. Percakapan tidak dapat dilanjutkan.</div>}</section>;
}

export default BugReportThread;
