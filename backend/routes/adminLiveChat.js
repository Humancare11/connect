const express = require("express");
const { verifyAdminToken, liveChatAgentOnly, superAdminOnly } = require("../middleware/verifyToken");
const { toPublicVisitor } = require("../services/liveChat/presence");
const { AgentError, CONVERSATION_ID_RE } = require("../services/liveChat/agentService");
const { FileError } = require("../services/liveChat/fileService");
const { SettingsError } = require("../services/liveChat/settingsService");
const { StatsError } = require("../services/liveChat/statsService");
const sitePages = require("../services/liveChat/sitePages").createSitePages();
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Live Chat admin API. Admin + Super Admin only (employeeadmin, paymentadmin, doctors, patients and partners
// are rejected by liveChatAgentOnly on every route below).
//
//   GET  /visitors, /summary, /settings                   Real-time visitors and settings (read)
//   GET  /conversations?view=ai|live                      chat lists (AI chats / Live agent chats)
//   GET  /conversations/:id                               one chat with its patient panel (marks it read)
//   POST /conversations/:id/messages|notes|takeover|handback|resolve|read|suggest
//   PUT  /conversations/:id/tags|contact
//   POST /conversations/start                             admin-started chat with a visitor who has contact details
//   GET  /unread, /canned-replies
//   GET  /files/:id/url                                   a 5-minute presigned link to a patient's file (role-checked)
//   POST /conversations/:id/block-ip, /visitors/:visitorId/block-ip   block an abusive IP
//   GET  /blocked-ips, DELETE /blocked-ips/:id            list / unblock
//   GET  /settings, /settings/audit                       AI agent settings and their change log (admin: read only)
//   PUT  /settings                                        save settings (superadmin only; applies at once, logged)
//   GET/POST/PUT/DELETE /canned-replies                   canned replies (writes: superadmin only)
//   GET  /team, PUT /team/:userId/display-name            Team page; an agent renames themselves, a superadmin anyone
//   GET  /reports?from=YYYY-MM-DD&to=YYYY-MM-DD           Reports page
//
// Options exist so tests can run without real sessions:
//   guard     auth middleware chain (default: verified admin session, then agent role)
//   presence  the in-memory visitor store
//   agent     the agent service (lists, take over, replies, ...)
//   getSettings  () => settings document
const DEFAULT_GUARD = [verifyAdminToken, liveChatAgentOnly];

function create({ guard = DEFAULT_GUARD, presence, getSettings, agent, files, settings, stats } = {}) {
  const router = express.Router();
  router.use(guard);
  router.use(express.json({ limit: "16kb" }));

  // Runs a handler and maps AgentError to JSON ({ ok: false, error, ...extra }).
  const handle = (fn) => async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json(await fn(req));
    } catch (err) {
      if (err instanceof AgentError) return res.status(err.status).json({ ok: false, error: err.code, ...err.extra });
      if (err instanceof FileError) return res.status(err.status).json({ ok: false, error: err.code });
      if (err instanceof SettingsError) return res.status(err.status).json({ ok: false, error: err.code, ...err.extra });
      if (err instanceof StatsError) return res.status(err.status).json({ ok: false, error: err.code });
      return next(err);
    }
  };
  const actor = (req) => ({ id: String(req.user.id), role: req.user.role });
  const idOf = (req) => {
    if (!CONVERSATION_ID_RE.test(String(req.params.id))) throw new AgentError(404, "not_found");
    return req.params.id;
  };

  // ── Real-time visitors / settings ─────────────────────────────────────────────

  router.get("/visitors", (req, res) => {
    res.json({ visitors: presence.list().map(toPublicVisitor), serverTime: Date.now() });
  });

  router.get("/summary", (req, res) => {
    const visitors = presence.list();
    const count = (activity) => visitors.filter((v) => v.activity === activity).length;
    res.json({
      onWebsite: visitors.length,
      chatting: count("chatting") + count("invited"),
      waiting: count("waiting"),
      withAi: count("ai"),
    });
  });

  router.get(
    "/settings",
    handle(async (req) => {
      const loader = getSettings || (() => settings.get());
      const doc = await loader();
      // linkPages: the site pages an option may show as a button (service pages and the booking page).
      const linkPages = sitePages.pages.filter((p) => p.type === "service").map((p) => ({ title: p.title, url: p.url }));
      return { ok: true, settings: doc?.toObject ? doc.toObject() : doc, canEdit: req.user.role === "superadmin", linkPages };
    })
  );
  router.put("/settings", superAdminOnly, handle((req) => settings.update(actor(req), req.body)));
  router.get("/settings/audit", handle(async (req) => ({ ok: true, entries: await settings.audit(req.query.limit) })));

  router.post("/canned-replies", superAdminOnly, handle((req) => settings.createCanned(actor(req), req.body)));
  router.put("/canned-replies/:id", superAdminOnly, handle((req) => settings.updateCanned(actor(req), req.params.id, req.body)));
  router.delete("/canned-replies/:id", superAdminOnly, handle((req) => settings.deleteCanned(actor(req), req.params.id)));

  router.get("/team", handle(() => stats.team()));
  router.put("/team/:userId/display-name", handle((req) => settings.setDisplayName(actor(req), req.params.userId, req.body?.displayName)));
  router.get("/reports", handle((req) => stats.reports({ from: req.query.from, to: req.query.to })));

  // ── Chats ─────────────────────────────────────────────────────────────────────

  router.get(
    "/conversations",
    handle(async (req) => {
      const view = req.query.view;
      if (view !== "ai" && view !== "live") throw new AgentError(400, "invalid_view");
      return { ok: true, conversations: await agent.list(actor(req), view), serverTime: Date.now() };
    })
  );

  router.post(
    "/conversations/start",
    handle((req) => agent.startChat(actor(req), req.body?.visitorId))
  );

  router.get("/conversations/:id", handle((req) => agent.detail(actor(req), idOf(req)).then((d) => ({ ok: true, ...d, serverTime: Date.now() }))));
  router.post("/conversations/:id/messages", handle((req) => agent.sendMessage(actor(req), idOf(req), req.body?.text)));
  router.post("/conversations/:id/notes", handle((req) => agent.addNote(actor(req), idOf(req), req.body?.text)));
  router.post("/conversations/:id/takeover", handle((req) => agent.takeOver(actor(req), idOf(req))));
  router.post("/conversations/:id/handback", handle((req) => agent.handBack(actor(req), idOf(req))));
  router.post("/conversations/:id/resolve", handle((req) => agent.resolve(actor(req), idOf(req))));
  router.post("/conversations/:id/read", handle((req) => agent.markRead(actor(req), idOf(req))));
  router.post("/conversations/:id/suggest", handle((req) => agent.suggest(actor(req), idOf(req))));
  router.put("/conversations/:id/tags", handle((req) => agent.setTags(actor(req), idOf(req), req.body?.tags)));
  router.put("/conversations/:id/contact", handle((req) => agent.updateContact(actor(req), idOf(req), req.body)));

  router.post("/conversations/:id/block-ip", handle((req) => agent.blockIp(actor(req), { conversationId: idOf(req), reason: req.body?.reason })));
  router.post(
    "/visitors/:visitorId/block-ip",
    handle((req) => {
      if (!VISITOR_ID_RE.test(String(req.params.visitorId))) throw new AgentError(404, "not_found");
      return agent.blockIp(actor(req), { visitorId: req.params.visitorId, reason: req.body?.reason });
    })
  );
  router.get("/blocked-ips", handle(() => agent.blockedIps()));
  router.delete("/blocked-ips/:id", handle((req) => agent.unblockIp(actor(req), req.params.id)));
  // The role check is the guard above; the link is short-lived and every issue is logged on the file.
  router.get("/files/:id/url", handle((req) => files.presign(actor(req), req.params.id)));

  router.get("/unread", handle(async (req) => ({ ok: true, ...(await agent.unread(actor(req))) })));
  // In a chat: the active canned replies plus the agent's display name. With ?all=1 (settings page): every reply.
  router.get(
    "/canned-replies",
    handle(async (req) => {
      if (req.query.all === "1") return { ok: true, replies: await settings.listCanned() };
      return { ok: true, ...(await agent.canned(actor(req))) };
    })
  );

  return router;
}

module.exports = { create, DEFAULT_GUARD };
