// /livechat: website visitors.
//
// Phase 1 only reports presence (who is on the site, which page, for how long). Nothing here is written to
// MongoDB: a visitor who never chats exists in memory only (services/liveChat/presence.js). Chat events arrive in
// Phase 2.
//
// Handshake auth: { visitorId, consent: true, referrer? }. The tracker only connects after the visitor accepted
// cookies, and the server refuses a handshake that does not say so.
const Bowser = require("bowser");
const { Country } = require("country-state-city");

const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EVENTS = ["visitor:page", "visitor:heartbeat"];
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

function setupVisitorNamespace(ns, ctx) {
  const { presence, helpers } = ctx;

  ns.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const visitorId = String(auth.visitorId || "");
      if (!VISITOR_ID_RE.test(visitorId)) return next(new Error("invalid_visitor"));
      if (auth.consent !== true) return next(new Error("consent_required"));
      const ip = helpers.resolveSocketIp(socket, ctx.env);
      if (!ip) return next(new Error("invalid_visitor"));
      if (ctx.visitorIpCap.isFull(ip)) return next(new Error("too_many_connections"));
      if (await ctx.isIpBlocked(ip)) return next(new Error("blocked"));
      socket.data.visitorId = visitorId;
      socket.data.ip = ip;
      return next();
    } catch {
      return next(new Error("server_error"));
    }
  });

  ns.on("connection", (socket) => {
    const { visitorId, ip } = socket.data;
    ctx.visitorIpCap.add(ip);
    const limiter = helpers.makeSocketLimiter({ windowMs: 10_000, max: 40 });

    // A visitor socket can only ever be a visitor: the only events it may send are the tracking events below,
    // and there is no code path from here to agent data.
    helpers.installPacketGuard(socket, {
      events: EVENTS,
      maxBytes: MAX_EVENT_BYTES,
      limiter,
      check: (s) => s.data.visitorId === visitorId,
    });

    const isNew = !presence.get(visitorId);
    const { source, referrer } = classifySource(socket.handshake.auth?.referrer);
    presence.attach(visitorId, socket.id, {
      ip,
      ...parseUserAgent(socket.handshake.headers?.["user-agent"]),
      source,
      referrer,
    });

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

    socket.on("visitor:page", (payload) => {
      const path = cleanPath(payload?.path);
      if (!path || !isTrackablePath(path)) return;
      presence.setPage(visitorId, { path, title: cleanTitle(payload?.title) });
    });

    socket.on("visitor:heartbeat", () => {
      presence.heartbeat(visitorId);
    });

    socket.on("disconnect", () => {
      ctx.visitorIpCap.remove(ip);
      limiter.dispose(socket.id);
      presence.detach(visitorId, socket.id);
    });
  });
}

module.exports = { setupVisitorNamespace, classifySource, cleanPath, isTrackablePath, parseUserAgent };
