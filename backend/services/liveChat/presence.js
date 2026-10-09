// In-memory visitor presence for the Real-time visitors list.
//
// Visitors who never chat live here only; they are never written to MongoDB. The rest of the module talks to the
// store through the small interface below (attach / detach / setPage / update / get / list / remove), so a
// shared store (Redis, together with the Socket.IO Redis adapter) can replace this class if the backend is ever
// run on more than one instance. State is per process, same as the other socket maps in server.js.
//
// A visitor is removed GRACE_MS after the last of their sockets disconnects (default 30 s). A reconnect inside
// that window (page change, flaky network, second tab) cancels the removal.
const DEFAULT_GRACE_MS = 30_000;
const MAX_PAGES = 50;

class MemoryPresenceStore {
  // onChange(type, record): "upsert" | "remove", used to push deltas to the admin namespace.
  // onExpire(record): the grace period elapsed with no socket left (Phase 2 archives an open chat here).
  constructor({ graceMs = DEFAULT_GRACE_MS, onChange = () => {}, onExpire = () => {} } = {}) {
    this.graceMs = graceMs;
    this.onChange = onChange;
    this.onExpire = onExpire;
    this.visitors = new Map(); // visitorId -> record
    this.sockets = new Map(); // visitorId -> Set<socketId>
    this.timers = new Map(); // visitorId -> grace timer
  }

  get size() {
    return this.visitors.size;
  }

  get(visitorId) {
    return this.visitors.get(visitorId) || null;
  }

  list() {
    return Array.from(this.visitors.values());
  }

  // Registers a socket for a visitor, creating the record on first sight. `init` only fills a new record.
  attach(visitorId, socketId, init = {}) {
    this.cancelGrace(visitorId);
    let record = this.visitors.get(visitorId);
    if (!record) {
      const now = Date.now();
      record = {
        visitorId,
        name: "",
        ip: "",
        geo: { city: "", state: "", country: "", countryCode: "" },
        device: "",
        os: "",
        browser: "",
        referrer: "",
        source: "Direct",
        joinedAt: now,
        lastSeenAt: now,
        page: null,
        pages: [],
        activity: "browsing", // browsing | chatting | waiting | invited | ai
        conversationId: null,
        assignedTo: null,
        ...init,
      };
      this.visitors.set(visitorId, record);
    }
    if (!this.sockets.has(visitorId)) this.sockets.set(visitorId, new Set());
    this.sockets.get(visitorId).add(socketId);
    record.lastSeenAt = Date.now();
    this.onChange("upsert", record);
    return record;
  }

  update(visitorId, patch) {
    const record = this.visitors.get(visitorId);
    if (!record) return null;
    Object.assign(record, patch);
    record.lastSeenAt = Date.now();
    this.onChange("upsert", record);
    return record;
  }

  // Moves the visitor to a new page and closes the time on the previous one.
  setPage(visitorId, { path, title }) {
    const record = this.visitors.get(visitorId);
    if (!record) return null;
    const now = Date.now();
    if (record.page && record.page.path === path) {
      record.page.title = title || record.page.title;
    } else {
      this.closeCurrentPage(record, now);
      record.page = { path, title, enteredAt: now };
      record.pages.push({ path, title, enteredAt: now, seconds: 0 });
      if (record.pages.length > MAX_PAGES) record.pages.shift();
    }
    record.lastSeenAt = now;
    this.onChange("upsert", record);
    return record;
  }

  closeCurrentPage(record, now = Date.now()) {
    const last = record.pages[record.pages.length - 1];
    if (last) last.seconds = Math.max(0, Math.round((now - last.enteredAt) / 1000));
  }

  heartbeat(visitorId) {
    const record = this.visitors.get(visitorId);
    if (record) record.lastSeenAt = Date.now();
    return record || null;
  }

  // Called when one socket disconnects. The visitor stays listed until none are left and the grace period ends.
  detach(visitorId, socketId) {
    const set = this.sockets.get(visitorId);
    if (set) {
      set.delete(socketId);
      if (set.size > 0) return;
      this.sockets.delete(visitorId);
    }
    if (!this.visitors.has(visitorId) || this.timers.has(visitorId)) return;
    const timer = setTimeout(() => {
      this.timers.delete(visitorId);
      const record = this.visitors.get(visitorId);
      if (!record || this.sockets.has(visitorId)) return;
      this.closeCurrentPage(record);
      this.visitors.delete(visitorId);
      this.onChange("remove", record);
      this.onExpire(record);
    }, this.graceMs);
    timer.unref?.();
    this.timers.set(visitorId, timer);
  }

  cancelGrace(visitorId) {
    const timer = this.timers.get(visitorId);
    if (timer) clearTimeout(timer);
    this.timers.delete(visitorId);
  }

  remove(visitorId) {
    this.cancelGrace(visitorId);
    this.sockets.delete(visitorId);
    const record = this.visitors.get(visitorId);
    if (!record) return null;
    this.visitors.delete(visitorId);
    this.onChange("remove", record);
    return record;
  }

  // Stops all timers and forgets everything. Used on shutdown and in tests.
  clear() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.sockets.clear();
    this.visitors.clear();
  }
}

// What admins receive: a visitor record without internals. IP is included on purpose (admin-only namespace).
function toPublicVisitor(record) {
  return {
    visitorId: record.visitorId,
    name: record.name,
    ip: record.ip,
    geo: record.geo,
    device: record.device,
    os: record.os,
    browser: record.browser,
    referrer: record.referrer,
    source: record.source,
    joinedAt: record.joinedAt,
    lastSeenAt: record.lastSeenAt,
    page: record.page,
    pages: record.pages,
    activity: record.activity,
    conversationId: record.conversationId,
    assignedTo: record.assignedTo,
  };
}

module.exports = { MemoryPresenceStore, toPublicVisitor, DEFAULT_GRACE_MS };
