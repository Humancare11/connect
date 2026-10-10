import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import { hub } from "./liveChatHub";
import { useLiveChatAdmin } from "./useLiveChatAdmin";
import NotificationsBanner from "./NotificationsBanner";
import BlockedIpsPanel from "./BlockedIpsPanel";
import "./AdminLiveVisitors.css";

// Live Chat > Real-time visitors. Layout, wording and colours follow docs/chat-demo.html.
// Data comes from the shared /livechat-admin connection (snapshot, then upsert/remove deltas). Visitors who never
// chat exist in server memory only; nothing on this page is stored.
const STUCK_SECONDS = 4 * 60; // Care radar: more than 4 minutes on the booking page without booking
const BOOKING_PREFIXES = ["/book-appointment", "/appointment-booking"];

const ACTIVITY = {
  browsing: "Browsing",
  chatting: "Chatting",
  waiting: "Waiting for agent",
  invited: "Invited",
  ai: "Chatting",
};
const ACTIVITY_CLASS = { ai: "chatting" };
const ACTIVITY_ORDER = { waiting: 0, chatting: 1, ai: 1, invited: 2, browsing: 3 };

const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const duration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

const flag = (code) =>
  /^[A-Z]{2}$/.test(code || "") ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

const pageLabel = (visitor) => visitor.page?.title || visitor.page?.path || "–";
const displayName = (visitor) => visitor.name || visitor.ip || "Visitor";

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
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState("");
  const [startError, setStartError] = useState("");
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

  const openChat = (visitor) =>
    navigate(`/admin-dashboard/live-chat/${visitor.activity === "ai" ? "ai-chats" : "agent-chats"}/${visitor.conversationId}`);

  // "Start chat" works for visitors who already gave their contact details (a new visitor needs the invite flow).
  const startChat = async (visitor) => {
    setStarting(visitor.visitorId);
    setStartError("");
    try {
      const { data } = await api.post("/api/admin/livechat/conversations/start", { visitorId: visitor.visitorId });
      navigate(`/admin-dashboard/live-chat/agent-chats/${data.conversationId}`);
    } catch (err) {
      setStartError(err?.response?.data?.error === "contact_required" ? "This visitor has left the website." : "Could not start the chat.");
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
      setStartError("Could not block that IP.");
    }
  };

  const actionFor = (visitor) => {
    if (visitor.conversationId) {
      const waiting = visitor.activity === "waiting";
      return (
        <button type="button" className={`lcv-btn${waiting ? " lcv-btn--join" : ""}`} onClick={() => openChat(visitor)}>
          {waiting ? "Join" : "View chat"}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="lcv-btn lcv-btn--primary"
        disabled={starting === visitor.visitorId}
        title={visitor.name ? "" : "They have not shared contact details yet: they will see a bubble and fill in the form before replying."}
        onClick={() => startChat(visitor)}
      >
        {starting === visitor.visitorId ? "Starting…" : "Start chat"}
      </button>
    );
  };

  const all = useMemo(() => Array.from(visitors.values()), [visitors]);

  const counts = useMemo(
    () => ({
      website: all.length,
      chatting: all.filter((v) => v.activity === "chatting" || v.activity === "invited").length,
      waiting: all.filter((v) => v.activity === "waiting").length,
      ai: all.filter((v) => v.activity === "ai").length,
    }),
    [all]
  );

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
          [v.name, v.ip, v.geo?.city, v.geo?.state, v.geo?.country, v.page?.title, v.page?.path]
            .join(" ")
            .toLowerCase()
            .includes(q)
      )
      .sort(
        (a, b) =>
          (ACTIVITY_ORDER[a.activity] ?? 9) - (ACTIVITY_ORDER[b.activity] ?? 9) || a.joinedAt - b.joinedAt
      );
  }, [all, activityFilter, query]);

  return (
    <div className="lcv">
      <div className="lcv-title">
        <div>
          <div className="lcv-eyebrow">Humancare Admin · Live Chat</div>
          <h2>Real-time visitors</h2>
        </div>
        <div className="lcv-title-side">
          <span className={`lcv-status lcv-status--${status}`} role="status">
            <i /> {STATUS_TEXT[status]}
          </span>
        </div>
      </div>

      <NotificationsBanner />

      <div className="lcv-kpis">
        <div className="lcv-kpi">
          <div className="lcv-n">{counts.website}</div>
          <div className="lcv-l">On website now</div>
        </div>
        <div className="lcv-kpi lcv-kpi--g">
          <div className="lcv-n">{counts.chatting}</div>
          <div className="lcv-l">Chatting</div>
        </div>
        <div className="lcv-kpi lcv-kpi--o">
          <div className="lcv-n">{counts.waiting}</div>
          <div className="lcv-l">Waiting for agent</div>
        </div>
        <div className="lcv-kpi lcv-kpi--p">
          <div className="lcv-n">{counts.ai}</div>
          <div className="lcv-l">With AI agent</div>
        </div>
      </div>

      <div className="lcv-radar">
        <div className="lcv-ping" />
        <strong>Care radar</strong>
        {stuck ? (
          <>
            <span className="lcv-radar-text">
              <b>{displayName(stuck)}</b>
              {stuck.geo?.city ? ` (${stuck.geo.city}${stuck.geo.countryCode ? `, ${stuck.geo.countryCode}` : ""})` : ""} has
              been on <b>{pageLabel(stuck)}</b> for {Math.floor((serverNow - stuck.page.enteredAt) / 60000)} minutes
              without booking. They may need help.
            </span>
            {actionFor(stuck)}
          </>
        ) : (
          <span className="lcv-radar-text">
            Watching live traffic. Visitors who seem stuck on booking will show up here.
          </span>
        )}
      </div>

      <div className="lcv-filters">
        <label className="lcv-fbtn">
          Activity
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="chatting">Chatting</option>
            <option value="waiting">Waiting for agent</option>
            <option value="invited">Invited</option>
            <option value="browsing">Browsing</option>
          </select>
        </label>
        <label className="lcv-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, IP or city…"
            aria-label="Search visitors"
          />
        </label>
        <span className="lcv-chip">
          🌐 Website is <b>humancareconnect.co</b>
        </span>
        <span className="lcv-chip">🍪 Only visitors who accepted cookies</span>
      </div>

      {startError && (
        <div className="lcv-start-error" role="alert">
          {startError}
        </div>
      )}

      <div className="lcv-count">
        {rows.length} {rows.length === 1 ? "visitor" : "visitors"} on the website
      </div>

      <div className="lcv-table-wrap">
        <table className="lcv-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Activity</th>
              <th>Action</th>
              <th>Assigned to</th>
              <th>Current page</th>
              <th>Time on site</th>
              <th>City</th>
              <th>State / region</th>
              <th>Country</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((visitor) => {
              const activity = ACTIVITY_CLASS[visitor.activity] || visitor.activity;
              return (
                <tr key={visitor.visitorId}>
                  <td>
                    <div className="lcv-who">
                      <span className={`lcv-av${visitor.name ? "" : " lcv-av--anon"}`}>
                        {visitor.name ? initials(visitor.name) : "V"}
                      </span>
                      <span>
                        {displayName(visitor)}
                        <small>
                          {visitor.name ? `IP ${visitor.ip} · ` : ""}
                          {visitor.device}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`lcv-act lcv-act--${activity}`}>
                      <i />
                      {ACTIVITY[visitor.activity] || "Browsing"}
                    </span>
                  </td>
                  <td>
                    <div className="lcv-actions">
                      {actionFor(visitor)}
                      <button type="button" className="lcv-btn lcv-btn--icon" aria-label={`Block IP ${visitor.ip}`} title={`Block IP ${visitor.ip}`} onClick={() => blockVisitor(visitor)}>
                        ⛔
                      </button>
                    </div>
                  </td>
                  <td>{visitor.assignedTo ? visitor.assignedTo : <span className="lcv-muted">–</span>}</td>
                  <td>{pageLabel(visitor)}</td>
                  <td className="lcv-mono">{duration(secondsOnSite(visitor))}</td>
                  <td>{visitor.geo?.city || <span className="lcv-muted">–</span>}</td>
                  <td>{visitor.geo?.state || <span className="lcv-muted">–</span>}</td>
                  <td>
                    {visitor.geo?.country ? (
                      <>
                        {flag(visitor.geo.countryCode)} {visitor.geo.country}
                      </>
                    ) : (
                      <span className="lcv-muted">–</span>
                    )}
                  </td>
                  <td className="lcv-muted">{visitor.source}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="lcv-empty">
                  {status === "off"
                    ? "Live chat is switched off. Set LIVECHAT_ENABLED=true on the server to turn it on."
                    : "No visitors match this filter"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BlockedIpsPanel refreshKey={blockedVersion} />
    </div>
  );
}
