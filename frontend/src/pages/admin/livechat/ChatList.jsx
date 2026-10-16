import { useEffect, useMemo, useState } from "react";
import Icon from "./lcIcons";
import NotificationsBanner from "./NotificationsBanner";
import { timeOf } from "./chatUtils";
import { initials } from "./visitorUtils";

// Left column: the chat list (docs/live-chat-admin-ui.html). Live agent chats: Queue, My chats, Other agents, Back with
// the AI and Archive temp (chats archived today, India time; at midnight it empties and the Archive page has them).
// AI chats: Talking to the AI and Archive temp. Each group shows its count, can be collapsed, and is always sorted by
// latest activity, newest on top (a chat with a new message moves to the top).
const groupsFor = (view, me) =>
  view === "live"
    ? [
        ["Queue", (c) => c.mode === "queue"],
        ["My chats", (c) => c.mode === "live" && c.assignee?.id === me],
        ["Other agents", (c) => c.mode === "live" && c.assignee?.id !== me],
        ["Back with the AI", (c) => c.mode === "ai"],
        ["Archive temp", (c) => c.mode === "archived"],
      ]
    : [
        ["Talking to the AI", (c) => c.mode !== "archived"],
        ["Archive temp", (c) => c.mode === "archived"],
      ];

// Midnight in India (a fixed +05:30 offset, no daylight saving) that started the day containing `ms`.
const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;
const istDayStart = (ms) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
const activityAt = (row) => new Date(row.lastMessageAt || row.startedAt || 0).getTime();

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

export default function ChatList({ view, rows, me, activeId, typing, query, onQuery, onSelect, loading }) {
  const [collapsed, setCollapsed] = useState({});
  // Archive temp holds only chats archived today (India time): a minute timer drops yesterday's at midnight, without a reload.
  const [dayStart, setDayStart] = useState(() => istDayStart(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setDayStart(istDayStart(Date.now())), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const live = view === "live";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const current = rows.filter((r) => r.mode !== "archived" || new Date(r.closedAt || r.lastMessageAt).getTime() >= dayStart);
    if (!q) return current;
    return current.filter((r) => [r.name, r.email, r.ip, r.city, r.state, r.country, r.conversationId, r.topic].join(" ").toLowerCase().includes(q));
  }, [rows, query, dayStart]);

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
