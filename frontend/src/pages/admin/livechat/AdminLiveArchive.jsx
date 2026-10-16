import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import ChatConversation from "./ChatConversation";
import ChatDetailsPanel from "./ChatDetailsPanel";
import DeleteChatsDialog from "./DeleteChatsDialog";
import Icon from "./lcIcons";
import { CLOSED_LABEL, timeOf } from "./chatUtils";

// Live Chat > Archive: every archived chat (AI and Live agent), any age until retention deletes it. Filters: archived
// date range (with presets), type and reason; search by patient name, email, phone, IP, city or chat ID. A row opens
// the chat read-only, with the transcript download.
const BASE = "/api/admin/livechat";
const ARCHIVE = "/admin-dashboard/live-chat/archive";
const ZONE = "America/New_York"; // the same day boundaries as Reports
const STORE_KEY = "hcLiveChatArchiveFilters";
const REASONS = [
  ["all", "All reasons"],
  ["inactive", "Inactive"],
  ["patient_left", "Left"],
  ["resolved", "Resolved"],
  ["blocked", "Blocked"],
];
const TYPES = [
  ["all", "AI and Live agent"],
  ["ai", "AI"],
  ["live", "Live agent"],
];
const REASON_LABEL = { ...CLOSED_LABEL, resolved: "Resolved" };

const dayOf = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const presetRange = (preset) => {
  const today = dayOf(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "7") return { from: addDays(today, -6), to: today };
  return { from: addDays(today, -29), to: today };
};
const defaults = () => ({ preset: "30", ...presetRange("30"), type: "all", reason: "all", q: "", page: 1 });
const readFilters = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved === "object") return { ...defaults(), ...saved };
  } catch {
    /* remembering the filters is optional */
  }
  return defaults();
};
const dateTime = (iso) =>
  iso
    ? `${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${timeOf(iso)}`
    : "–";

const ERRORS = { invalid_range: "That date range is not valid.", server_error: "Could not load the archive." };
const DELETE_ERRORS = {
  confirm_required: "Type DELETE to confirm.",
  rate_limited: "Too many delete requests. Wait a minute and try again.",
  search_too_broad: "This search covers too many chats to delete safely. Narrow the date range and try again.",
  nothing_selected: "No chats match.",
  server_error: "Something went wrong. Nothing was deleted.",
};
const CONFIRM_ABOVE = 50; // more than this many chats: DELETE must be typed (the server checks too)

// A chat opened from the list: the normal conversation view and patient panel, with every action that changes the
// chat removed. Looking does not mark the chat read.
function ArchiveViewer({ id }) {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const me = String(admin?._id || admin?.id || "");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .get(`${BASE}/conversations/${id}`, { params: { archive: 1 } })
      .then(({ data }) => live && setDetail({ ...data, fetchedAt: Date.now() }))
      .catch((err) => live && setError(err?.response?.status === 404 ? "This chat no longer exists." : "Could not load this chat."));
    return () => {
      live = false;
    };
  }, [id]);

  const handlers = {
    // Super Admin only (the menu item is hidden for everyone else; the server answers 403 anyway).
    remove: async () => {
      try {
        await api.post(`${BASE}/archive/delete`, { ids: [id] });
        navigate(ARCHIVE, { replace: true });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: DELETE_ERRORS[err?.response?.data?.error] || DELETE_ERRORS.server_error };
      }
    },
    translate: async (messageIds) => {
      try {
        const { data } = await api.post(`${BASE}/conversations/${id}/translate`, { messageIds });
        return { ok: true, data };
      } catch (err) {
        return { ok: false, status: err?.response?.status };
      }
    },
    setView: (view) => api.put(`${BASE}/conversations/${id}/view`, { view }).catch(() => {}),
    openFile: async (file) => {
      const tab = window.open("", "_blank");
      if (tab) tab.opener = null;
      try {
        const { data } = await api.get(`${BASE}/files/${file.id}/url`);
        if (tab) tab.location.href = data.url;
        else setActionError("Your browser blocked the new tab. Allow pop-ups for this site to open files.");
      } catch {
        tab?.close();
        setActionError("Could not open that file.");
      }
    },
    download: async () => {
      try {
        const { data } = await api.get(`${BASE}/conversations/${id}/transcript`, { responseType: "blob" });
        const url = URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `chat-${id}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setActionError("Could not download the transcript.");
      }
    },
  };
  const none = async () => false;

  return (
    <div className="ar-viewer wk-wrap-page">
      <div className="ar-back">
        <Link to={ARCHIVE} className="wk-btn">
          <Icon name="back" size={15} /> Back to Archive
        </Link>
        <span className="wk-small wk-muted">Read-only</span>
      </div>
      <div className="wk-inbox ar-two">
        {detail ? (
          <ChatConversation
            key={detail.conversation.conversationId}
            readOnly
            detail={detail}
            me={me}
            role={admin?.role}
            typing={false}
            canned={{ agentName: "", replies: [] }}
            busy={false}
            error={actionError}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((open) => !open)}
            onTakeOver={none}
            onHandBack={none}
            onResolve={none}
            onSend={none}
            onNote={none}
            onSuggest={none}
            onTyping={() => {}}
            onBlockIp={() => {}}
            onSendFile={none}
            onTranslateReply={none}
            onTranslate={handlers.translate}
            onSetView={handlers.setView}
            onOpenFile={handlers.openFile}
            onDownload={handlers.download}
            onDelete={handlers.remove}
          />
        ) : (
          <div className="wk-chat">
            <div className="wk-empty">{error || "Loading…"}</div>
          </div>
        )}
        {detail && panelOpen ? <ChatDetailsPanel readOnly detail={detail} now={detail.fetchedAt} onSaveContact={none} onSaveTags={none} /> : <aside className="wk-profile" data-lenis-prevent />}
      </div>
    </div>
  );
}

export default function AdminLiveArchive() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  if (conversationId) return <ArchiveViewer key={conversationId} id={conversationId} />; // one fresh viewer per chat
  return <ArchiveList navigate={navigate} />;
}

function ArchiveList({ navigate }) {
  const { admin } = useAdmin();
  const isSuper = admin?.role === "superadmin"; // delete controls exist only for a Super Admin
  const [filters, setFilters] = useState(readFilters);
  const [selected, setSelected] = useState(() => new Set());
  const [reloadTick, setReloadTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null); // { mode: "selected" | "matching", count, error, busy }
  const [draft, setDraft] = useState(filters.q);
  // The answer to one set of filters: `key` says which, so "loading" is simply "the answer is not for these filters".
  const [answer, setAnswer] = useState({ key: "", result: null, error: "" });

  const update = useCallback((patch) => setFilters((f) => ({ ...f, page: 1, ...patch })), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(filters));
    } catch {
      /* optional */
    }
  }, [filters]);

  // The search box applies a moment after the admin stops typing.
  useEffect(() => {
    if (draft.trim() === filters.q) return undefined;
    const timer = window.setTimeout(() => update({ q: draft.trim() }), 400);
    return () => window.clearTimeout(timer);
  }, [draft, filters.q, update]);

  const params = useMemo(() => {
    const p = { page: filters.page, type: filters.type, reason: filters.reason };
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    if (filters.q) p.q = filters.q;
    return p;
  }, [filters]);
  const key = JSON.stringify(params);

  // A selection belongs to the list it was made on.
  useEffect(() => {
    setSelected(new Set());
  }, [key]);

  useEffect(() => {
    let current = true; // a slower, older request never replaces a newer answer
    api
      .get(`${BASE}/archive`, { params })
      .then(({ data }) => current && setAnswer({ key, result: data, error: "" }))
      .catch((err) => current && setAnswer((a) => ({ key, result: a.result, error: ERRORS[err?.response?.data?.error] || ERRORS.server_error })));
    return () => {
      current = false;
    };
  }, [key, params, reloadTick]);

  const { result, error } = answer;
  const loading = answer.key !== key;

  const pickPreset = (preset) => update({ preset, ...presetRange(preset) });
  const rows = result?.rows || [];
  const open = (id) => navigate(`${ARCHIVE}/${id}`);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.conversationId));
  const toggleRow = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      rows.forEach((r) => (allOnPage ? next.delete(r.conversationId) : next.add(r.conversationId)));
      return next;
    });
  const filterBody = () => {
    const f = { type: filters.type, reason: filters.reason };
    if (filters.from) f.from = filters.from;
    if (filters.to) f.to = filters.to;
    if (filters.q) f.q = filters.q;
    return f;
  };
  const startDeleteSelected = () => {
    setNotice("");
    setDialog({ mode: "selected", count: selected.size, error: "", busy: false });
  };
  const startDeleteMatching = async () => {
    setNotice("");
    setDialog({ mode: "matching", count: null, error: "", busy: false });
    try {
      const { data } = await api.post(`${BASE}/archive/delete-preview`, { filters: filterBody() });
      setDialog((d) => d && { ...d, count: data.count, error: data.capped ? DELETE_ERRORS.search_too_broad : "" });
    } catch (err) {
      setDialog((d) => d && { ...d, count: 0, error: DELETE_ERRORS[err?.response?.data?.error] || DELETE_ERRORS.server_error });
    }
  };
  const confirmDelete = async (typed) => {
    setDialog((d) => ({ ...d, busy: true, error: "" }));
    try {
      const body = dialog.mode === "matching" ? { matching: true, filters: filterBody() } : { ids: [...selected] };
      const { data } = await api.post(`${BASE}/archive/delete`, { ...body, ...(typed ? { confirm: typed } : {}) });
      setNotice(
        `${data.deleted} chat${data.deleted === 1 ? "" : "s"} moved to Trash.` +
          (data.refused ? ` ${data.refused} could not be deleted because they are no longer archived.` : "")
      );
      setDialog(null);
      setSelected(new Set());
      setReloadTick((n) => n + 1);
    } catch (err) {
      setDialog((d) => d && { ...d, busy: false, error: DELETE_ERRORS[err?.response?.data?.error] || DELETE_ERRORS.server_error });
    }
  };

  return (
    <div className="ar">
      <div className="ar-head">
        <div>
          <h1>Archive</h1>
          <p className="wk-muted">Every archived chat, AI and Live agent, until retention deletes it. Click a chat to read it.</p>
        </div>
      </div>

      <div className="ar-filters">
        <div className="ar-presets" role="group" aria-label="Date range presets">
          {[
            ["today", "Today"],
            ["7", "Last 7 days"],
            ["30", "Last 30 days"],
          ].map(([key, label]) => (
            <button key={key} type="button" className="ar-chip" aria-pressed={filters.preset === key} onClick={() => pickPreset(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="ar-field">
          <span>From</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ preset: "", from: e.target.value })} />
        </label>
        <label className="ar-field">
          <span>To</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ preset: "", to: e.target.value })} />
        </label>
        <label className="ar-field">
          <span>Type</span>
          <select value={filters.type} onChange={(e) => update({ type: e.target.value })}>
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="ar-field">
          <span>Reason</span>
          <select value={filters.reason} onChange={(e) => update({ reason: e.target.value })}>
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="ar-field ar-search">
          <span>Search</span>
          <span className="ar-searchbox">
            <Icon name="search" size={15} />
            <input
              type="search"
              value={draft}
              maxLength={100}
              placeholder="Name, email, phone, IP, city or chat ID"
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Search the archive"
            />
          </span>
        </label>
        {(filters.from || filters.to) && (
          <button type="button" className="ar-link" onClick={() => update({ preset: "", from: "", to: "" })}>
            All dates
          </button>
        )}
      </div>

      {isSuper && (
        <div className="ar-bulk">
          <button type="button" className="wk-btn dc-danger" disabled={!selected.size} onClick={startDeleteSelected}>
            Delete selected{selected.size ? ` (${selected.size})` : ""}
          </button>
          <button type="button" className="wk-btn dc-danger-ghost" disabled={!result?.total || loading} onClick={startDeleteMatching}>
            Delete all matching filters{result?.total ? ` (${result.total})` : ""}
          </button>
        </div>
      )}
      {notice && (
        <div className="ar-note" role="status">
          {notice}
        </div>
      )}

      {result?.appliedRange && (
        <div className="ar-note" role="status">
          Partial name, email and phone search looked at {result.appliedRange.from} to {result.appliedRange.to}. Choose a date range to look further back.
        </div>
      )}
      {result?.capped && (
        <div className="ar-note" role="status">
          This search covers a lot of chats, so only the newest 5,000 were checked. Narrow the date range to be sure nothing is missed.
        </div>
      )}
      {error && (
        <div className="wk-error" role="alert">
          {error}
        </div>
      )}

      <div className="ar-tablewrap" data-lenis-prevent>
        <table className="ar-table">
          <thead>
            <tr>
              {isSuper && (
                <th className="ar-check">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select all chats on this page" />
                </th>
              )}
              <th>Patient</th>
              <th>Email</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Assignee</th>
              <th>Started</th>
              <th>Archived</th>
              <th className="ar-num">Messages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.conversationId}
                tabIndex={0}
                onClick={() => open(row.conversationId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(row.conversationId);
                  }
                }}
              >
                {isSuper && (
                  <td className="ar-check" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.conversationId)} onChange={() => toggleRow(row.conversationId)} aria-label={`Select chat ${row.conversationId}`} />
                  </td>
                )}
                <td>
                  <b>{row.name || "Visitor"}</b>
                  <small className="wk-mono wk-muted">{row.conversationId}</small>
                </td>
                <td>{row.email || "–"}</td>
                <td>
                  <span className={`wk-tag ${row.type === "live" ? "wk-tag--human" : "wk-tag--ai"}`}>{row.type === "live" ? "Live agent" : "AI"}</span>
                </td>
                <td>
                  <span className="wk-tag wk-tag--done">{REASON_LABEL[row.reason] || "Resolved"}</span>
                </td>
                <td>{row.assignee || "–"}</td>
                <td>{dateTime(row.startedAt)}</td>
                <td>{dateTime(row.closedAt)}</td>
                <td className="ar-num">{row.messages}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr className="ar-empty">
                <td colSpan={isSuper ? 9 : 8}>{loading ? "Loading…" : "No archived chats match these filters."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ar-pager">
        <span className="wk-small wk-muted">
          {result ? `${result.total} chat${result.total === 1 ? "" : "s"} · page ${result.page} of ${result.pages}` : ""}
        </span>
        <div>
          <button type="button" className="wk-btn" disabled={loading || filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
            Previous
          </button>
          <button type="button" className="wk-btn" disabled={loading || !result || filters.page >= result.pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
            Next
          </button>
        </div>
      </div>

      {dialog && (
        <DeleteChatsDialog
          title={dialog.mode === "matching" ? "Delete all matching chats" : "Delete selected chats"}
          count={dialog.count}
          countLabel="will be moved to Trash"
          description="They disappear from the lists, Archive and reports, and patients cannot reopen them. You can restore them from Trash for 30 days, then they are removed for good."
          confirmLabel="Move to Trash"
          requireTyping={dialog.mode === "matching" || (dialog.count || 0) > CONFIRM_ABOVE}
          busy={dialog.busy}
          error={dialog.error}
          onConfirm={confirmDelete}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
