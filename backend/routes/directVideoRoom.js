const express = require("express");
const router = express.Router();
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { directVideoRoomPublicLimiter } = require("../middleware/rateLimiters");
const {
  createDirectVideoRoom,
  getDirectVideoRooms,
  closeDirectVideoRoom,
  getDirectVideoRoomStatus,
  getDirectVideoRoomIceServers,
  getDirectVideoCalls,
  getDirectVideoRoomEvents,
  extendDirectVideoRoomLink,
  clearStuckSeats,
  forceEndDirectVideoCall,
  getDirectCallAlerts,
  getDirectCallAlertsUnreadCount,
  markDirectCallAlertRead,
} = require("../controllers/directVideoRoomController");

// Admin: generate / list / close rooms
router.post("/", verifyAdminToken, adminOnly, createDirectVideoRoom);
router.get("/", verifyAdminToken, adminOnly, getDirectVideoRooms);
router.post("/:roomId/close", verifyAdminToken, adminOnly, closeDirectVideoRoom);

// Admin: alerts (Phase 4) — registered ahead of the /:roomId/* routes below
// so "alerts" is never treated as a :roomId path segment.
router.get("/alerts", verifyAdminToken, adminOnly, getDirectCallAlerts);
router.get("/alerts/unread-count", verifyAdminToken, adminOnly, getDirectCallAlertsUnreadCount);
router.post("/alerts/:alertId/read", verifyAdminToken, adminOnly, markDirectCallAlertRead);

// Admin: Calls list + report + call-management actions (Phase 3).
router.get("/calls", verifyAdminToken, adminOnly, getDirectVideoCalls);
router.get("/:roomId/events", verifyAdminToken, adminOnly, getDirectVideoRoomEvents);
router.post("/:roomId/extend", verifyAdminToken, adminOnly, extendDirectVideoRoomLink);
router.post("/:roomId/clear-stuck-seats", verifyAdminToken, adminOnly, clearStuckSeats);
router.post("/:roomId/force-end", verifyAdminToken, adminOnly, forceEndDirectVideoCall);

// Public: no login required — anyone with the link checks room validity
// before joining as a guest, same trust model as a Google Meet link.
// Rate-limited per IP+room since there's no identity to key on.
router.get("/:roomId/status", directVideoRoomPublicLimiter, getDirectVideoRoomStatus);
router.get("/:roomId/ice-servers", directVideoRoomPublicLimiter, getDirectVideoRoomIceServers);

module.exports = router;
