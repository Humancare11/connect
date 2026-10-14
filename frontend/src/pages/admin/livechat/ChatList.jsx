import { useMemo, useState } from "react";
import { handoffLabel } from "./liveChatHub";
import Icon from "./lcIcons";
import NotificationsBanner from "./NotificationsBanner";
import { CLOSED_LABEL, timeOf } from "./chatUtils";
import { initials } from "./visitorUtils";

// Left column: the chat list (docs/live-chat-admin-ui.html). Live agent chats: Queue, My chats, Other agents, Back with
// the AI and Archive temp (archived in the last 24 hours; the Archive page has the rest). AI chats: Talking to the AI and Archive temp. Each group shows its count, can be collapsed, and
// sorts Oldest / Newest first.
const groupsFor = (view, me) =>
  view === "live"
    ? [
        ["Queue", (c) => c.mode === "queue", "Oldest"],
        ["My chats", (c) => c.mode === "live" && c.assignee?.id === me, "Oldest"],
        ["Other agents", (c) => c.mode === "live" && c.assignee?.id !== me, "Newest"],
        ["Back with the AI", (c) => c.mode === "ai", "Newest"],
        ["Archive temp", (c) => c.mode === "archived", "Newest"],
      ]
    : [
        ["Talking to the AI", (c) => c.mode !== "archived", "Newest"],
        ["Archive temp", (c) => c.mode === "archived", "Newest"],
      ];

// Small labels under the preview: why a chat is in the Queue, what happened to its follow-up email, who holds it.
function Labels({ row, me }) {
  const tags = [];
  if (row.mode === "queue") {
    if (row.emailStatus === "failed") {
      tags.push(
        <span key="mail" className="wk-tag wk-tag--wait" title="The follow-up email could not be sent">
          Email failed
        </span>
      );
    } else if (row.emailFollowUp) {
      tags.push(
        <span key="mail" className="wk-tag wk-tag--wait">
          Email follow-up
        </span>
      );
    }
    if (handoffLabel(row.handoffReason)) {
      tags.push(
        <span key="why" className="wk-tag wk-tag--lang" title="Why this chat needs a person">
          {handoffLabel(row.handoffReason)}
        </span>
      );
    }
  } else if (row.mode === "live" && row.assignee?.id !== me) {
    tags.push(
      <span key="who" className="wk-tag wk-tag--human">
        {row.assignee?.name || "Agent"}
      </span>
    );
  } else if (row.mode === "archived") {
    tags.push(
      <span key="done" className="wk-tag wk-tag--done">
        {CLOSED_LABEL[row.closedReason] || "Resolved"}
      </span>
    );
  }
  if (row.rating) {
    tags.push(
      <span key="stars" className="wk-rating">
        {"★".repeat(row.rating)}
      </span>
    );
  }
  return tags.length ? <span className="wk-tags-row">{tags}</span> : null;
}

function Item({ row, me, active, typing, onSelect }) {
  const last = row.preview;
  let preview = "";
  let withReply = false;
  if (row.mode === "archived" && row.closedReason === "patient_left") preview = "Archived · patient left the website";
  else if (row.mode === "archived" && row.closedReason === "inactive") preview = "Archived · closed after inactivity";
  else if (row.invited) preview = "Invited · no reply yet";
  else if (last) {
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
          {row.language?.name ? (
            <span className="wk-tag wk-tag--lang" title={`The patient writes in ${row.language.name}`}>
              {row.language.name}
            </span>
          ) : null}
          {row.unread > 0 && <span className="wk-badge">{row.unread}</span>}
        </span>
        <Labels row={row} me={me} />
      </span>
    </button>
  );
}

export default function ChatList({ view, rows, me, activeId, typing, query, onQuery, onSelect, loading }) {
  const [collapsed, setCollapsed] = useState({});
  const [sortBy, setSortBy] = useState({});
  const live = view === "live";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.email, r.ip, r.city, r.state, r.country, r.conversationId, r.topic].join(" ").toLowerCase().includes(q));
  }, [rows, query]);

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
        {groupsFor(view, me).map(([title, test, defaultSort]) => {
          const sort = sortBy[title] || defaultSort;
          const items = filtered
            .filter(test)
            .sort((a, b) => (sort === "Oldest" ? 1 : -1) * (new Date(a.lastMessageAt) - new Date(b.lastMessageAt)));
          if (!items.length) return null;
          const closed = collapsed[title];
          return (
            <div key={title}>
              <div className="lh">
                <button type="button" className="lh-t" aria-expanded={!closed} onClick={() => setCollapsed({ ...collapsed, [title]: !closed })}>
                  {title} {items.length} <Icon name="chevD" size={15} />
                </button>
                <button
                  type="button"
                  className="lh-s"
                  title="Change sort order"
                  onClick={() => setSortBy({ ...sortBy, [title]: sort === "Oldest" ? "Newest" : "Oldest" })}
                >
                  {sort}
                </button>
              </div>
              {!closed &&
                items.map((row) => (
                  <Item key={row.conversationId} row={row} me={me} active={row.conversationId === activeId} typing={typing.has(row.visitorId)} onSelect={onSelect} />
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
