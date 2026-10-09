const express = require("express");
const { verifyAdminToken, liveChatAgentOnly } = require("../middleware/verifyToken");
const { toPublicVisitor } = require("../services/liveChat/presence");
const { AgentError, CONVERSATION_ID_RE } = require("../services/liveChat/agentService");

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
//
// Options exist so tests can run without real sessions:
//   guard     auth middleware chain (default: verified admin session, then agent role)
//   presence  the in-memory visitor store
//   agent     the agent service (lists, take over, replies, ...)
//   getSettings  () => settings document
const DEFAULT_GUARD = [verifyAdminToken, liveChatAgentOnly];

function create({ guard = DEFAULT_GUARD, presence, getSettings, agent } = {}) {
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

  router.get("/settings", async (req, res, next) => {
    try {
      const loader = getSettings || (() => require("../models/LcSettings").getSettings());
      const settings = await loader();
      res.json({ settings: settings?.toObject ? settings.toObject() : settings });
    } catch (err) {
      next(err);
    }
  });

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

  router.get("/unread", handle(async (req) => ({ ok: true, ...(await agent.unread(actor(req))) })));
  router.get("/canned-replies", handle(async (req) => ({ ok: true, ...(await agent.canned(actor(req))) })));

  return router;
}

module.exports = { create, DEFAULT_GUARD };
