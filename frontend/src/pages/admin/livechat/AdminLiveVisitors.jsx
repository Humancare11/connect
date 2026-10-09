import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getUserAuthToken } from "../../../api";
import "./AdminLiveVisitors.css";

// Live Chat > Real-time visitors. Layout, wording and colours follow docs/chat-demo.html.
// Data comes from the /livechat-admin socket (snapshot on connect, then upsert/remove deltas). Visitors who never
// chat exist in server memory only; nothing on this page is stored.

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
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

function useLiveVisitors() {
  const [visitors, setVisitors] = useState(() => new Map());
  const [status, setStatus] = useState("connecting"); // connecting | live | reconnecting | denied | off
  const [agent, setAgent] = useState({ online: false, displayName: "" });
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/livechat-admin`, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getUserAuthToken("admin") },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("live"));
    socket.on("disconnect", (reason) => setStatus(reason === "io server disconnect" ? "denied" : "reconnecting"));
    socket.on("connect_error", (err) => {
      const message = String(err?.message || "");
      if (message.includes("Invalid namespace")) {
        setStatus("off");
        socket.close();
      } else if (message === "forbidden") {
        setStatus("denied");
        socket.close();
      } else {
        setStatus("reconnecting");
      }
    });
    socket.on("visitors:snapshot", ({ visitors: list = [], serverTime }) => {
      setVisitors(new Map(list.map((visitor) => [visitor.visitorId, visitor])));
      if (serverTime) setClockOffset(serverTime - Date.now());
    });
    socket.on("visitors:delta", (delta) => {
      setVisitors((current) => {
        const next = new Map(current);
        if (delta.type === "remove") next.delete(delta.visitorId);
        else if (delta.visitor) next.set(delta.visitor.visitorId, delta.visitor);
        return next;
      });
    });
    socket.on("agent:status", setAgent);

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const setOnline = (online) => {
    socketRef.current?.emit("agent:status", { online }, (reply) => {
      if (reply?.ok) setAgent({ online: reply.online, displayName: reply.displayName });
    });
  };

  return { visitors, status, agent, clockOffset, setOnline };
}

const STATUS_TEXT = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  denied: "Not authorised for live chat",
  off: "Live chat is switched off on the server",
};

export default function AdminLiveVisitors() {
  const { visitors, status, agent, clockOffset, setOnline } = useLiveVisitors();
  const [activityFilter, setActivityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // One timer drives every "time on site" cell.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const serverNow = now + clockOffset;
  const secondsOnSite = (visitor) => (serverNow - visitor.joinedAt) / 1000;

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
          <button
            type="button"
            className="lcv-toggle"
            role="switch"
            aria-checked={agent.online}
            onClick={() => setOnline(!agent.online)}
            disabled={status !== "live"}
          >
            <span className="lcv-sw" />
            {agent.online ? "You're online" : "You're offline"}
          </button>
        </div>
      </div>

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
            <button type="button" className="lcv-btn lcv-btn--primary" disabled title="Starting a chat arrives in a later phase">
              Start chat
            </button>
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
                    {/* Start chat / View chat / Join are wired up when chats exist (later phases). */}
                    <button type="button" className="lcv-btn lcv-btn--primary" disabled title="Starting a chat arrives in a later phase">
                      Start chat
                    </button>
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
    </div>
  );
}
