// /livechat-admin: live agents (admin + superadmin only).
//
// Auth: the adminToken cookie (or a Bearer / handshake token, like the existing sockets), validated with the same
// session checks as the rest of the app. The role is checked when the socket connects AND on every event; the
// session itself is re-validated at most every revalidateMs, so a revoked or demoted agent is cut off quickly.
// employeeadmin, paymentadmin, doctors, patients and partners are refused at the handshake.
const { LIVE_CHAT_AGENT_ROLES } = require("../../middleware/verifyToken");
const { toPublicVisitor } = require("./presence");

const EVENTS = ["visitors:get", "agent:status", "chat:typing"];
const MAX_EVENT_BYTES = 4096;

function handshakeTokens(socket, helpers) {
  const handshake = socket.handshake || {};
  const cookies = helpers.parseCookies(handshake.headers?.cookie || "");
  const bearer = handshake.headers?.authorization?.startsWith("Bearer ")
    ? handshake.headers.authorization.split(" ")[1]
    : null;
  // Only the admin cookie is considered: a userToken / doctorToken cookie can never make an agent.
  return [cookies.adminToken, handshake.auth?.token, bearer].filter(Boolean);
}

function setupAdminNamespace(ns, ctx) {
  const { presence, helpers, validateAccessToken } = ctx;

  ns.use(async (socket, next) => {
    try {
      const ip = helpers.resolveSocketIp(socket, ctx.env);
      if (ctx.adminIpCap.isFull(ip)) return next(new Error("too_many_connections"));
      for (const token of handshakeTokens(socket, helpers)) {
        const identity = await validateAccessToken(token);
        if (identity && LIVE_CHAT_AGENT_ROLES.includes(identity.role)) {
          socket.data.identity = identity;
          socket.data.token = token;
          socket.data.checkedAt = Date.now();
          socket.data.ip = ip;
          return next();
        }
      }
      return next(new Error("forbidden"));
    } catch {
      return next(new Error("forbidden"));
    }
  });

  // Role check for every event. Cheap (in-memory) most of the time; re-validates the session periodically.
  async function stillAgent(socket) {
    const identity = socket.data.identity;
    if (!identity || !LIVE_CHAT_AGENT_ROLES.includes(identity.role)) return false;
    if (Date.now() - socket.data.checkedAt < ctx.revalidateMs) return true;
    const fresh = await validateAccessToken(socket.data.token);
    if (!fresh || fresh.id !== identity.id || !LIVE_CHAT_AGENT_ROLES.includes(fresh.role)) return false;
    socket.data.identity = fresh;
    socket.data.checkedAt = Date.now();
    return true;
  }

  const snapshot = () => ({ visitors: presence.list().map(toPublicVisitor), serverTime: Date.now() });

  async function sendAgentStatus(socket) {
    const profile = await ctx.agentStore.get(socket.data.identity.id);
    socket.emit("agent:status", {
      online: Boolean(profile?.online),
      displayName: profile?.displayName || "",
    });
  }

  ns.on("connection", (socket) => {
    const { identity, ip } = socket.data;
    ctx.adminIpCap.add(ip);
    const limiter = helpers.makeSocketLimiter({ windowMs: 10_000, max: 30 });

    helpers.installPacketGuard(socket, {
      events: EVENTS,
      maxBytes: MAX_EVENT_BYTES,
      limiter,
      check: stillAgent,
    });

    socket.join("agents");
    socket.join(`agent:${identity.id}`);
    socket.emit("visitors:snapshot", snapshot());
    // Register as connected (availability = Online switch AND a live socket), then tell the agent their status.
    ctx.agentStore
      .get(identity.id)
      .then((profile) => socket.connected && ctx.agents.connect(identity.id, socket.id, profile?.online))
      .catch(() => socket.connected && ctx.agents.connect(identity.id, socket.id, false));
    sendAgentStatus(socket).catch(() => {});

    socket.on("visitors:get", (ack) => {
      if (typeof ack === "function") ack(snapshot());
      else socket.emit("visitors:snapshot", snapshot());
    });

    // Online / Offline switch (Phase 3 uses it to route the queue).
    socket.on("agent:status", async (payload, ack) => {
      try {
        const online = payload?.online === true;
        const profile = await ctx.agentStore.setOnline(identity.id, online);
        ctx.agents.setOnline(identity.id, Boolean(profile?.online));
        const state = { online: Boolean(profile?.online), displayName: profile?.displayName || "" };
        ns.to(`agent:${identity.id}`).emit("agent:status", state);
        if (typeof ack === "function") ack({ ok: true, ...state });
      } catch {
        if (typeof ack === "function") ack({ ok: false });
      }
    });

    // Typing indicator for the patient: only the agent who holds the chat, a boolean only, never any text.
    socket.on("chat:typing", (payload) => {
      const typing = payload && typeof payload === "object" ? payload.typing === true : false;
      ctx.agentSvc.relayTyping(socket.data.identity, payload?.conversationId, typing).catch(() => {});
    });

    socket.on("disconnect", () => {
      ctx.adminIpCap.remove(ip);
      ctx.agents.disconnect(identity.id, socket.id);
      limiter.dispose(socket.id);
    });
  });
}

module.exports = { setupAdminNamespace };
