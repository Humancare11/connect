// Live Chat module entry point.
//
// mountLiveChat() is the only thing server.js calls. It does nothing unless LIVECHAT_ENABLED=true and the config
// is valid (see utils/liveChat/config.js), so with the kill switch off no route, namespace, timer or model is
// registered and /livechat, /livechat-admin and /api/admin/livechat do not exist.
const { checkLiveChatConfig, intFromEnv } = require("../../utils/liveChat/config");
const { normalizeIp, parseTrustProxy } = require("../../utils/clientIp");
const { makeSocketLimiter } = require("../../utils/socketRateLimit");
const { MemoryPresenceStore, DEFAULT_GRACE_MS } = require("./presence");

// ── Shared socket helpers (used by both namespaces) ────────────────────────────

function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key || !value) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

// Real client IP for a socket, using the same proxy settings as the HTTP side (TRUST_PROXY,
// USE_CLOUDFLARE_HEADERS). X-Forwarded-For is only honoured when a proxy is trusted, otherwise a client could
// choose its own IP.
function resolveSocketIp(socket, env = process.env) {
  const handshake = socket.handshake || {};
  const headers = handshake.headers || {};
  if (String(env.USE_CLOUDFLARE_HEADERS || "").trim().toLowerCase() === "true") {
    const cf = normalizeIp(headers["cf-connecting-ip"]);
    if (cf) return cf;
  }
  const direct = normalizeIp(handshake.address);
  const trust = parseTrustProxy(env.TRUST_PROXY);
  if (trust === false) return direct;
  const forwarded = String(headers["x-forwarded-for"] || "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter(Boolean);
  if (!forwarded.length) return direct;
  if (trust === true) return forwarded[0];
  if (typeof trust === "number") return forwarded[Math.max(0, forwarded.length - trust)] || direct;
  return direct; // subnet-list form: fall back to the socket address
}

// Counts open sockets per IP so one address cannot open thousands of connections.
function createIpCap(max) {
  const counts = new Map();
  return {
    isFull: (ip) => (counts.get(ip) || 0) >= max,
    add: (ip) => counts.set(ip, (counts.get(ip) || 0) + 1),
    remove: (ip) => {
      const next = (counts.get(ip) || 0) - 1;
      if (next > 0) counts.set(ip, next);
      else counts.delete(ip);
    },
    size: () => counts.size,
  };
}

// Per-packet guard, run for EVERY incoming event on a socket:
//   - the event name must be on the namespace's allow-list,
//   - no binary payloads, and the JSON size must be under maxBytes,
//   - per-socket rate limit,
//   - `check(socket)` re-validates the caller's role on every event (it may be async).
// A failing event gets an "error" back and its handler never runs. `onDeny` runs for role failures so the
// namespace can disconnect the socket.
function installPacketGuard(socket, { events, maxBytes, limiter, check }) {
  // Socket.IO emits "error" on the server socket when a packet middleware rejects an event; without a listener
  // Node would throw. The rejection reason is deliberately not logged (payloads may hold patient data).
  socket.on("error", () => {});
  socket.use(async ([event, ...args], next) => {
    try {
      if (!events.includes(event)) return next(new Error("unknown_event"));
      for (const arg of args) {
        if (Buffer.isBuffer(arg) || arg instanceof ArrayBuffer) return next(new Error("binary_not_allowed"));
      }
      let size = 0;
      try {
        size = Buffer.byteLength(JSON.stringify(args.filter((arg) => typeof arg !== "function")));
      } catch {
        return next(new Error("invalid_payload"));
      }
      if (size > maxBytes) return next(new Error("payload_too_large"));
      if (!limiter.allow(socket.id)) return next(new Error("rate_limited"));
      const verdict = await check(socket);
      if (verdict !== true) {
        next(new Error("forbidden"));
        socket.disconnect(true);
        return undefined;
      }
      return next();
    } catch {
      return next(new Error("server_error"));
    }
  });
}

// ── Default agent store (Mongo). Tests inject their own. ────────────────────────

function createAgentStore() {
  return {
    async get(userId) {
      const LcAgentProfile = require("../../models/LcAgentProfile");
      return LcAgentProfile.findOne({ userId }).lean();
    },
    async setOnline(userId, online) {
      const LcAgentProfile = require("../../models/LcAgentProfile");
      const User = require("../../models/User");
      const existing = await LcAgentProfile.findOne({ userId }).select("_id displayName").lean();
      const patch = { online: Boolean(online), lastSeenAt: new Date() };
      if (!existing || !existing.displayName) {
        const user = await User.findById(userId).select("name").lean();
        patch.displayName = String(user?.name || "").trim().split(/\s+/)[0].slice(0, 40) || "Agent";
      }
      return LcAgentProfile.findOneAndUpdate(
        { userId },
        { $set: patch },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      ).lean();
    },
  };
}

function createIpBlockCheck() {
  const cache = new Map(); // ip -> { blocked, until }
  return async function isIpBlocked(ip) {
    const hit = cache.get(ip);
    if (hit && hit.until > Date.now()) return hit.blocked;
    let blocked = false;
    try {
      const LcBlockedIp = require("../../models/LcBlockedIp");
      const row = await LcBlockedIp.findOne({ ip }).select("expiresAt").lean();
      blocked = Boolean(row && (!row.expiresAt || row.expiresAt > new Date()));
    } catch {
      blocked = false; // a lookup failure must not take the tracker down
    }
    cache.set(ip, { blocked, until: Date.now() + 30_000 });
    return blocked;
  };
}

// ── Mount ──────────────────────────────────────────────────────────────────────

// Options (all optional; tests use them to avoid real sessions / DB / geo lookups):
//   env, validateAccessToken(token) -> { id, role, ... } | null   (server.js passes validateSocketAccessToken)
//   graceMs, revalidateMs, agentStore, isIpBlocked, lookupLocation, guard
function mountLiveChat({ app, io, validateAccessToken, env = process.env, ...options } = {}) {
  const config = checkLiveChatConfig(env);
  if (!config.enabled) return null;
  if (!config.ok) {
    console.error(`[livechat] ${config.reason}`);
    return null;
  }
  if (!io || typeof validateAccessToken !== "function") {
    throw new Error("mountLiveChat needs io and validateAccessToken");
  }

  const graceMs = options.graceMs ?? intFromEnv("LIVECHAT_PRESENCE_GRACE_MS", DEFAULT_GRACE_MS, env);
  const adminNs = io.of("/livechat-admin");
  const visitorNs = io.of("/livechat");

  const presence = new MemoryPresenceStore({
    graceMs,
    onChange: (type, record) => {
      // Admin deltas. Required lazily to keep the module graph small when disabled.
      const { toPublicVisitor } = require("./presence");
      if (type === "remove") adminNs.to("agents").emit("visitors:delta", { type, visitorId: record.visitorId });
      else adminNs.to("agents").emit("visitors:delta", { type, visitor: toPublicVisitor(record) });
    },
  });

  const ctx = {
    env,
    presence,
    validateAccessToken,
    revalidateMs: options.revalidateMs ?? 60_000,
    agentStore: options.agentStore || createAgentStore(),
    isIpBlocked: options.isIpBlocked || createIpBlockCheck(),
    lookupLocation: options.lookupLocation || require("../../utils/geoIp").lookupLocation,
    visitorIpCap: createIpCap(intFromEnv("LIVECHAT_MAX_VISITOR_SOCKETS_PER_IP", 20, env)),
    adminIpCap: createIpCap(intFromEnv("LIVECHAT_MAX_ADMIN_SOCKETS_PER_IP", 10, env)),
    helpers: { parseCookies, resolveSocketIp, installPacketGuard, makeSocketLimiter },
  };

  require("./visitorNamespace").setupVisitorNamespace(visitorNs, ctx);
  require("./adminNamespace").setupAdminNamespace(adminNs, ctx);

  if (app) {
    const routes = require("../../routes/adminLiveChat");
    app.use(
      "/api/admin/livechat",
      routes.create({ guard: options.guard || routes.DEFAULT_GUARD, presence, getSettings: options.getSettings })
    );
  }

  console.log("[livechat] enabled: namespaces /livechat and /livechat-admin, API /api/admin/livechat");

  return {
    presence,
    shutdown() {
      presence.clear();
      adminNs.disconnectSockets(true);
      visitorNs.disconnectSockets(true);
    },
  };
}

// Creates the settings document with its defaults. Called once at startup (after MongoDB is connected) and only
// when the module is on, so a disabled module never touches the database.
async function seedLiveChatDefaults(env = process.env) {
  const config = checkLiveChatConfig(env);
  if (!config.enabled || !config.ok) return false;
  const LcSettings = require("../../models/LcSettings");
  try {
    await LcSettings.getSettings();
  } catch (err) {
    if (err?.code !== 11000) throw err; // two instances seeding at once: the other one won, fine
  }
  return true;
}

module.exports = { mountLiveChat, seedLiveChatDefaults, resolveSocketIp, parseCookies, createIpCap };
