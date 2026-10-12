import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import { hub } from "./liveChatHub";
import { useLiveChatAdmin } from "./useLiveChatAdmin";
import NotificationsBanner from "./NotificationsBanner";
import BlockedIpsPanel from "./BlockedIpsPanel";
import VisitorPanel from "./VisitorPanel";
import Icon from "./lcIcons";
import {
  ACTIVITY,
  ACTIVITY_CLASS,
  ACTIVITY_FILTERS,
  avatarColor,
  displayName,
  duration,
  flag,
  initials,
  pageLabel,
} from "./visitorUtils";

// Live Chat > Real-time visitors (docs/live-chat-admin-ui.html). Data comes from the shared /livechat-admin connection
// (snapshot, then upsert/remove deltas). Visitors who never chat exist in server memory only; the table stores nothing.
const STUCK_SECONDS = 4 * 60; // Care radar: more than 4 minutes on the booking page without booking
const BOOKING_PREFIXES = ["/book-appointment", "/appointment-booking"];

const STATUS_TEXT = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  denied: "Not authorised for live chat",
  off: "Live chat is switched off on the server",
};

export default function AdminLiveVisitors() {
  const { visitors, status, clockOffset } = useLiveChatAdmin();
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const [activityFilter, setActivityFilter] = useState("all");
  const [match, setMatch] = useState("all");
  const [menu, setMenu] = useState(""); // "", "match" or "filter"
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [selected, setSelected] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [focusContact, setFocusContact] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState("");
  const [error, setError] = useState("");
  const [blockedVersion, setBlockedVersion] = useState(0);
  const userId = String(admin?._id || admin?.id || "");

  useEffect(() => hub.acquire(userId), [userId]);

  // One timer drives every "time on site" cell.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const serverNow = now + clockOffset;
  const secondsOnSite = (visitor) => (serverNow - visitor.joinedAt) / 1000;

  // Close the filter menus on any outside click or Escape.
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".rt-fwrap")) setMenu("");
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const openChat = (visitor) =>
    navigate(`/admin-dashboard/live-chat/${visitor.activity === "ai" ? "ai-chats" : "agent-chats"}/${visitor.conversationId}`);

  // "Start chat" works for visitors who already gave their contact details (a new visitor needs the invite flow).
  const startChat = async (visitor) => {
    setStarting(visitor.visitorId);
    setError("");
    try {
      const { data } = await api.post("/api/admin/livechat/conversations/start", { visitorId: visitor.visitorId });
      navigate(`/admin-dashboard/live-chat/agent-chats/${data.conversationId}`);
    } catch (err) {
      setError(err?.response?.data?.error === "contact_required" ? "This visitor has left the website." : "Could not start the chat.");
    } finally {
      setStarting("");
    }
  };

  // Blocks the visitor's IP: their chats are closed, they are disconnected and cannot come back until unblocked.
  const blockVisitor = async (visitor) => {
    if (!window.confirm(`Block IP ${visitor.ip}? They cannot use the website chat until you unblock it (Blocked IPs, below).`)) return;
    try {
      await api.post(`/api/admin/livechat/visitors/${visitor.visitorId}/block-ip`, { reason: "Blocked from the visitor list" });
      setBlockedVersion((v) => v + 1);
    } catch {
      setError("Could not block that IP.");
    }
  };

  const actionFor = (visitor) => {
    if (visitor.conversationId) {
      const waiting = visitor.activity === "waiting";
      return (
        <button
          type="button"
          className={`rt-btn${waiting ? " rt-btn--join" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            openChat(visitor);
          }}
        >
          {waiting ? "Join" : "View chat"}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="rt-btn"
        disabled={starting === visitor.visitorId}
        title={visitor.name ? "" : "They have not shared contact details yet: they will see a bubble and fill in the form before replying."}
        onClick={(e) => {
          e.stopPropagation();
          startChat(visitor);
        }}
      >
        {starting === visitor.visitorId ? "Starting…" : "Start chat"}
      </button>
    );
  };

  const all = useMemo(() => Array.from(visitors.values()), [visitors]);

  const stuck = useMemo(
    () =>
      all.find(
        (v) =>
          !v.conversationId &&
          v.activity === "browsing" &&
          v.page &&
          BOOKING_PREFIXES.some((prefix) => v.page.path.startsWith(prefix)) &&
          (serverNow - v.page.enteredAt) / 1000 > STUCK_SECONDS
      ),
    [all, serverNow]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((v) => activityFilter === "all" || (ACTIVITY_CLASS[v.activity] || v.activity) === activityFilter)
      .filter(
        (v) =>
          !q ||
          [v.name, v.email, v.ip, v.geo?.city, v.geo?.state, v.geo?.country, v.page?.title, v.page?.path]
            .join(" ")
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => {
        // Visitors waiting for an agent stay at the top, whatever the sort.
        const waiting = (b.activity === "waiting") - (a.activity === "waiting");
        if (waiting) return waiting;
        return (sortDesc ? -1 : 1) * (a.joinedAt < b.joinedAt ? 1 : a.joinedAt > b.joinedAt ? -1 : 0);
      });
  }, [all, activityFilter, query, sortDesc]);

  // Keep a visitor selected so the panel is never empty while the list is not.
  const selectedId = rows.some((v) => v.visitorId === selected) ? selected : rows[0]?.visitorId || "";
  const selectedVisitor = rows.find((v) => v.visitorId === selectedId) || null;

  const onFocused = useCallback(() => setFocusContact(false), []);
  const hidePanel = useCallback(() => setShowPanel(false), []);

  return (
    <div className={`rt${showPanel ? "" : " no-panel"}`}>
      <section className="rt-main">
        <div className="rt-head">
          <h2>Real-time</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={`lx-status lx-status--${status}`} role="status">
              <i /> {STATUS_TEXT[status]}
            </span>
            {!showPanel && (
              <button type="button" className="rt-ptab" onClick={() => setShowPanel(true)} aria-label="Show patient details" title="Show patient details">
                <Icon name="panel" size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="rt-body">
          <NotificationsBanner />
          <div className="rt-radar">
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <circle cx="15" cy="15" r="14" fill="var(--surface-2)" />
              <circle cx="15" cy="15" r="9" fill="none" stroke="var(--muted)" strokeWidth="1" opacity=".6" />
              <circle cx="15" cy="15" r="4" fill="var(--accent)" />
            </svg>
            <b>Care radar</b>
            <Icon name="info" size={15} className="i" />
            <span className="rt-sep" />
            {stuck ? (
              <>
                <span className="rt-rt">
                  <b>{displayName(stuck)}</b>
                  {stuck.geo?.city ? ` (${stuck.geo.city}${stuck.geo.countryCode ? `, ${stuck.geo.countryCode}` : ""})` : ""} has been on{" "}
                  <b>{pageLabel(stuck)}</b> for {Math.floor((serverNow - stuck.page.enteredAt) / 60000)} minutes without booking. They may
                  need help.
                </span>
                {actionFor(stuck)}
              </>
            ) : (
              <span className="rt-rt">
                Monitoring your live traffic. <b>Patients who seem stuck on booking</b> will appear here.
              </span>
            )}
          </div>

          <div className="rt-filters">
            <div className="rt-fwrap">
              <button type="button" className="rt-fbtn" aria-expanded={menu === "match"} onClick={() => setMenu(menu === "match" ? "" : "match")}>
                Match {match} <Icon name="chevD" size={15} />
              </button>
              {menu === "match" && (
                <div className="rt-pop" role="menu">
                  {["all", "any"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={match === m ? "is-on" : ""}
                      onClick={() => {
                        setMatch(m);
                        setMenu("");
                      }}
                    >
                      Match {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rt-fwrap">
              <button type="button" className="rt-fbtn" aria-expanded={menu === "filter"} onClick={() => setMenu(menu === "filter" ? "" : "filter")}>
                <Icon name="funnel" size={16} className="i" /> Filter
                {activityFilter !== "all" && <span className="rt-fcount">1</span>}
              </button>
              {menu === "filter" && (
                <div className="rt-pop" role="menu">
                  {ACTIVITY_FILTERS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={activityFilter === key ? "is-on" : ""}
                      onClick={() => {
                        setActivityFilter(key);
                        setMenu("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rt-fwrap">
              <input
                type="search"
                className="rt-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, IP or city…"
                aria-label="Search patients"
              />
            </div>
          </div>

          {error && (
            <div className="rt-error" role="alert">
              {error}
            </div>
          )}

          <div className="rt-count">
            {rows.length} {rows.length === 1 ? "patient" : "patients"}
          </div>
          <div className="rt-tablewrap">
            <table className="rt-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Activity</th>
                  <th>Actions</th>
                  <th>Teammate</th>
                  <th>
                    <button
                      type="button"
                      className={`rt-sort${sortDesc ? " is-desc" : ""}`}
                      onClick={() => setSortDesc(!sortDesc)}
                      title="Sort by time on all pages"
                    >
                      Time on all pages <Icon name="up" size={14} className="i" />
                    </button>
                  </th>
                  <th>Country</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((visitor) => {
                  const activity = ACTIVITY_CLASS[visitor.activity] || visitor.activity;
                  const geo = visitor.geo || {};
                  return (
                    <tr
                      key={visitor.visitorId}
                      className={`rt-row${visitor.visitorId === selectedId ? " is-sel" : ""}`}
                      onClick={() => {
                        setSelected(visitor.visitorId);
                        setShowPanel(true);
                      }}
                    >
                      <td>
                        <div className="rt-who">
                          <span className="rt-av" style={{ background: avatarColor(visitor) }}>
                            {visitor.name ? initials(visitor.name) : "P"}
                          </span>
                          <span>{displayName(visitor)}</span>
                        </div>
                      </td>
                      <td>{visitor.email ? <span className="rt-email">{visitor.email}</span> : "-"}</td>
                      <td>
                        <span className={`rt-act rt-act--${activity}`}>
                          <i />
                          {ACTIVITY[visitor.activity] || "Browsing"}
                        </span>
                      </td>
                      <td>
                        <div className="rt-actions">
                          {actionFor(visitor)}
                          <button
                            type="button"
                            className="rt-icbtn"
                            aria-label={`Add contact details for ${displayName(visitor)}`}
                            title="Add contact details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(visitor.visitorId);
                              setShowPanel(true);
                              setFocusContact(true);
                            }}
                          >
                            <Icon name="pencil" size={15} className="i" />
                          </button>
                        </div>
                      </td>
                      <td>{visitor.assignedTo || "-"}</td>
                      <td>{duration(secondsOnSite(visitor))}</td>
                      <td>{geo.country ? `${flag(geo.countryCode)} ${geo.country}` : "-"}</td>
                      <td>{geo.state || "-"}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="rt-empty">
                      {status === "off"
                        ? "Live chat is switched off. Set LIVECHAT_ENABLED=true on the server to turn it on."
                        : "No patients match this filter"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <BlockedIpsPanel refreshKey={blockedVersion} />
        </div>
      </section>
      <aside className="wk-profile rt-panel" aria-label="Patient details">
        <VisitorPanel
          visitor={selectedVisitor}
          now={now}
          serverNow={serverNow}
          onHide={hidePanel}
          onBlock={blockVisitor}
          focusContact={focusContact}
          onFocused={onFocused}
        />
      </aside>
    </div>
  );
}
