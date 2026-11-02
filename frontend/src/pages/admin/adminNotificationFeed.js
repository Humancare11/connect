import { alertLabel } from "./directCallAlertLabels.js";
import { notificationLink } from "./adminNotificationLinks.js";

// Combined feed behind the admin bell. Two independent sources, kept separate on the
// server and merged only for display:
//   general: AdminNotification  (/api/admin/notifications, per-admin read state)
//   direct:  DirectCallAlert    (/api/direct-video-room/alerts, one global read state)
// They are disjoint systems (no producer writes to both), so the unread total is a plain
// sum and no event is counted twice. Plain JS with no React so it can be tested in Node.

export const POLL_MS = 30_000;
export const LIST_LIMIT = 20;
const MAX_ITEMS = 30;
const GENERAL = "/api/admin/notifications";
const DIRECT = "/api/direct-video-room/alerts";

export function timeAgo(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (!(min >= 1)) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function normalizeGeneral(n) {
  return {
    key: `n:${n.id}`,
    source: "general",
    id: n.id,
    title: n.title || "Notification",
    message: n.message || "",
    createdAt: n.createdAt,
    read: !!n.read,
    link: notificationLink(n),
    linkLabel: "View",
  };
}

export function normalizeDirect(a) {
  return {
    key: `d:${a._id}`,
    source: "direct",
    id: a._id,
    title: alertLabel(a.type),
    message: `${a.message || ""}${a.doctorName ? ` — Dr. ${a.doctorName}` : ""}`,
    createdAt: a.createdAt,
    read: !!a.readAt,
    link: a.roomId ? `/admin-dashboard/direct-video-consultation/calls/${encodeURIComponent(a.roomId)}` : null,
    linkLabel: "View call →",
  };
}

const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const unreadTotal = (state) => state.generalUnread + state.directUnread;

export function createAdminNotificationFeed({
  api,
  pollMs = POLL_MS,
  setIntervalFn = (...a) => setInterval(...a),
  clearIntervalFn = (...a) => clearInterval(...a),
} = {}) {
  let state = {
    generalUnread: 0,
    directUnread: 0,
    items: [],
    // idle | loading | ready | error (both sources failed)
    status: "idle",
    partial: false, // one source failed but the other loaded
    markError: "",
  };
  const listeners = new Set();
  let timer = null;
  let active = false;
  let panelOpen = false;
  let countSeq = 0; // newest count request / local change; older responses are dropped
  let listSeq = 0;
  let countsInFlight = false;

  const patch = (next) => {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  };

  async function refreshCounts({ force = false } = {}) {
    if (!active || (countsInFlight && !force)) return;
    const seq = ++countSeq;
    countsInFlight = true;
    const [g, d] = await Promise.allSettled([api.get(`${GENERAL}/unread-count`), api.get(`${DIRECT}/unread-count`)]);
    if (seq === countSeq) countsInFlight = false;
    if (!active || seq !== countSeq) return;
    const next = {};
    // A failed source keeps its last known count rather than dropping to zero.
    if (g.status === "fulfilled") next.generalUnread = Number(g.value.data?.count) || 0;
    if (d.status === "fulfilled") next.directUnread = Number(d.value.data?.count) || 0;
    patch(next);
  }

  async function loadItems({ silent = false } = {}) {
    if (!active) return;
    const seq = ++listSeq;
    if (!silent) patch({ status: "loading", markError: "" });
    const [g, d] = await Promise.allSettled([
      api.get(`${GENERAL}?limit=${LIST_LIMIT}`),
      api.get(`${DIRECT}?limit=${LIST_LIMIT}`),
    ]);
    if (!active || seq !== listSeq) return;
    if (g.status === "rejected" && d.status === "rejected") {
      // A silent background refresh never replaces a good list with an error.
      if (!silent) patch({ status: "error", partial: false, items: [] });
      return;
    }
    const items = [
      ...(g.status === "fulfilled" ? (g.value.data?.notifications || []).map(normalizeGeneral) : []),
      ...(d.status === "fulfilled" ? (d.value.data?.alerts || []).map(normalizeDirect) : []),
    ]
      .sort(byNewest)
      .slice(0, MAX_ITEMS);
    patch({ items, status: "ready", partial: g.status === "rejected" || d.status === "rejected" });
  }

  const readPath = (item) => `${item.source === "general" ? GENERAL : DIRECT}/${item.id}/read`;
  const countField = (source) => (source === "general" ? "generalUnread" : "directUnread");

  async function markRead(key) {
    const item = state.items.find((i) => i.key === key);
    if (!active || !item || item.read) return;
    countSeq += 1; // drop in-flight poll results that predate this change
    listSeq += 1;
    const field = countField(item.source);
    patch({
      markError: "",
      [field]: Math.max(0, state[field] - 1),
      items: state.items.map((i) => (i.key === key ? { ...i, read: true } : i)),
    });
    try {
      await api.post(readPath(item));
    } catch {
      if (active) {
        patch({
          markError: "Couldn't mark it as read. Please try again.",
          [field]: state[field] + 1,
          items: state.items.map((i) => (i.key === key ? { ...i, read: false } : i)),
        });
      }
    }
    refreshCounts({ force: true });
  }

  // Only the shared notifications have a read-all endpoint. Direct-call alerts have one global
  // read state and stay individually markable, so one click never clears them for other admins.
  async function markAllRead() {
    if (!active || state.generalUnread === 0) return;
    countSeq += 1;
    listSeq += 1;
    const previousUnread = state.generalUnread;
    const previousRead = new Map(state.items.filter((i) => i.source === "general").map((i) => [i.key, i.read]));
    patch({
      markError: "",
      generalUnread: 0,
      items: state.items.map((i) => (i.source === "general" ? { ...i, read: true } : i)),
    });
    try {
      await api.post(`${GENERAL}/read-all`);
    } catch {
      if (active) {
        patch({
          markError: "Couldn't mark all as read. Please try again.",
          generalUnread: previousUnread,
          items: state.items.map((i) => (previousRead.has(i.key) ? { ...i, read: previousRead.get(i.key) } : i)),
        });
      }
    }
    refreshCounts({ force: true });
  }

  function start() {
    if (active) return;
    active = true;
    countSeq += 1;
    listSeq += 1;
    countsInFlight = false;
    refreshCounts();
    timer = setIntervalFn(() => {
      refreshCounts();
      if (panelOpen) loadItems({ silent: true });
    }, pollMs);
  }

  function stop() {
    active = false;
    panelOpen = false;
    if (timer != null) clearIntervalFn(timer);
    timer = null;
  }

  function setPanelOpen(open) {
    panelOpen = !!open;
    if (panelOpen) loadItems();
  }

  return {
    start,
    stop,
    setPanelOpen,
    refreshCounts,
    loadItems,
    markRead,
    markAllRead,
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
