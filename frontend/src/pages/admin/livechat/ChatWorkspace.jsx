import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../api";
import { useAdmin } from "../../../context/AdminContext";
import ChatList from "./ChatList";
import ChatConversation from "./ChatConversation";
import PatientPanel from "./PatientPanel";
import { hub } from "./liveChatHub";
import { useLiveChatAdmin } from "./useLiveChatAdmin";
import NotificationsBanner from "./NotificationsBanner";
import "./ChatWorkspace.css";

// AI chats and Live agent chats: chat list | conversation | patient panel (docs/chat-demo.html).
// Data comes from REST (lists, detail, actions); live updates arrive as chat events on the shared admin socket.
const BASE = "/api/admin/livechat";
const PAGE = { ai: "ai-chats", live: "agent-chats" };

const MESSAGES = {
  assigned: (e) => `${e.assignee?.name || "Another agent"} already has this chat.`,
  not_assignee: (e) => `${e.assignee?.name || "Another agent"} is handling this chat. You can add internal notes.`,
  closed: () => "This chat has already ended.",
  not_live: () => "This chat is not with an agent.",
  empty_message: () => "Type a message first.",
  message_too_long: () => "Messages can be up to 2,000 characters.",
  rate_limited: () => "Too many requests. Wait a moment and try again.",
  ai_unavailable: () => "The AI assistant is unavailable right now.",
};
const errorText = (err) => {
  const data = err?.response?.data || {};
  return (MESSAGES[data.error] || (() => "Something went wrong. Please try again."))(data);
};

export default function ChatWorkspace({ view }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { admin } = useAdmin();
  const me = String(admin?._id || admin?.id || "");
  const { status, clockOffset } = useLiveChatAdmin();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [canned, setCanned] = useState({ agentName: "", replies: [] });
  const [typing, setTyping] = useState(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  const activeId = conversationId || "";
  const activeRef = useRef(activeId);
  const viewRef = useRef(view);
  const clockRef = useRef(clockOffset);
  useEffect(() => {
    activeRef.current = activeId;
    viewRef.current = view;
    clockRef.current = clockOffset;
  });

  // One timer drives every ticking time in the panel.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const go = useCallback((id, replace = false) => navigate(`/admin-dashboard/live-chat/${PAGE[viewRef.current]}${id ? `/${id}` : ""}`, { replace }), [navigate]);

  // ── Data ──────────────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get(`${BASE}/conversations`, { params: { view } });
      setRows(data.conversations || []);
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
    }
  }, [view]);

  const listTimer = useRef(null);
  const reloadListSoon = useCallback(() => {
    clearTimeout(listTimer.current);
    listTimer.current = setTimeout(loadList, 300);
  }, [loadList]);

  const loadDetail = useCallback(
    async (id) => {
      try {
        const { data } = await api.get(`${BASE}/conversations/${id}`);
        if (id !== activeRef.current) return; // the admin moved on
        // A chat that belongs to the other page (e.g. a visitor's "View chat" link): open it there.
        const belongs = data.conversation.everLive ? "live" : "ai";
        if (belongs !== viewRef.current) {
          navigate(`/admin-dashboard/live-chat/${PAGE[belongs]}/${id}`, { replace: true });
          return;
        }
        setDetail({ ...data, fetchedAt: Date.now() + clockRef.current });
        setDetailError("");
        setRows((current) => current.map((r) => (r.conversationId === id ? { ...r, unread: 0 } : r)));
        hub.refreshUnread();
      } catch (err) {
        if (id === activeRef.current) {
          setDetail(null);
          setDetailError(err?.response?.status === 404 ? "This chat no longer exists." : "Could not load this chat.");
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    setRows([]);
    setLoading(true);
    loadList();
  }, [loadList]);

  useEffect(() => {
    api
      .get(`${BASE}/canned-replies`)
      .then(({ data }) => setCanned({ agentName: data.agentName || "", replies: data.replies || [] }))
      .catch(() => {});
  }, []);

  // Nothing selected yet: open the first chat.
  useEffect(() => {
    if (!activeId && rows.length) go(rows[0].conversationId, true);
  }, [activeId, rows, go]);

  useEffect(() => {
    hub.setActiveConversation(activeId);
    setActionError("");
    setDetail(null);
    setDetailError("");
    if (activeId) loadDetail(activeId);
    return () => hub.setActiveConversation("");
  }, [activeId, loadDetail]);

  // ── Live updates ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let readTimer;
    const off = hub.on((event, p) => {
      if (event === "chat:new" || event === "queue:new" || event === "chat:reopened") {
        reloadListSoon();
      } else if (event === "chat:updated") {
        const belongs = p.row?.everLive ? "live" : "ai";
        if (p.row && belongs === viewRef.current) {
          setRows((current) => {
            const without = current.filter((r) => r.conversationId !== p.conversationId);
            const previous = current.find((r) => r.conversationId === p.conversationId);
            return [{ ...p.row, unread: previous?.unread || 0, preview: previous?.preview || p.row.preview }, ...without].sort(
              (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
            );
          });
        } else {
          setRows((current) => current.filter((r) => r.conversationId !== p.conversationId));
        }
        if (p.conversationId === activeRef.current) loadDetail(p.conversationId);
      } else if (event === "chat:message") {
        const m = p.message;
        const current = p.conversationId === activeRef.current;
        if (current) {
          setDetail((d) =>
            d && !d.messages.some((x) => x.id === m.id) ? { ...d, messages: [...d.messages, m] } : d
          );
          if (m.sender === "patient") {
            clearTimeout(readTimer);
            readTimer = setTimeout(() => api.post(`${BASE}/conversations/${p.conversationId}/read`).then(hub.refreshUnread).catch(() => {}), 500);
          }
        }
        if (m.sender !== "note" && !m.internal) {
          setRows((rowsNow) =>
            rowsNow.map((r) =>
              r.conversationId === p.conversationId
                ? {
                    ...r,
                    lastMessageAt: m.at,
                    preview: ["patient", "ai", "agent"].includes(m.sender) ? { sender: m.sender, text: String(m.text).slice(0, 120), at: m.at } : r.preview,
                    unread: m.sender === "patient" && !current ? r.unread + 1 : r.unread,
                  }
                : r
            )
          );
        }
      } else if (event === "chat:typing") {
        setTyping((set) => {
          const next = new Set(set);
          if (p.typing) next.add(p.visitorId);
          else next.delete(p.visitorId);
          return next;
        });
        if (p.typing) {
          // the patient stopped if we hear nothing for a few seconds
          setTimeout(() => setTyping((set) => (set.has(p.visitorId) ? new Set([...set].filter((v) => v !== p.visitorId)) : set)), 4000);
        }
      }
    });
    return () => {
      off();
      clearTimeout(readTimer);
      clearTimeout(listTimer.current);
    };
  }, [loadDetail, reloadListSoon]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  // Runs a request; shows the server's reason on failure (e.g. someone else already took the chat) and refreshes.
  const act = useCallback(
    async (request) => {
      setBusy(true);
      setActionError("");
      try {
        const { data } = await request();
        return { ok: true, data };
      } catch (err) {
        setActionError(errorText(err));
        loadDetail(activeRef.current);
        reloadListSoon();
        return { ok: false, error: err };
      } finally {
        setBusy(false);
      }
    },
    [loadDetail, reloadListSoon]
  );

  const id = detail?.conversation.conversationId;
  const post = (path, body) => () => api.post(`${BASE}/conversations/${id}/${path}`, body);

  const handlers = {
    takeover: async () => {
      const r = await act(post("takeover"));
      if (r.ok) loadDetail(id);
      return r.ok;
    },
    handback: async () => {
      const r = await act(post("handback"));
      if (r.ok) loadDetail(id);
    },
    resolve: async () => {
      const r = await act(post("resolve"));
      if (r.ok) loadDetail(id);
    },
    send: async (text) => {
      const r = await act(post("messages", { text }));
      if (r.ok) {
        const m = r.data.message;
        setDetail((d) => (d && !d.messages.some((x) => x.id === m.id) ? { ...d, messages: [...d.messages, m] } : d));
        loadDetail(id); // the chat may have moved to Live agent chats
      }
      return r.ok;
    },
    note: async (text) => {
      const r = await act(post("notes", { text }));
      if (r.ok) {
        const m = r.data.message;
        setDetail((d) => (d && !d.messages.some((x) => x.id === m.id) ? { ...d, messages: [...d.messages, m] } : d));
      }
      return r.ok;
    },
    // A patient's file opens through a short-lived link made by the server after a role check. The tab is opened on
    // the click itself (browsers block pop-ups opened after a wait) and pointed at the link once the server answers;
    // its opener is cleared so the file page can never reach this admin page.
    openFile: async (file) => {
      const tab = window.open("", "_blank");
      if (tab) tab.opener = null;
      try {
        const { data } = await api.get(`${BASE}/files/${file.id}/url`);
        if (tab) tab.location.href = data.url;
        else setActionError("Your browser blocked the new tab. Allow pop-ups for this site to open files.");
      } catch (err) {
        tab?.close();
        setActionError(err?.response?.status === 502 ? "The file storage is not reachable right now. Try again in a moment." : "Could not open that file.");
      }
    },
    blockIp: async () => {
      const ip = detail?.conversation.ip;
      if (!ip || !window.confirm(`Block IP ${ip}? Its chats are closed and it cannot connect again until you unblock it (Real-time visitors > Blocked IPs).`)) return;
      const r = await act(post("block-ip", { reason: "Blocked from a chat" }));
      if (r.ok) {
        loadDetail(id);
        reloadListSoon();
      }
    },
    suggest: async () => {
      const r = await act(post("suggest"));
      return r.ok ? r.data.reply : "";
    },
    saveContact: async (values) => {
      try {
        await api.put(`${BASE}/conversations/${id}/contact`, values);
        loadDetail(id);
        return { ok: true };
      } catch (err) {
        return { ok: false, errors: err?.response?.data?.errors || { form: errorText(err) } };
      }
    },
    saveTags: async (tags) => {
      try {
        await api.put(`${BASE}/conversations/${id}/tags`, { tags });
        loadDetail(id);
      } catch (err) {
        setActionError(errorText(err));
      }
    },
  };

  // "typing…" towards the patient, at most every 2 seconds (the patient widget hides it after a moment).
  const lastTyping = useRef(0);
  const onTyping = () => {
    if (Date.now() - lastTyping.current < 2000 || !id) return;
    lastTyping.current = Date.now();
    hub.emit("chat:typing", { conversationId: id, typing: true });
  };

  const serverNow = now + clockOffset;
  const typingActive = useMemo(() => Boolean(detail && typing.has(detail.conversation.visitorId)), [detail, typing]);

  if (status === "off") {
    return (
      <div className="wk-off">
        <b>Live chat is switched off.</b> Set <code>LIVECHAT_ENABLED=true</code> on the server and <code>VITE_LIVECHAT_ENABLED=true</code> in the
        frontend build to turn it on.
      </div>
    );
  }

  return (
    <div className="wk-wrap-page">
      <NotificationsBanner />
      <div className="wk-inbox">
        <ChatList view={view} rows={rows} me={me} activeId={activeId} typing={typing} query={query} onQuery={setQuery} onSelect={(cid) => go(cid)} loading={loading} />
        {detail ? (
          <ChatConversation
            key={detail.conversation.conversationId}
            detail={detail}
            me={me}
            role={admin?.role}
            typing={typingActive}
            canned={canned}
            busy={busy}
            error={actionError}
            onTakeOver={handlers.takeover}
            onHandBack={handlers.handback}
            onResolve={handlers.resolve}
            onSend={handlers.send}
            onNote={handlers.note}
            onSuggest={handlers.suggest}
            onTyping={onTyping}
            onOpenFile={handlers.openFile}
            onBlockIp={handlers.blockIp}
          />
        ) : (
          <div className="wk-chat">
            <div className="wk-empty">{detailError || (activeId ? "Loading…" : rows.length || loading ? "Pick a chat on the left" : "No chats yet")}</div>
          </div>
        )}
        {detail && <PatientPanel detail={detail} now={serverNow} onSaveContact={handlers.saveContact} onSaveTags={handlers.saveTags} />}
      </div>
    </div>
  );
}
