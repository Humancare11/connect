import { useEffect, useMemo, useState } from "react";
import Icon from "./lcIcons";
import NotificationsBanner from "./NotificationsBanner";
import { timeOf } from "./chatUtils";
import { bucketOf, activityAt } from "./chatBuckets";
import { initials } from "./visitorUtils";

// Left column: the chat list (docs/live-chat-admin-ui.html). Active chats (a message in the last 10 minutes, online or
// not) are grouped by who holds them; "Recent (temp archive)" holds the chats quiet for 10 minutes but still from today
// (India time). Older chats are on the Archive page. Which list a chat is in comes from its last message only
// (chatBuckets.js), so a new message brings it straight back to Active. Each group shows its count, can be collapsed,
// and is sorted by latest activity, newest on top.
const RECENT = "Recent (temp archive)";
const groupsFor = (view, me) =>
  view === "live"
    ? [
        ["Queue", (c) => c.bucket === "active" && c.mode === "queue"],
        ["My chats", (c) => c.bucket === "active" && c.mode === "live" && c.assignee?.id === me],
        ["Other agents", (c) => c.bucket === "active" && c.mode === "live" && c.assignee?.id !== me],
        ["Back with the AI", (c) => c.bucket === "active" && c.mode === "ai"],
        ["Ended or resolved", (c) => c.bucket === "active" && c.mode === "archived"],
        [RECENT, (c) => c.bucket === "recent"],
      ]
    : [
        ["Talking to the AI", (c) => c.bucket === "active" && c.mode !== "archived"],
        ["Ended or resolved", (c) => c.bucket === "active" && c.mode === "archived"],
        [RECENT, (c) => c.bucket === "recent"],
      ];


function Item({ row, active, typing, onSelect }) {
  const last = row.preview;
  let preview = "";
  let withReply = false;
  if (last) {
    withReply = last.sender === "ai" || last.sender === "agent";
    preview = last.text;
  }
  return (
    <button type="button" className={`wk-conv${active ? " is-active" : ""}${row.mode === "archived" ? " is-closed" : ""}`} onClick={() => onSelect(row.conversationId)}>
      <span className={`wk-av${row.name ? "" : " wk-av--anon"}`}>{row.name ? initials(row.name) : "V"}</span>
      <span className="wk-conv-main">
        <span className="wk-row">
          <span className="wk-conv-name">{row.name || row.ip || "Visitor"}</span>
          <span className="wk-mono wk-small wk-muted">{timeOf(row.preview?.at || row.lastMessageAt)}</span>
        </span>
        <span className="wk-row">
          {typing ? (
            <span className="wk-prev wk-prev--typing">typing…</span>
          ) : (
            <span className="wk-prev">
              {withReply && <Icon name="reply" size={13} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</span>
            </span>
          )}
          {row.unread > 0 && <span className="wk-badge">{row.unread}</span>}
        </span>
      </span>
    </button>
  );
}

export default function ChatList({ view, rows, me, activeId, typing, query, onQuery, onSelect, loading, clockOffset = 0 }) {
  const [collapsed, setCollapsed] = useState({});
  // Chats move Active -> Recent (10 minutes) -> Archive page (after India midnight) on their own: re-sort every 15 s.
  // Time is the server's (clockOffset = server minus this computer), so a wrong clock on this computer cannot hide chats.
  const [tick, setTick] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    setTick(Date.now() + clockOffset);
    const timer = window.setInterval(() => setTick(Date.now() + clockOffset), 15_000);
    return () => window.clearInterval(timer);
  }, [clockOffset]);
  const live = view === "live";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const current = rows.map((r) => ({ ...r, bucket: bucketOf(r, tick) })).filter((r) => r.bucket !== "archive");
    if (!q) return current;
    return current.filter((r) => [r.name, r.email, r.ip, r.city, r.state, r.country, r.conversationId, r.topic].join(" ").toLowerCase().includes(q));
  }, [rows, query, tick]);

  return (
    <nav className="wk-list" aria-label="Chats" data-lenis-prevent>
      <div className="lhead">{live ? "All chats" : "AI chats"}</div>
      <div className="wk-notif">
        <NotificationsBanner />
      </div>
      <div className="wk-search">
        <Icon name="search" size={16} />
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search name, email, IP or city" aria-label="Search chats" />
      </div>
      <div>
        {!loading && filtered.length === 0 && <div className="wk-empty">{query ? "No chats match" : live ? "No live agent chats yet" : "No AI chats right now"}</div>}
        {groupsFor(view, me).map(([title, test]) => {
          const items = filtered.filter(test).sort((a, b) => activityAt(b) - activityAt(a));
          if (!items.length) return null;
          const closed = collapsed[title];
          return (
            <div key={title}>
              <div className="lh">
                <button type="button" className="lh-t" aria-expanded={!closed} onClick={() => setCollapsed({ ...collapsed, [title]: !closed })}>
                  {title} {items.length} <Icon name="chevD" size={15} />
                </button>
              </div>
              {!closed &&
                items.map((row) => (
                  <Item key={row.conversationId} row={row} active={row.conversationId === activeId} typing={typing.has(row.visitorId)} onSelect={onSelect} />
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
