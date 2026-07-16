const express = require("express");
const router = express.Router();
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const {
  createDirectVideoRoom,
  getDirectVideoRooms,
  closeDirectVideoRoom,
  getDirectVideoRoomStatus,
} = require("../controllers/directVideoRoomController");

// Admin: generate / list / close rooms
router.post("/", verifyAdminToken, adminOnly, createDirectVideoRoom);
router.get("/", verifyAdminToken, adminOnly, getDirectVideoRooms);
router.post("/:roomId/close", verifyAdminToken, adminOnly, closeDirectVideoRoom);

// Public: no login required — anyone with the link checks room validity
// before joining as a guest, same trust model as a Google Meet link.
router.get("/:roomId/status", getDirectVideoRoomStatus);

module.exports = router;
