// /livechat: website visitors.
//
// Phase 1 only reports presence (who is on the site, which page, for how long). Nothing here is written to
// MongoDB: a visitor who never chats exists in memory only (services/liveChat/presence.js). Chat events arrive in
// Phase 2.
//
// Handshake auth: { visitorId, consent: true, referrer? }. The tracker only connects after the visitor accepted
// cookies, and the server refuses a handshake that does not say so.
const Bowser = require("bowser");
const { verifyChatToken } = require("./chatToken");
const { Country } = require("country-state-city");

const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_EVENT_BYTES = 2048;

// Pages that are never tracked (same areas the site hides its public layout on, plus login and payment).
const UNTRACKED_PREFIXES = [
  "/admin",
  "/adminauth",
  "/superadmin",
  "/payment-admin",
  "/employee",
  "/partner",
  "/doctor-dashboard",
  "/doctor-login",
  "/login",
  "/user",
  "/pay",
  "/payment",
  "/video-call",
  "/direct-video-call",
];

const SAFE_PATH_RE = /^\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*$/;

function isTrackablePath(path) {
  const lower = path.toLowerCase();
  return !UNTRACKED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(`${prefix}-`));
}

// Query strings and hashes can carry tokens or health details, so only the path is kept.
function cleanPath(value) {
  const path = String(value || "").split(/[?#]/)[0].slice(0, 300) || "/";
  return SAFE_PATH_RE.test(path) ? path : "";
}

function cleanTitle(value) {
  // eslint-disable-next-line no-control-regex
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 150);
}

// document.referrer → short label for the Source column. Only the host is kept, never the full URL.
function classifySource(rawReferrer, ownHosts = ["humancareconnect.co", "www.humancareconnect.co"]) {
  let host = "";
  try {
    host = new URL(String(rawReferrer || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { source: "Direct", referrer: "" };
  }
  if (!host || ownHosts.includes(host) || ownHosts.includes(`www.${host}`)) return { source: "Direct", referrer: "" };
  const table = [
    [/(^|\.)google\./, "Google search"],
    [/(^|\.)bing\.com$/, "Bing search"],
    [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
    [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com)$/, "Facebook"],
    [/(^|\.)instagram\.com$/, "Instagram"],
    [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "X"],
    [/(^|\.)linkedin\.com$/, "LinkedIn"],
  ];
  const hit = table.find(([re]) => re.test(host));
  return { source: hit ? hit[1] : host, referrer: host };
}

function parseUserAgent(ua) {
  try {
    const parsed = Bowser.getParser(String(ua || "").slice(0, 400));
    const platform = parsed.getPlatformType(true);
    return {
      device: platform === "mobile" ? "Mobile" : platform === "tablet" ? "Tablet" : "Desktop",
      os: parsed.getOSName() || "Unknown",
      browser: parsed.getBrowserName() || "Unknown",
    };
  } catch {
    return { device: "Desktop", os: "Unknown", browser: "Unknown" };
  }
}

let countryCodeByName = null;
function countryCodeFor(name) {
  if (!name) return "";
  if (!countryCodeByName) {
    countryCodeByName = new Map(Country.getAllCountries().map((c) => [c.name, c.isoCode]));
  }
  return countryCodeByName.get(name) || "";
}

const TRACKING_EVENTS = ["visitor:page", "visitor:heartbeat"];
const CHAT_EVENTS = ["chat:resume", "chat:start", "chat:message", "chat:option", "chat:agent", "chat:switch-ai", "chat:typing", "chat:rate"];
const EVENTS = [...TRACKING_EVENTS, ...CHAT_EVENTS];
const MAX_CHAT_MESSAGE_BYTES = 5000; // 1,000 characters can be up to 4 bytes each, plus JSON overhead

// Normalises (payload, ack) for events a client may emit without a payload.
const args = (a, b) => (typeof a === "function" ? [{}, a] : [a && typeof a === "object" ? a : {}, b]);
const reply = (cb, payload) => {
  if (typeof cb === "function") cb(payload);
};

// A socket can be a tracker (visitor accepted cookies: presence only), a chat client (holds a chat token from the
// contact form), or both. Tracking never needs a token; chat never works without one.
function setupVisitorNamespace(ns, ctx) {
  const { presence, helpers } = ctx;

  ns.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const tokenVisitorId = auth.chatToken ? verifyChatToken(auth.chatToken, ctx.env) : null;
      if (auth.chatToken && !tokenVisitorId) return next(new Error("invalid_token"));
      const tracking = auth.consent === true;
      if (!tokenVisitorId && !tracking) {
        // keep the original error order: a bad id is reported before a missing consent
        return next(new Error(VISITOR_ID_RE.test(String(auth.visitorId || "")) ? "consent_required" : "invalid_visitor"));
      }
      const visitorId = tokenVisitorId || String(auth.visitorId || "");
      if (!VISITOR_ID_RE.test(visitorId)) return next(new Error("invalid_visitor"));
      if (tokenVisitorId && auth.visitorId && auth.visitorId !== tokenVisitorId) return next(new Error("invalid_visitor"));
      const ip = helpers.resolveSocketIp(socket, ctx.env);
      if (!ip) return next(new Error("invalid_visitor"));
      if (ctx.visitorIpCap.isFull(ip)) return next(new Error("too_many_connections"));
      if (await ctx.isIpBlocked(ip)) return next(new Error("blocked"));
      socket.data.visitorId = visitorId;
      socket.data.ip = ip;
      socket.data.tracking = tracking;
      socket.data.chat = Boolean(tokenVisitorId);
      return next();
    } catch {
      return next(new Error("server_error"));
    }
  });

  ns.on("connection", (socket) => {
    const { visitorId, ip, tracking, chat: chatEnabled } = socket.data;
    ctx.visitorIpCap.add(ip);
    const limiter = helpers.makeSocketLimiter({ windowMs: 10_000, max: 40 });
    const userAgent = socket.handshake.headers?.["user-agent"];

    // Every event is checked against what this socket is allowed to do. A tracker cannot chat, a chat client
    // without cookie consent cannot be tracked, and nothing here reaches agent data.
    helpers.installPacketGuard(socket, {
      events: EVENTS,
      maxBytes: (event) => (event === "chat:message" ? MAX_CHAT_MESSAGE_BYTES : MAX_EVENT_BYTES),
      limiter,
      check: (s, event) =>
        s.data.visitorId === visitorId && (TRACKING_EVENTS.includes(event) ? s.data.tracking : s.data.chat),
    });

    if (chatEnabled) socket.join(`visitor:${visitorId}`);
    // Counts this connection: when a visitor has had none for ~30 s they have left (an open chat is archived).
    const releaseConnection = ctx.chat.trackConnection(visitorId);

    if (tracking) {
      const isNew = !presence.get(visitorId);
      const { source, referrer } = classifySource(socket.handshake.auth?.referrer);
      presence.attach(visitorId, socket.id, { ip, ...parseUserAgent(userAgent), source, referrer });
      if (isNew) {
        // Server-side location from the IP. Never throws; an unknown IP simply leaves the location empty.
        Promise.resolve(ctx.lookupLocation(ip))
          .then((geo) => {
            if (!geo || !presence.get(visitorId)) return;
            presence.update(visitorId, {
              geo: { city: geo.city || "", state: geo.state || "", country: geo.country || "", countryCode: countryCodeFor(geo.country) },
            });
          })
          .catch(() => {});
      }

      // Tracking sockets can receive the "an agent wrote to you" bubble (it carries only the agent's name).
      socket.join(`track:${visitorId}`);
      ctx.chat
        .pendingInvite(visitorId)
        .then((invite) => invite && socket.emit("chat:invite", invite))
        .catch(() => {});

      // A visitor who already has a chat open shows up with it (also after a page reload).
      ctx.chat.syncPresenceFor(visitorId).catch(() => {});

      socket.on("visitor:page", (payload) => {
        const path = cleanPath(payload?.path);
        if (!path || !isTrackablePath(path)) return;
        const title = cleanTitle(payload?.title);
        const record = presence.setPage(visitorId, { path, title });
        // The page timeline is stored only for visitors who chat; everyone else stays in memory.
        if (record?.conversationId) {
          ctx.chat.recordPageVisit(record.conversationId, visitorId, { path, title }).catch(() => {});
        }
      });
      socket.on("visitor:heartbeat", () => {
        presence.heartbeat(visitorId);
      });
    }

    if (chatEnabled) {
      // Never log the error object or its message: it could carry patient text.
      const safely = async (cb, fn) => {
        try {
          reply(cb, await fn());
        } catch (err) {
          console.error(`[livechat] chat event failed: ${err?.name || "Error"}`);
          reply(cb, { ok: false, error: "server_error" });
        }
      };

      socket.on("chat:resume", (a, b) => {
        const [, cb] = args(a, b);
        safely(cb, () => ctx.chat.resume(visitorId));
      });

      socket.on("chat:start", (a, b) => {
        const [payload, cb] = args(a, b);
        safely(cb, async () => {
          const { source } = classifySource(socket.handshake.auth?.referrer);
          const agent = parseUserAgent(userAgent);
          const path = cleanPath(payload.path);
          const known = presence.get(visitorId);
          const geo = known ? null : await ctx.lookupLocation(ip);
          return ctx.chat.startConversation(visitorId, {
            ip,
            source,
            referrer: classifySource(socket.handshake.auth?.referrer).referrer,
            timeZone: payload.tz,
            cookieChoice: payload.cookies,
            geo: geo ? { city: geo.city, state: geo.state, country: geo.country } : null,
            device: { type: agent.device, os: agent.os, browser: agent.browser },
            page: path && isTrackablePath(path) ? { path, title: cleanTitle(payload.title) } : null,
          });
        });
      });

      socket.on("chat:message", (a, b) => {
        const [payload, cb] = args(a, b);
        safely(cb, () => ctx.chat.sendMessage(visitorId, payload.text));
      });

      socket.on("chat:option", (a, b) => {
        const [payload, cb] = args(a, b);
        safely(cb, () => ctx.chat.pickOption(visitorId, String(payload.key || "").slice(0, 40)));
      });

      socket.on("chat:agent", (a, b) => {
        const [, cb] = args(a, b);
        safely(cb, () => ctx.chat.talkToAgent(visitorId));
      });

      socket.on("chat:switch-ai", (a, b) => {
        const [, cb] = args(a, b);
        safely(cb, () => ctx.chat.switchToAi(visitorId));
      });

      socket.on("chat:rate", (a, b) => {
        const [payload, cb] = args(a, b);
        safely(cb, () => ctx.chat.rate(visitorId, payload.stars));
      });

      // Typing carries a boolean only, never the text being typed.
      socket.on("chat:typing", (a) => {
        ctx.chat.relayTyping(visitorId, (a && typeof a === "object" ? a.typing : a) === true);
      });
    }

    socket.on("disconnect", () => {
      releaseConnection();
      ctx.visitorIpCap.remove(ip);
      limiter.dispose(socket.id);
      if (tracking) presence.detach(visitorId, socket.id);
    });
  });
}

module.exports = { setupVisitorNamespace, classifySource, cleanPath, isTrackablePath, parseUserAgent };
