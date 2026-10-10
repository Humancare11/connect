import { useEffect, useState } from "react";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import { hub } from "./liveChatHub";
import NotificationsBanner from "./NotificationsBanner";
import "./LiveChatPages.css";

// Live Chat > Team: every admin and superadmin with their role, the name patients see (editable), status, open
// chats, chats today and average first reply, plus the AI agent row. Layout follows docs/chat-demo.html.
const BASE = "/api/admin/livechat";

const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return "–";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function NameCell({ agent, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(agent.displayName);
  const [error, setError] = useState("");
  if (!editing) {
    return (
      <span className="lcp-name-edit">
        {agent.displayName}
        {canEdit && (
          <button type="button" className="lcp-btn lcp-btn--small" onClick={() => setEditing(true)} aria-label={`Edit the name patients see for ${agent.name}`}>
            Edit
          </button>
        )}
      </span>
    );
  }
  return (
    <form
      className="lcp-name-edit"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await onSave(agent.userId, value);
        if (result.ok) setEditing(false);
        else setError(result.error);
      }}
    >
      <input value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} aria-label="Name patients see" autoFocus />
      <button type="submit" className="lcp-btn lcp-btn--primary lcp-btn--small">
        Save
      </button>
      <button type="button" className="lcp-btn lcp-btn--small" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && <span className="lcp-field-error">{error}</span>}
    </form>
  );
}

export default function AdminLiveTeam() {
  const { admin } = useAdmin();
  const me = String(admin?._id || admin?.id || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => hub.acquire(me), [me]);

  // Load now, then every 30 seconds and whenever a chat changes hands.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`${BASE}/team`)
      .then(({ data: body }) => {
        if (!cancelled) {
          setData(body);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the team.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    const timer = window.setInterval(() => setVersion((v) => v + 1), 30_000);
    const off = hub.on((event) => {
      if (event === "chat:updated" || event === "queue:new" || event === "agent:status") setVersion((v) => v + 1);
    });
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, []);

  const saveName = async (userId, displayName) => {
    try {
      await api.put(`${BASE}/team/${userId}/display-name`, { displayName });
      setVersion((v) => v + 1);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.response?.data?.errors?.displayName || "Could not save the name." };
    }
  };

  const rows = data?.agents || [];
  const ai = data?.ai;
  // Offline agents say why: switch off, admin panel closed, or the switch is on but it is outside support hours.
  const statusText = (status, row) => {
    if (status === "online") return "Online";
    if (row?.reason === "outside_hours") return `Switch on · Outside hours${row.hours ? ` (${row.hours})` : ""}`;
    if (row?.reason === "no_connection") return "Offline · Admin panel not open";
    if (row?.reason === "switch_off") return "Offline · Switch off";
    return "Offline";
  };
  const statusCell = (status, row) => (
    <span className={`lcp-status lcp-status--${status}`}>
      <i />
      {statusText(status, row)}
    </span>
  );

  return (
    <div className="lcp">
      <div className="lcp-title">
        <div>
          <div className="lcp-eyebrow">Humancare Admin · Live Chat</div>
          <h2>Team</h2>
        </div>
      </div>
      <NotificationsBanner />
      {error && <div className="lcp-error">{error}</div>}
      <div className="lcp-table-wrap">
        <table className="lcp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Name patients see</th>
              <th>Status</th>
              <th>Open chats</th>
              <th>Chats today</th>
              <th>Avg first reply</th>
            </tr>
          </thead>
          <tbody>
            {ai && (
              <tr>
                <td>
                  <div className="lcp-who">
                    <span className="lcp-av lcp-av--ai">AI</span>
                    {ai.name}
                  </div>
                </td>
                <td className="lcp-muted">{ai.role}</td>
                <td>{ai.displayName}</td>
                <td>{statusCell(ai.status)}</td>
                <td className="lcp-mono">{ai.openChats}</td>
                <td className="lcp-mono">{ai.chatsToday}</td>
                <td className="lcp-mono">{formatSeconds(ai.avgFirstReplySeconds)}</td>
              </tr>
            )}
            {rows.map((agent) => (
              <tr key={agent.userId}>
                <td>
                  <div className="lcp-who">
                    <span className="lcp-av">{initials(agent.name)}</span>
                    {agent.name}
                    {agent.userId === me ? <span className="lcp-muted"> (you)</span> : null}
                  </div>
                </td>
                <td className="lcp-muted">{agent.role}</td>
                <td>
                  <NameCell agent={agent} canEdit={agent.userId === me || admin?.role === "superadmin"} onSave={saveName} />
                </td>
                <td>{statusCell(agent.status, agent)}</td>
                <td className="lcp-mono">{agent.openChats}</td>
                <td className="lcp-mono">{agent.chatsToday}</td>
                <td className="lcp-mono">{formatSeconds(agent.avgFirstReplySeconds)}</td>
              </tr>
            ))}
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="lcp-muted" style={{ textAlign: "center", padding: 24 }}>
                  No agents yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="lcp-note">
        An agent is Online when their switch is on, they have the admin panel open and it is within support hours (unless the team is set to ignore hours). "Chats today" counts the chats an agent took today
        ({data?.timeZone || "support time zone"}). "Avg first reply" is the time from a chat entering the Queue to the agent's first message.
        A new name applies the next time that agent takes a chat. You can change your own name; a Super Admin can change anyone's.
      </p>
    </div>
  );
}
