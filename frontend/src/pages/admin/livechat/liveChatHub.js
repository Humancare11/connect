import { io } from "socket.io-client";
import api, { getUserAuthToken } from "../../../api";
import { installAudioUnlock, playChime, showBrowserNotification } from "./liveChatNotify";

// One shared connection to /livechat-admin for the whole admin session.
//
// It lives outside React on purpose: each admin page wraps itself in its own AdminLayout, so React may remount
// components while you move between pages, but the connection, the visitor list, the unread counts and the toasts
// must not restart. Pages and the layout "acquire" the hub; when nobody uses it any more (a few seconds after the
// last page unmounts) it disconnects.
//
// Only runs when VITE_LIVECHAT_ENABLED === "true" (build flag), so a disabled module costs admins nothing.
const ENABLED = import.meta.env.VITE_LIVECHAT_ENABLED === "true";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "");

const TOAST_MS = 6000;
const MAX_TOASTS = 3;

let socket = null;
let refs = 0;
let releaseTimer = null;
let unreadTimer = null;
let toastSeq = 0;
let activeConversationId = "";

let snapshot = {
  enabled: ENABLED,
  status: ENABLED ? "connecting" : "off", // connecting | live | reconnecting | denied | off
  visitors: new Map(),
  clockOffset: 0,
  agent: { online: false, displayName: "" },
  unread: { ai: 0, live: 0 },
  toasts: [],
};

const listeners = new Set(); // React subscribers (useSyncExternalStore)
const eventListeners = new Set(); // pages that want the raw chat events

function set(patch) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

const pagePath = (everLive, id) => `/admin-dashboard/live-chat/${everLive ? "agent-chats" : "ai-chats"}/${id}`;

// `notify` is what a browser notification may say (who / what kind of event, never message text).
function pushToast({ title, body, path, notify }) {
  const id = ++toastSeq;
  set({ toasts: [{ id, title, body, path }, ...snapshot.toasts].slice(0, MAX_TOASTS) });
  setTimeout(() => hub.dismissToast(id), TOAST_MS);
  playChime();
  if (notify) showBrowserNotification({ ...notify, path, tag: `lc-${path || title}` });
}

const AI_PROBLEMS = {
  quota: "The AI credits are used up.",
  spend_cap: "The daily AI spend cap was reached.",
};

async function refreshUnread() {
  try {
    const { data } = await api.get("/api/admin/livechat/unread", { authRole: "admin", skipAuthRefresh: false });
    if (data?.ok) set({ unread: { ai: data.ai, live: data.live } });
  } catch {
    /* badges are a convenience: ignore */
  }
}

function scheduleUnread() {
  clearTimeout(unreadTimer);
  unreadTimer = setTimeout(refreshUnread, 400);
}

const preview = (text) => (String(text).length > 60 ? `${String(text).slice(0, 60)}…` : String(text));
const isActive = (id) => id === activeConversationId && typeof document !== "undefined" && document.visibilityState === "visible";

function onChatEvent(event, payload) {
  eventListeners.forEach((listener) => listener(event, payload));

  switch (event) {
    case "chat:new":
      scheduleUnread();
      if (!isActive(payload.conversationId)) {
        pushToast({
          title: "New chat",
          body: payload.mode === "live" ? "A chat was started" : `${payload.name || "A patient"} started a chat with the AI`,
          path: pagePath(payload.everLive, payload.conversationId),
          notify: { title: "New chat", body: `${payload.name || "A patient"} started a chat` },
        });
      }
      break;
    case "queue:new":
      scheduleUnread();
      pushToast({
        title: payload.offline ? "Request while the team is offline" : "Waiting for an agent",
        body: `${payload.name || "A patient"} asked for a live agent`,
        path: pagePath(true, payload.conversationId),
        notify: { title: payload.offline ? "Request while the team is offline" : "Waiting for an agent", body: `${payload.name || "A patient"} asked for a live agent` },
      });
      break;
    case "chat:message":
      if (payload.message?.sender !== "patient") break;
      scheduleUnread();
      // Chats another agent is holding are not my business; the chat I am looking at needs no toast.
      if (isActive(payload.conversationId)) break;
      if (payload.assigneeId && payload.assigneeId !== snapshot.agentId) break;
      pushToast({
        title: payload.name || "Patient",
        body: payload.message.file ? "Sent a file" : preview(payload.message.text),
        path: pagePath(payload.everLive, payload.conversationId),
        notify: { title: "New message", body: `${payload.name || "A patient"} sent a message` },
      });
      break;
    case "chat:updated":
      scheduleUnread();
      break;
    case "chat:taken":
      scheduleUnread();
      pushToast({ title: "Chat taken over", body: `${payload.by} took over one of your chats`, path: pagePath(true, payload.conversationId) });
      break;
    case "ai:unavailable":
      pushToast({
        title: "AI assistant unavailable",
        body: `${AI_PROBLEMS[payload.kind] || "The AI assistant is having problems."} Patients are being sent to live agents.`,
        path: "",
        notify: { title: "AI assistant unavailable", body: "Patients are being sent to live agents." },
      });
      break;
    case "abuse:alert":
      pushToast({
        title: "Possible abuse",
        body:
          payload.reason === "daily_limit"
            ? `IP ${payload.ip} reached the daily chat limit`
            : `${payload.count} chats from ${payload.ip ? `IP ${payload.ip}` : "one visitor"} in the last hour`,
        path: payload.conversationId ? pagePath(true, payload.conversationId) : "",
        notify: { title: "Possible abuse", body: "Unusually many chats from one visitor." },
      });
      break;
    case "chat:reopened":
      scheduleUnread();
      break;
    default:
  }
}

function connect() {
  if (socket || !ENABLED) return;
  installAudioUnlock();
  socket = io(`${SOCKET_URL}/livechat-admin`, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: { token: getUserAuthToken("admin") },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
  });

  socket.on("connect", () => {
    set({ status: "live" });
    refreshUnread();
  });
  socket.on("disconnect", (reason) => set({ status: reason === "io server disconnect" ? "denied" : "reconnecting" }));
  socket.on("connect_error", (err) => {
    const message = String(err?.message || "");
    if (message.includes("Invalid namespace")) {
      set({ status: "off" });
      socket.close();
      socket = null;
    } else if (message === "forbidden") {
      set({ status: "denied" });
      socket.close();
      socket = null;
    } else {
      set({ status: "reconnecting" });
    }
  });
  socket.on("visitors:snapshot", ({ visitors = [], serverTime }) => {
    set({
      visitors: new Map(visitors.map((v) => [v.visitorId, v])),
      clockOffset: serverTime ? serverTime - Date.now() : snapshot.clockOffset,
    });
  });
  socket.on("visitors:delta", (delta) => {
    const next = new Map(snapshot.visitors);
    if (delta.type === "remove") next.delete(delta.visitorId);
    else if (delta.visitor) next.set(delta.visitor.visitorId, delta.visitor);
    set({ visitors: next });
  });
  socket.on("agent:status", (agent) => set({ agent }));
  ["chat:new", "queue:new", "chat:message", "chat:updated", "chat:typing", "chat:taken", "chat:reopened", "ai:unavailable", "abuse:alert"].forEach((event) =>
    socket.on(event, (payload) => onChatEvent(event, payload || {}))
  );
}

function disconnect() {
  clearTimeout(unreadTimer);
  socket?.close();
  socket = null;
  set({ status: ENABLED ? "connecting" : "off", visitors: new Map(), toasts: [] });
}

export const hub = {
  enabled: ENABLED,

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,

  // Raw chat events (chat:message, chat:updated, chat:typing, ...) for pages that show a conversation.
  on(listener) {
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  },

  // Ref-counted use. `userId` lets toasts ignore chats another agent holds.
  acquire(userId) {
    refs += 1;
    clearTimeout(releaseTimer);
    if (userId && snapshot.agentId !== userId) set({ agentId: userId });
    connect();
    return () => {
      refs -= 1;
      if (refs <= 0) releaseTimer = setTimeout(() => refs <= 0 && disconnect(), 3000);
    };
  },

  emit(event, payload) {
    socket?.emit(event, payload);
  },

  setOnline(online) {
    socket?.emit("agent:status", { online }, (reply) => {
      if (reply?.ok) set({ agent: { online: reply.online, displayName: reply.displayName } });
    });
  },

  // The chat open on screen: no toast for it.
  setActiveConversation(id) {
    activeConversationId = id || "";
  },

  refreshUnread,
  dismissToast(id) {
    set({ toasts: snapshot.toasts.filter((t) => t.id !== id) });
  },
};

// Why the chat was handed to a person (older chats may carry the previous names).
const HANDOFF_LABELS = {
  explicit_request: "Asked for a person",
  patient_request: "Asked for a person",
  account_issue: "Account issue",
  account_or_payment: "Account issue",
  technical_issue: "Technical issue",
  emergency: "Emergency",
  complaint: "Complaint",
  unanswered: "AI couldn't answer",
  unsure: "AI couldn't answer",
  ai_unavailable: "AI unavailable",
  ai_off: "AI off",
  ai_limit: "AI reply limit",
};
export const handoffLabel = (reason) => HANDOFF_LABELS[reason] || "";
