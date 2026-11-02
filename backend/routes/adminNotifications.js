const express = require("express");
const mongoose = require("mongoose");
const AdminNotification = require("../models/AdminNotification");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Only what the bell needs. `readBy` (other admins' ids) is never returned.
const serialize = (doc, adminId) => ({
  id: String(doc._id),
  type: doc.type,
  title: doc.title,
  message: doc.message,
  refType: doc.refType,
  refId: doc.refId,
  link: doc.link,
  createdAt: doc.createdAt,
  read: (doc.readBy || []).some((id) => String(id) === String(adminId)),
});

// Admin + Super Admin only, matching the other /api/admin/* routers. `guard` is
// overridable so tests can stand in for verifyAdminToken; adminOnly stays real.
function create({ guard = [verifyAdminToken, adminOnly] } = {}) {
  const router = express.Router();

  // Read state is keyed on the token's admin id, so it must be a real ObjectId.
  router.use(...guard, (req, res, next) => {
    if (!mongoose.isValidObjectId(req.user?.id)) return res.status(401).json({ msg: "Invalid session." });
    req.adminId = new mongoose.Types.ObjectId(String(req.user.id));
    next();
  });

  // GET /api/admin/notifications?limit=20&unread=true
  router.get("/", async (req, res) => {
    try {
      let limit = DEFAULT_LIMIT;
      if (req.query.limit !== undefined) {
        if (!/^\d+$/.test(String(req.query.limit))) return res.status(400).json({ msg: "limit must be a positive integer." });
        limit = Math.min(Math.max(Number(req.query.limit), 1), MAX_LIMIT);
      }
      const filter = String(req.query.unread || "") === "true" ? { readBy: { $ne: req.adminId } } : {};
      const docs = await AdminNotification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
      res.status(200).json({ notifications: docs.map((d) => serialize(d, req.adminId)) });
    } catch (error) {
      console.error("admin notifications list error:", error.message);
      res.status(500).json({ msg: "Failed to fetch notifications." });
    }
  });

  // GET /api/admin/notifications/unread-count
  router.get("/unread-count", async (req, res) => {
    try {
      const count = await AdminNotification.countDocuments({ readBy: { $ne: req.adminId } });
      res.status(200).json({ count });
    } catch (error) {
      console.error("admin notifications count error:", error.message);
      res.status(500).json({ msg: "Failed to fetch unread count." });
    }
  });

  // POST /api/admin/notifications/read-all — marks read for the caller only.
  router.post("/read-all", async (req, res) => {
    try {
      const result = await AdminNotification.updateMany(
        { readBy: { $ne: req.adminId } },
        { $addToSet: { readBy: req.adminId } },
      );
      res.status(200).json({ msg: "All notifications marked as read.", updated: result.modifiedCount });
    } catch (error) {
      console.error("admin notifications read-all error:", error.message);
      res.status(500).json({ msg: "Failed to update notifications." });
    }
  });

  // POST /api/admin/notifications/:id/read — idempotent, caller only.
  router.post("/:id/read", async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid notification id." });
      const updated = await AdminNotification.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { readBy: req.adminId } },
        { returnDocument: "after" },
      ).lean();
      if (!updated) return res.status(404).json({ msg: "Notification not found." });
      res.status(200).json({ notification: serialize(updated, req.adminId) });
    } catch (error) {
      console.error("admin notifications read error:", error.message);
      res.status(500).json({ msg: "Failed to update the notification." });
    }
  });

  return router;
}

module.exports = create();
module.exports.create = create;
