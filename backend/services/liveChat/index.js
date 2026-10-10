// Live Chat module entry point.
//
// mountLiveChat() is the only thing server.js calls. It does nothing unless LIVECHAT_ENABLED=true and the config
// is valid (see utils/liveChat/config.js), so with the kill switch off no route, namespace, timer or model is
// registered and /livechat, /livechat-admin and /api/admin/livechat do not exist.
const { checkLiveChatConfig, intFromEnv, readLimits, devFakeIp } = require("../../utils/liveChat/config");
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
  const fake = devFakeIp(env); // development only (never in production)
  if (fake) return fake;
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
//   - `check(socket, event)` re-validates the caller's role on every event (it may be async).
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
      const limit = typeof maxBytes === "function" ? maxBytes(event) : maxBytes;
      if (size > limit) return next(new Error("payload_too_large"));
      if (!limiter.allow(socket.id)) return next(new Error("rate_limited"));
      const verdict = await check(socket, event);
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
    // The name patients see: the agent's display name, else the first name on their account.
    async displayName(userId) {
      const profile = await this.get(userId);
      if (profile?.displayName) return profile.displayName;
      const User = require("../../models/User");
      const user = await User.findById(userId).select("name").lean();
      return String(user?.name || "").trim().split(/\s+/)[0].slice(0, 40);
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

// Which agents are online right now: the Online/Offline switch is on AND at least one admin socket is connected.
// In memory, behind a tiny interface (same reason as presence.js).
//   onGone(userId)  the agent's last connection closed, or they switched to Offline
//   onBack(userId)  the agent is available again (connected and online)
// index.js uses them to return an absent agent's chats to the Queue after a grace period.
function createAgentRegistry({ onGone = () => {}, onBack = () => {} } = {}) {
  const users = new Map(); // userId -> { online, explicit, sockets: Set }
  const entry = (userId) => {
    if (!users.has(userId)) users.set(userId, { online: false, explicit: false, sockets: new Set() });
    return users.get(userId);
  };
  const available = (e) => Boolean(e && e.online && e.sockets.size);
  return {
    connect(userId, socketId, online) {
      const e = entry(userId);
      const was = available(e);
      e.sockets.add(socketId);
      // The stored flag only seeds the first socket; a switch flipped meanwhile wins.
      if (e.sockets.size === 1 && !e.explicit) e.online = Boolean(online);
      if (!was && available(e)) onBack(userId);
    },
    disconnect(userId, socketId) {
      const e = users.get(userId);
      if (!e) return;
      e.sockets.delete(socketId);
      if (!e.sockets.size) {
        users.delete(userId);
        onGone(userId);
      }
    },
    setOnline(userId, online) {
      const e = entry(userId);
      const was = available(e);
      const wasOnline = e.online;
      e.online = Boolean(online);
      e.explicit = true;
      if (!available(e) && (was || (wasOnline && !e.online))) onGone(userId);
      else if (!was && available(e)) onBack(userId);
    },
    isAvailable: (userId) => available(users.get(userId)),
    // The two halves of availability, so a screen can say which one is missing.
    state(userId) {
      const e = users.get(userId);
      return { online: Boolean(e && e.online), connected: Boolean(e && e.sockets.size) };
    },
    availableCount() {
      let n = 0;
      for (const e of users.values()) if (available(e)) n += 1;
      return n;
    },
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

  if (String(env.LIVECHAT_DEV_FAKE_IP || "").trim()) {
    if (devFakeIp(env)) console.warn("[livechat] DEV ONLY: LIVECHAT_DEV_FAKE_IP is active, every visitor gets that IP. Never use this in production.");
    else console.warn("[livechat] LIVECHAT_DEV_FAKE_IP is ignored (it only works outside production and needs a valid public IP).");
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
    sessionCheckMs: options.sessionCheckMs ?? 60_000,
    agentStore: options.agentStore || createAgentStore(),
    isIpBlocked: options.isIpBlocked || (async () => false), // replaced below by the real block store
    lookupLocation: options.lookupLocation || require("../../utils/geoIp").lookupLocation,
    visitorIpCap: createIpCap(intFromEnv("LIVECHAT_MAX_VISITOR_SOCKETS_PER_IP", 20, env)),
    adminIpCap: createIpCap(intFromEnv("LIVECHAT_MAX_ADMIN_SOCKETS_PER_IP", 10, env)),
    helpers: { parseCookies, resolveSocketIp, installPacketGuard, makeSocketLimiter },
  };

  // Phase 2: chat services. Everything here can be replaced in tests (options.ai, options.loadSettings, ...).
  const models = options.models || {
    LcVisitor: require("../../models/LcVisitor"),
    LcConversation: require("../../models/LcConversation"),
    LcMessage: require("../../models/LcMessage"),
    LcSettings: require("../../models/LcSettings"),
    LcAiUsage: require("../../models/LcAiUsage"),
    LcPageVisit: require("../../models/LcPageVisit"),
    LcCannedReply: require("../../models/LcCannedReply"),
    LcFile: require("../../models/LcFile"),
    LcBlockedIp: require("../../models/LcBlockedIp"),
    LcSettingsAudit: require("../../models/LcSettingsAudit"),
    LcAgentProfile: require("../../models/LcAgentProfile"),
  };
  const settingsCacheMs = options.settingsCacheMs ?? 5000;
  let cached = { at: 0, value: null };
  const invalidateSettings = () => {
    cached = { at: 0, value: null }; // a saved change applies at once
  };
  const loadSettings =
    options.loadSettings ||
    (async () => {
      if (cached.value && Date.now() - cached.at < settingsCacheMs) return cached.value;
      const doc = await models.LcSettings.getSettings();
      cached = { at: Date.now(), value: doc.toObject ? doc.toObject() : doc };
      return cached.value;
    });
  const { createAiService } = require("./aiService");
  const { createLimits } = require("./limits");
  const { createChatService } = require("./chatService");
  const { verifyTurnstile } = require("./turnstile");
  const limits = createLimits({ models, readLimits: () => readLimits(env) });
  const agents = createAgentRegistry({
    onGone: (userId) => agentSvc?.agentGone(userId),
    onBack: (userId) => agentSvc?.agentBack(userId),
  });
  const ai = options.ai || createAiService({ env });
  const { createIpBlockStore, createAbuseDetector } = require("./ipBlock");
  const { createFollowUpMailer } = require("./followUpEmail");
  const { createFileService } = require("./fileService");
  const ipBlock = createIpBlockStore({ models });
  if (!options.isIpBlocked) ctx.isIpBlocked = ipBlock.isBlocked;
  const abuse = createAbuseDetector({ models, env, emit: (event, payload) => adminNs.to("agents").emit(event, payload) });
  // Load the Email module now (startup), unless a test supplies its own mailer: its first load blocks for seconds.
  if (!options.sendMail) require("./followUpEmail").loadEmailModule();
  const followUp = createFollowUpMailer({ models, loadSettings, sendMail: options.sendMail, env });
  let announce = () => {}; // set below, once the agent service exists
  let agentSvc = null;
  const chat = createChatService({
    models,
    loadSettings,
    ai,
    limits,
    presence,
    agents,
    emitToVisitor: (visitorId, event, payload) => visitorNs.to(`visitor:${visitorId}`).emit(event, payload),
    emitToAgents: (event, payload) => adminNs.to("agents").emit(event, payload),
    emitToTrackers: (visitorId, event, payload) => visitorNs.to(`track:${visitorId}`).emit(event, payload),
    announce: (conv) => announce(conv),
    followUp,
    abuse,
    leaveGraceMs: graceMs,
  });
  const files = createFileService({ models, chat, store: options.fileStore, env });
  const { createAgentService } = require("./agentService");
  agentSvc = createAgentService({
    models,
    chat,
    loadSettings,
    ai,
    limits,
    presence,
    agents,
    ipBlock,
    agentStore: ctx.agentStore,
    // blocking an IP drops the visitor sockets that come from it
    disconnectIp: (ip) => {
      for (const socket of visitorNs.sockets.values()) if (socket.data.ip === ip) socket.disconnect(true);
    },
    emitToAgent: (userId, event, payload) => adminNs.to(`agent:${userId}`).emit(event, payload),
  });
  announce = agentSvc.announce;
  const { createSettingsService } = require("./settingsService");
  const { createStatsService } = require("./statsService");
  const settingsSvc = createSettingsService({ models, invalidateSettings });
  const statsSvc = createStatsService({ models, loadSettings, agents });
  Object.assign(ctx, { chat, agents, limits, loadSettings, agentSvc, files, ipBlock });

  require("./visitorNamespace").setupVisitorNamespace(visitorNs, ctx);
  require("./adminNamespace").setupAdminNamespace(adminNs, ctx);

  if (app) {
    app.use(
      "/api/livechat",
      require("../../routes/liveChatPublic").create({
        chat,
        loadSettings,
        verifyTurnstile: options.verifyTurnstile || verifyTurnstile,
        isIpBlocked: (ip) => ctx.isIpBlocked(ip),
        files,
        env,
        limiters: options.publicLimiters,
      })
    );
    const routes = require("../../routes/adminLiveChat");
    app.use(
      "/api/admin/livechat",
      routes.create({ guard: options.guard || routes.DEFAULT_GUARD, presence, getSettings: options.getSettings, agent: agentSvc, files, settings: settingsSvc, stats: statsSvc })
    );
  }

  console.log("[livechat] enabled: namespaces /livechat and /livechat-admin, API /api/admin/livechat");

  return {
    presence,
    chat,
    agents,
    limits,
    agentSvc,
    settingsSvc,
    statsSvc,
    files,
    followUp,
    ipBlock,
    abuse,
    shutdown() {
      chat.shutdown();
      agentSvc.shutdown();
      presence.clear();
      adminNs.disconnectSockets(true);
      visitorNs.disconnectSockets(true);
    },
  };
}

// Small one-time upgrades of an existing settings document (never overwrites anything an admin wrote):
//   - the old "team is offline" default text becomes the new thank-you text,
//   - default quick options without a page link get their default link.
async function migrateSettings(LcSettings) {
  const { DEFAULT_SETTINGS } = require("./settingsDefaults");
  const legacy = [
    "Our team is offline right now. Leave your request and we'll reply to your email as soon as we're back.",
    "Our team is offline right now. We've saved your request and will reply by email.",
  ];
  const doc = await LcSettings.findOne({ key: "default" });
  if (!doc) return;
  const set = {};
  if (legacy.includes(doc.offlineMessage)) set.offlineMessage = DEFAULT_SETTINGS.offlineMessage;
  const defaults = new Map(DEFAULT_SETTINGS.quickOptions.map((o) => [o.key, o]));
  const options = doc.quickOptions.map((o) => {
    const plain = o.toObject ? o.toObject() : o;
    const fallback = defaults.get(plain.key);
    return !plain.link && fallback?.link ? { ...plain, link: fallback.link } : plain;
  });
  if (options.some((o, i) => o.link && !doc.quickOptions[i].link)) set.quickOptions = options;
  if (Object.keys(set).length) await LcSettings.updateOne({ _id: doc._id }, { $set: set });
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
  await migrateSettings(LcSettings);
  const LcCannedReply = require("../../models/LcCannedReply");
  if ((await LcCannedReply.estimatedDocumentCount()) === 0) {
    const { CANNED_REPLIES } = require("./settingsDefaults");
    await LcCannedReply.insertMany(CANNED_REPLIES.map((reply, order) => ({ ...reply, order })));
  }
  return true;
}

module.exports = { mountLiveChat, seedLiveChatDefaults, resolveSocketIp, parseCookies, createIpCap, createAgentRegistry };
