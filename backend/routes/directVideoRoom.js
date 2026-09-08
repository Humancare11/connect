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
} = require("../controllers/directVideoRoomController");

// Admin: generate / list / close rooms
router.post("/", verifyAdminToken, adminOnly, createDirectVideoRoom);
router.get("/", verifyAdminToken, adminOnly, getDirectVideoRooms);
router.post("/:roomId/close", verifyAdminToken, adminOnly, closeDirectVideoRoom);

// Public: no login required — anyone with the link checks room validity
// before joining as a guest, same trust model as a Google Meet link.
// Rate-limited per IP+room since there's no identity to key on.
router.get("/:roomId/status", directVideoRoomPublicLimiter, getDirectVideoRoomStatus);
router.get("/:roomId/ice-servers", directVideoRoomPublicLimiter, getDirectVideoRoomIceServers);

module.exports = router;
