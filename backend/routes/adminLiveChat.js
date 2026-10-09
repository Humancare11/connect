const express = require("express");
const { verifyAdminToken, liveChatAgentOnly } = require("../middleware/verifyToken");
const { toPublicVisitor } = require("../services/liveChat/presence");

// Live Chat admin API. Admin + Super Admin only (employeeadmin, paymentadmin, doctors, patients and partners
// are rejected by liveChatAgentOnly). Phase 1: read-only endpoints; later phases add chat actions here.
//
// Options exist so tests can run without real sessions:
//   guard     auth middleware chain (default: verified admin session, then agent role)
//   presence  the in-memory visitor store
//   getSettings  () => settings document
const DEFAULT_GUARD = [verifyAdminToken, liveChatAgentOnly];

function create({ guard = DEFAULT_GUARD, presence, getSettings } = {}) {
  const router = express.Router();
  router.use(guard);

  // Snapshot of everyone on the website right now (also pushed live over /livechat-admin).
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

  return router;
}

module.exports = { create, DEFAULT_GUARD };
