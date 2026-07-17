const crypto = require("crypto");
const DirectVideoRoom = require("../models/DirectVideoRoom");
const User = require("../models/User");

const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 72;
const DEFAULT_EXPIRY_HOURS = 24;

function roomJoinLink(req, roomId) {
  const origin = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/+$/, "")}/direct-video-call/${roomId}`;
}

function generateRoomId() {
  // 192 bits of entropy, opaque — not derived from/predictable via any Mongo _id.
  return crypto.randomBytes(24).toString("hex");
}

// A room can be DB-marked "active" but past its expiry — compute the
// effective, up-to-date status without needing a background job.
function effectiveStatus(room) {
  if (room.status === "active" && room.expiresAt && room.expiresAt.getTime() <= Date.now()) {
    return "expired";
  }
  return room.status;
}

function serializeRoom(req, room) {
  return {
    _id: room._id,
    roomId: room.roomId,
    joinLink: roomJoinLink(req, room.roomId),
    status: effectiveStatus(room),
    note: room.note,
    createdByName: room.createdByName,
    maxParticipants: room.maxParticipants,
    expiresAt: room.expiresAt,
    firstJoinedAt: room.firstJoinedAt,
    lastActivityAt: room.lastActivityAt,
    closedAt: room.closedAt,
    createdAt: room.createdAt,
  };
}

// POST /api/direct-video-room — admin generates a secure, unique room link
const createDirectVideoRoom = async (req, res) => {
  try {
    const note = String(req.body?.note || "").slice(0, 500);
    const requestedHours = Number(req.body?.expiresInHours);
    const expiresInHours = Number.isFinite(requestedHours)
      ? Math.min(Math.max(requestedHours, MIN_EXPIRY_HOURS), MAX_EXPIRY_HOURS)
      : DEFAULT_EXPIRY_HOURS;

    const admin = req.user?.id
      ? await User.findById(req.user.id).select("name email").lean()
      : null;

    // Extremely unlikely to collide (192-bit token), but guard against the
    // theoretical unique-index race with a couple of retries.
    let room = null;
    for (let attempt = 0; attempt < 3 && !room; attempt += 1) {
      try {
        room = await DirectVideoRoom.create({
          roomId: generateRoomId(),
          createdBy: req.user?.id || null,
          createdByName: admin?.name || req.user?.name || req.user?.email || "Admin",
          note,
          expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }
    if (!room) {
      return res.status(500).json({ msg: "Failed to generate a unique room. Please try again." });
    }

    res.status(201).json({
      msg: "Secure video consultation link generated.",
      room: serializeRoom(req, room),
    });
  } catch (error) {
    console.error("createDirectVideoRoom error:", error);
    res.status(500).json({ msg: "Failed to generate the video consultation link." });
  }
};

// GET /api/direct-video-room — admin history list
const getDirectVideoRooms = async (req, res) => {
  try {
    const rooms = await DirectVideoRoom.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.status(200).json({
      rooms: rooms.map((room) => serializeRoom(req, room)),
    });
  } catch (error) {
    console.error("getDirectVideoRooms error:", error);
    res.status(500).json({ msg: "Failed to fetch video consultation rooms." });
  }
};

// POST /api/direct-video-room/:roomId/close — admin ends a room early
const closeDirectVideoRoom = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ msg: "Room not found." });

    if (room.status === "active") {
      room.status = "closed";
      room.closedAt = new Date();
      room.closedBy = req.user?.id || null;
      await room.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`direct_room_${room.roomId}`).emit("direct-room-closed", {
        msg: "This consultation has been ended by an administrator.",
      });
    }

    res.status(200).json({ msg: "Room closed.", room: serializeRoom(req, room) });
  } catch (error) {
    console.error("closeDirectVideoRoom error:", error);
    res.status(500).json({ msg: "Failed to close the room." });
  }
};

// GET /api/direct-video-room/:roomId/status — public, no login required.
// Anyone with the link checks validity before attempting to join as a guest.
const getDirectVideoRoomStatus = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId })
      .select("status expiresAt maxParticipants")
      .lean();
    if (!room) return res.status(404).json({ valid: false, reason: "not_found" });

    const status = effectiveStatus(room);
    if (status !== "active") {
      return res.status(200).json({ valid: false, reason: status });
    }

    res.status(200).json({ valid: true, expiresAt: room.expiresAt, maxParticipants: room.maxParticipants });
  } catch (error) {
    console.error("getDirectVideoRoomStatus error:", error);
    res.status(500).json({ valid: false, reason: "server_error" });
  }
};

module.exports = {
  createDirectVideoRoom,
  getDirectVideoRooms,
  closeDirectVideoRoom,
  getDirectVideoRoomStatus,
};
