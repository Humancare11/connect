import { useMemo } from "react";
import { handoffLabel } from "./liveChatHub";

// Left column: the chat list. AI chats: "Talking to the AI" and "Archived". Live agent chats: Queue, My chats,
// Other agents' chats, Back with the AI (handed back, still a chat that was once live) and Archived.
const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const timeOf = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

const groupsFor = (view, me) =>
  view === "live"
    ? [
        ["Queue · waiting for an agent", (c) => c.mode === "queue"],
        ["My chats", (c) => c.mode === "live" && c.assignee?.id === me],
        ["Other agents' chats", (c) => c.mode === "live" && c.assignee?.id !== me],
        ["Back with the AI", (c) => c.mode === "ai"],
        ["Archived", (c) => c.mode === "archived"],
      ]
    : [
        ["Talking to the AI", (c) => c.mode !== "archived"],
        ["Archived", (c) => c.mode === "archived"],
      ];

function ModeTag({ row, me }) {
  if (row.mode === "archived") {
    const label = { patient_left: "Left", blocked: "Blocked" }[row.closedReason] || "Resolved";
    return <span className="wk-tag wk-tag--done">{label}</span>;
  }
  if (row.mode === "queue") return <span className="wk-tag wk-tag--wait">{row.offline ? "Offline request" : "Waiting"}</span>;
  if (row.mode === "live") return <span className="wk-tag wk-tag--human">{row.assignee?.id === me ? "You" : row.assignee?.name || "Agent"}</span>;
  return <span className="wk-tag wk-tag--ai">AI</span>;
}

function Item({ row, me, active, typing, onSelect }) {
  const last = row.preview;
  let preview = "";
  if (typing) preview = null;
  else if (row.mode === "archived" && row.closedReason === "patient_left") preview = "Archived · patient left the website";
  else if (row.invited) preview = "Invited · no reply yet";
  else if (last) {
    const who = last.sender === "ai" ? "AI: " : last.sender === "agent" ? (row.assignee?.id === me ? "You: " : "Agent: ") : "";
    preview = `${who}${last.text}`;
  }
  return (
    <button type="button" className={`wk-conv${active ? " is-active" : ""}${row.mode === "archived" ? " is-closed" : ""}`} onClick={() => onSelect(row.conversationId)}>
      <span className={`wk-av${row.name ? "" : " wk-av--anon"}`}>{row.name ? initials(row.name) : "V"}</span>
      <span className="wk-conv-main">
        <span className="wk-row">
          <span className="wk-conv-name">{row.name || row.ip || "Visitor"}</span>
          <span className="wk-mono wk-small">{timeOf(row.preview?.at || row.lastMessageAt)}</span>
        </span>
        {typing ? <span className="wk-prev wk-prev--typing">typing…</span> : <span className="wk-prev">{preview}</span>}
        <span className="wk-row">
          <ModeTag row={row} me={me} />
          {row.mode === "queue" && handoffLabel(row.handoffReason) && (
            <span className="wk-tag wk-tag--lang" title="Why this chat needs a person">{handoffLabel(row.handoffReason)}</span>
          )}
          {row.language?.name ? (
            <span className="wk-tag wk-tag--lang" title={`The patient writes in ${row.language.name}`}>
              {row.language.name}
            </span>
          ) : null}
          {row.rating ? <span className="wk-rating">{"★".repeat(row.rating)}</span> : null}
          {row.unread > 0 && <span className="wk-badge">{row.unread}</span>}
        </span>
      </span>
    </button>
  );
}

export default function ChatList({ view, rows, me, activeId, typing, query, onQuery, onSelect, loading }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.email, r.ip, r.city, r.state, r.country, r.conversationId, r.topic].join(" ").toLowerCase().includes(q));
  }, [rows, query]);

  const groups = groupsFor(view, me);
  const live = view === "live";

  return (
    <nav className="wk-list" aria-label="Chats">
      <div className={`wk-intro${live ? "" : " wk-intro--ai"}`}>
        <b>{live ? "Live agent chats" : "AI chats"}</b>
        <span>
          {live
            ? "Patients who shared their contact details to talk to a person, and chats your team started."
            : "Patients talking only to the AI assistant. Reply or take over and the chat moves to Live agent chats."}
        </span>
      </div>
      <div className="wk-search">
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search name, email, IP or city…" aria-label="Search chats" />
      </div>
      {!loading && filtered.length === 0 && <div className="wk-empty">{query ? "No chats match" : live ? "No live agent chats yet" : "No AI chats right now"}</div>}
      {groups.map(([title, test]) => {
        const items = filtered.filter(test);
        if (!items.length) return null;
        return (
          <div key={title}>
            <div className="wk-list-head">
              {title} · {items.length}
            </div>
            {items.map((row) => (
              <Item key={row.conversationId} row={row} me={me} active={row.conversationId === activeId} typing={typing.has(row.visitorId)} onSelect={onSelect} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
