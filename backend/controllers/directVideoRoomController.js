const crypto = require("crypto");
const DirectVideoRoom = require("../models/DirectVideoRoom");
const DirectRoomEvent = require("../models/DirectRoomEvent");
const DirectCallAlert = require("../models/DirectCallAlert");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { TURN_REGIONS, buildStunServers } = require("../utils/iceServerRegions");
const { generateTurnCredentials } = require("../utils/turnCredentials");

const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 72;
const DEFAULT_EXPIRY_HOURS = 24;
// A room's DirectRoomEvent list has a "problem" flag if a room-full
// rejection or a seat takeover happened within this window — both are
// signs the call had real trouble connecting, worth an admin's attention.
const PROBLEM_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const PROBLEM_EVENT_TYPES = ["rejected", "seat_taken_over"];

function roomJoinLink(req, roomId) {
  // FRONTEND_URL may hold a comma-separated list (it's parsed that way for
  // CORS in server.js) — use the first entry, not the raw string, or the
  // generated link would be "https://a.com,https://b.com/direct-video-call/…".
  const configured = String(process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim();
  const origin = configured || `${req.protocol}://${req.get("host")}`;
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
    // Blank on rooms created before this field existed — never backfilled/
    // guessed from `note`, per the Phase 3 plan.
    doctorId: room.doctorId || null,
    doctorName: room.doctorName || "",
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

    // Optional — a room can still be created without one (matches the
    // pre-Phase-3 flow exactly), the Calls list just shows a blank doctor.
    let doctorId = null;
    let doctorName = "";
    const requestedDoctorId = String(req.body?.doctorId || "").trim();
    if (requestedDoctorId) {
      const doctor = await Doctor.findById(requestedDoctorId).select("name").lean().catch(() => null);
      if (doctor) {
        doctorId = doctor._id;
        doctorName = doctor.name || "";
      }
    }

    // Extremely unlikely to collide (192-bit token), but guard against the
    // theoretical unique-index race with a couple of retries.
    let room = null;
    for (let attempt = 0; attempt < 3 && !room; attempt += 1) {
      try {
        room = await DirectVideoRoom.create({
          roomId: generateRoomId(),
          createdBy: req.user?.id || null,
          createdByName: admin?.name || req.user?.name || req.user?.email || "Admin",
          doctorId,
          doctorName,
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

    // Best-effort occupancy hint so the pre-join screen can warn "this
    // meeting looks full" before the guest sets up their devices. Counts live
    // sockets in the room (not unique guests / reserved seats), so it's
    // advisory only — the socket join handler remains the real capacity gate.
    const maxParticipants = room.maxParticipants || 2;
    const io = req.app.get("io");
    const occupants =
      io?.sockets?.adapter?.rooms?.get(`direct_room_${req.params.roomId}`)?.size ?? 0;

    res.status(200).json({
      valid: true,
      expiresAt: room.expiresAt,
      maxParticipants,
      occupants,
      full: occupants >= maxParticipants,
    });
  } catch (error) {
    console.error("getDirectVideoRoomStatus error:", error);
    res.status(500).json({ valid: false, reason: "server_error" });
  }
};

// GET /api/direct-video-room/:roomId/ice-servers — public, no login required.
// Mirrors GET /api/rtc/ice-servers (routes/rtc.js), which the appointment
// Video Consultation flow uses to get short-lived TURN credentials minted by
// the backend instead of depending on a permanent credential baked into the
// frontend build. Direct Video Call guests have no authenticated identity to
// gate that endpoint on, so this scopes the mint to a currently-active room
// instead of a user — it can't be used to mint credentials for an
// expired/closed/nonexistent roomId.
const getDirectVideoRoomIceServers = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId })
      .select("status expiresAt")
      .lean();
    if (!room || effectiveStatus(room) !== "active") {
      return res.status(404).json({ msg: "This meeting link is invalid or has expired." });
    }

    const iceServers = buildStunServers();
    let ttlSeconds = null;
    let turnAdded = false;
    for (const region of TURN_REGIONS) {
      if (!region.secret) {
        console.warn("[direct-video-room] A TURN region has urls configured but no matching secret — skipping it.");
        continue;
      }
      const creds = generateTurnCredentials({ identifier: req.params.roomId, secret: region.secret });
      if (!creds) continue;

      iceServers.push({
        urls: region.urls,
        username: creds.username,
        credential: creds.credential,
        credentialType: "password",
      });
      turnAdded = true;
      ttlSeconds = ttlSeconds === null ? creds.ttlSeconds : Math.min(ttlSeconds, creds.ttlSeconds);
    }

    if (!turnAdded) {
      console.warn("[direct-video-room] No usable TURN region — serving STUN-only ICE config. Calls across strict NATs will fail.");
    }

    // `warning` lets the guest client surface a "relay unavailable" notice
    // instead of silently spinning on "Connecting…" when strict-NAT traversal
    // has no chance. STUN-only is still returned so permissive networks work.
    res.status(200).json({
      iceServers,
      ttlSeconds: ttlSeconds || 0,
      ...(turnAdded ? {} : { warning: "no_turn" }),
    });
  } catch (error) {
    console.error("getDirectVideoRoomIceServers error:", error);
    res.status(500).json({ msg: "Failed to fetch ICE server configuration." });
  }
};

// Live in-memory state a room's derived status needs — none of this is
// persisted, so it only reflects what THIS server process currently knows
// (fine for the single-instance deployment this app runs as today).
function liveRoomState(req, roomId) {
  const directRoomRoles = req.app.get("directRoomRoles");
  const directRoomSockets = req.app.get("directRoomSockets");
  const entry = directRoomRoles?.get(roomId);
  const liveGuestIds = new Set();
  if (directRoomSockets) {
    for (const meta of directRoomSockets.values()) {
      if (String(meta.roomId) === String(roomId) && meta.guestId) liveGuestIds.add(meta.guestId);
    }
  }
  return {
    liveCount: liveGuestIds.size,
    seatCount: entry ? entry.seats.size : 0,
  };
}

// Derived, not stored — combines the room's own DB status with what the
// server currently observes live, and (for "problem") what happened
// recently. See the Phase 3 plan's status list.
function deriveCallStatus(effStatus, live, hasRecentProblem) {
  if (effStatus === "expired") return "expired";
  if (effStatus === "closed") return "ended";
  if (hasRecentProblem) return "problem";
  if (live.liveCount >= 2) return "in call";
  if (live.liveCount === 1) return live.seatCount >= 2 ? "reconnecting" : "one joined";
  if (live.liveCount === 0 && live.seatCount > 0) return "reconnecting";
  return "waiting";
}

// GET /api/direct-video-room/calls — admin Calls list (Phase 3.2).
// ?problems=true filters to rooms with a recent room-full-rejection or
// seat-takeover event.
const getDirectVideoCalls = async (req, res) => {
  try {
    const problemsOnly = String(req.query?.problems || "") === "true";
    const rooms = await DirectVideoRoom.find().sort({ createdAt: -1 }).limit(200).lean();

    const since = new Date(Date.now() - PROBLEM_LOOKBACK_MS);
    const problemRoomIds = new Set(
      (
        await DirectRoomEvent.find({
          roomId: { $in: rooms.map((r) => r.roomId) },
          type: { $in: PROBLEM_EVENT_TYPES },
          createdAt: { $gte: since },
        })
          .select("roomId")
          .lean()
      ).map((e) => e.roomId),
    );

    const calls = rooms
      .map((room) => {
        const effStatus = effectiveStatus(room);
        const live = liveRoomState(req, room.roomId);
        const status = deriveCallStatus(effStatus, live, problemRoomIds.has(room.roomId));
        return {
          ...serializeRoom(req, room),
          callStatus: status,
          liveParticipants: live.liveCount,
        };
      })
      .filter((c) => !problemsOnly || c.callStatus === "problem");

    res.status(200).json({ calls });
  } catch (error) {
    console.error("getDirectVideoCalls error:", error);
    res.status(500).json({ msg: "Failed to fetch calls." });
  }
};

// Plain-language summary for one timeline event, e.g. "Guest joined from
// iPhone, WhatsApp browser". Falls back to the raw type for anything not
// explicitly worded below rather than hiding it.
function describeEvent(event) {
  const who = event.role === "initiator" ? "Host" : event.role === "guest" ? "Guest" : "Someone";
  const from = [event.device, event.browser].filter(Boolean).join(", ");
  const fromSuffix = from ? ` from ${from}` : "";
  switch (event.type) {
    case "joined":
      return `${who} joined${fromSuffix}${event.detail?.resumedCall ? " (reconnected)" : ""}`;
    case "seat_reserved":
      return `${who}'s seat was reserved (${event.detail?.reason || "join"})`;
    case "seat_released":
      return `${who} left the call`;
    case "seat_reservation_expired":
      return `${who}'s reserved seat expired (they didn't come back)`;
    case "disconnected":
      return `${who} disconnected${fromSuffix} (${event.detail?.reason || "connection lost"})`;
    case "rejected":
      return `A join attempt was rejected (${event.detail?.reason || "unknown reason"})`;
    case "stale_socket_evicted":
      return `${who}'s older tab/window was disconnected (opened a new one)`;
    case "seat_taken_over":
      return `${who}'s seat was given to a new device/browser (${event.detail?.reason === "dead_socket" ? "the old one had disconnected" : "the old one stopped responding"})`;
    case "presence_ping_timed_out":
      return `${who}'s device/browser stopped responding to a check`;
    case "media_state_changed":
      return `${who} turned the ${event.detail?.isMicOff ? "mic off" : "mic on"}, camera ${event.detail?.isCamOff ? "off" : "on"}`;
    case "network_quality":
      return `${who}'s connection quality: ${event.detail?.quality || "unknown"}`;
    case "retry":
      return `${who} tapped Retry to reconnect`;
    case "connected":
      return `Call connected`;
    case "admin_extend_link":
      return `An admin (${event.detail?.adminName || "unknown"}) extended the link`;
    case "admin_clear_stuck_seats":
      return `An admin (${event.detail?.adminName || "unknown"}) cleared ${event.detail?.cleared ?? 0} stuck seat(s)`;
    case "admin_force_end_call":
      return `An admin (${event.detail?.adminName || "unknown"}) force-ended the call`;
    default:
      return `${who}: ${event.type}`;
  }
}

// GET /api/direct-video-room/:roomId/events — admin call report (Phase 3.3).
const getDirectVideoRoomEvents = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId }).lean();
    if (!room) return res.status(404).json({ msg: "Room not found." });

    const events = await DirectRoomEvent.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    // One row per guestId ever seen, summarizing their latest known state —
    // "participants" in the report.
    const byGuest = new Map();
    for (const event of events) {
      if (!event.guestId) continue;
      const existing = byGuest.get(event.guestId) || {
        guestId: event.guestId,
        role: event.role || "",
        device: "",
        browser: "",
        os: "",
        joinedAt: null,
        lastSeenAt: null,
        connectionState: "unknown",
        isMicOff: null,
        isCamOff: null,
        // Phase 5.2 — admin-only (this whole endpoint is verifyAdminToken +
        // adminOnly gated already), masked at write time in server.js.
        maskedIp: "",
      };
      if (event.device || event.browser || event.os) {
        existing.device = event.device || existing.device;
        existing.browser = event.browser || existing.browser;
        existing.os = event.os || existing.os;
      }
      if (event.role) existing.role = event.role;
      if (event.type === "joined" && !existing.joinedAt) existing.joinedAt = event.createdAt;
      if (event.type === "joined" && event.detail?.maskedIp) existing.maskedIp = event.detail.maskedIp;
      if (event.type === "media_state_changed") {
        if (typeof event.detail?.isMicOff === "boolean") existing.isMicOff = event.detail.isMicOff;
        if (typeof event.detail?.isCamOff === "boolean") existing.isCamOff = event.detail.isCamOff;
      }
      if (event.type === "seat_released" || event.type === "seat_reservation_expired") {
        existing.connectionState = "left";
      } else if (event.type === "disconnected") {
        existing.connectionState = "disconnected";
      } else if (event.type === "joined") {
        existing.connectionState = "connected";
      }
      existing.lastSeenAt = event.createdAt;
      byGuest.set(event.guestId, existing);
    }

    res.status(200).json({
      room: serializeRoom(req, room),
      participants: Array.from(byGuest.values()),
      timeline: events.map((event) => ({
        at: event.createdAt,
        type: event.type,
        role: event.role,
        summary: describeEvent(event),
      })),
    });
  } catch (error) {
    console.error("getDirectVideoRoomEvents error:", error);
    res.status(500).json({ msg: "Failed to fetch the call report." });
  }
};

// POST /api/direct-video-room/:roomId/extend — admin action (Phase 3.4).
const extendDirectVideoRoomLink = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ msg: "Room not found." });

    const requestedHours = Number(req.body?.extraHours);
    const extraHours = Number.isFinite(requestedHours)
      ? Math.min(Math.max(requestedHours, 1), MAX_EXPIRY_HOURS)
      : DEFAULT_EXPIRY_HOURS;
    // Capped from NOW, not stacked onto the existing expiry — so this can't
    // be used to push a link out indefinitely by calling it repeatedly.
    const maxAllowed = new Date(Date.now() + MAX_EXPIRY_HOURS * 60 * 60 * 1000);
    const requested = new Date(Date.now() + extraHours * 60 * 60 * 1000);
    room.expiresAt = requested > maxAllowed ? maxAllowed : requested;
    if (room.status === "expired") room.status = "active";
    await room.save();

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_extend_link", {
      roomId: room.roomId,
      detail: {
        adminId: req.user?.id || null,
        adminName: admin?.name || req.user?.name || req.user?.email || "Admin",
        newExpiresAt: room.expiresAt,
      },
    });

    res.status(200).json({ msg: "Link extended.", room: serializeRoom(req, room) });
  } catch (error) {
    console.error("extendDirectVideoRoomLink error:", error);
    res.status(500).json({ msg: "Failed to extend the link." });
  }
};

// POST /api/direct-video-room/:roomId/clear-stuck-seats — admin action
// (Phase 3.4, default action): only frees seats with no live/responsive
// socket — never disconnects an active, healthy call.
const clearStuckSeats = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId }).select("roomId").lean();
    if (!room) return res.status(404).json({ msg: "Room not found." });

    const clear = req.app.get("clearStuckDirectSeats");
    const cleared = clear ? await clear(req.params.roomId) : [];

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_clear_stuck_seats", {
      roomId: req.params.roomId,
      detail: {
        adminId: req.user?.id || null,
        adminName: admin?.name || req.user?.name || req.user?.email || "Admin",
        cleared: cleared.length,
      },
    });

    res.status(200).json({ msg: `Cleared ${cleared.length} stuck seat(s).`, cleared: cleared.length });
  } catch (error) {
    console.error("clearStuckSeats error:", error);
    res.status(500).json({ msg: "Failed to clear stuck seats." });
  }
};

// POST /api/direct-video-room/:roomId/force-end — admin action (Phase 3.4):
// disconnects both participants, even an active call. The frontend must
// confirm with the admin before calling this.
const forceEndDirectVideoCall = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId }).select("roomId").lean();
    if (!room) return res.status(404).json({ msg: "Room not found." });

    const forceEnd = req.app.get("forceEndDirectCall");
    const disconnected = forceEnd ? forceEnd(req.params.roomId) : 0;

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_force_end_call", {
      roomId: req.params.roomId,
      detail: {
        adminId: req.user?.id || null,
        adminName: admin?.name || req.user?.name || req.user?.email || "Admin",
        disconnected,
      },
    });

    res.status(200).json({ msg: `Call ended (${disconnected} participant(s) disconnected).` });
  } catch (error) {
    console.error("forceEndDirectVideoCall error:", error);
    res.status(500).json({ msg: "Failed to end the call." });
  }
};

// GET /api/direct-video-room/alerts — admin alert list (Phase 4). ?unread=true
// filters to unread only; ?limit caps the page (default 50, max 200).
const getDirectCallAlerts = async (req, res) => {
  try {
    const unreadOnly = String(req.query?.unread || "") === "true";
    const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);
    const filter = unreadOnly ? { readAt: null } : {};
    const alerts = await DirectCallAlert.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.status(200).json({ alerts });
  } catch (error) {
    console.error("getDirectCallAlerts error:", error);
    res.status(500).json({ msg: "Failed to fetch alerts." });
  }
};

// GET /api/direct-video-room/alerts/unread-count — admin badge (Phase 4).
const getDirectCallAlertsUnreadCount = async (req, res) => {
  try {
    const count = await DirectCallAlert.countDocuments({ readAt: null });
    res.status(200).json({ count });
  } catch (error) {
    console.error("getDirectCallAlertsUnreadCount error:", error);
    res.status(500).json({ msg: "Failed to fetch unread alert count." });
  }
};

// POST /api/direct-video-room/alerts/:alertId/read — admin marks one alert
// read (Phase 4). Idempotent — re-marking an already-read alert is a no-op.
const markDirectCallAlertRead = async (req, res) => {
  try {
    const alert = await DirectCallAlert.findById(req.params.alertId);
    if (!alert) return res.status(404).json({ msg: "Alert not found." });

    if (!alert.readAt) {
      const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
      alert.readAt = new Date();
      alert.readByName = admin?.name || req.user?.name || req.user?.email || "Admin";
      await alert.save();
    }

    res.status(200).json({ msg: "Alert marked as read.", alert });
  } catch (error) {
    console.error("markDirectCallAlertRead error:", error);
    res.status(500).json({ msg: "Failed to update the alert." });
  }
};

module.exports = {
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
};
