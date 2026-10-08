const crypto = require("crypto");
const DirectVideoRoom = require("../models/DirectVideoRoom");
const DirectRoomEvent = require("../models/DirectRoomEvent");
const DirectCallAlert = require("../models/DirectCallAlert");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { TURN_REGIONS, buildStunServers } = require("../utils/iceServerRegions");
const { generateTurnCredentials } = require("../utils/turnCredentials");
const { encryptPin, decryptPin, generatePin } = require("../utils/directPinCrypto");

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
    // Never the PIN itself — just whether this room uses the PIN flow at
    // all (rooms created before it existed keep working the old
    // guestId/host-guest way, gated on this being false).
    hasPin: Boolean(room.doctorPinEncrypted),
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

    // Generated fresh here, not read back later — the DB only ever stores
    // the encrypted form. This is the ONE moment (plus a later explicit
    // "view PIN" or "regenerate PIN" action) the plaintext PIN exists
    // server-side; never logged, never put in the room's own document
    // unencrypted.
    const doctorPin = generatePin();
    const patientPin = generatePin();

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
          doctorPinEncrypted: encryptPin(doctorPin),
          patientPinEncrypted: encryptPin(patientPin),
          doctorPinRegeneratedAt: new Date(),
          patientPinRegeneratedAt: new Date(),
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
      doctorPin,
      patientPin,
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

// GET /api/direct-video-room/:roomId/pins — admin views both PINs again
// (they're encrypted, not hashed, specifically so this can exist — see the
// PIN-crypto plan). Every view is logged with the admin's name; the PIN
// value itself never appears in that log entry, only in this response.
const getDirectRoomPins = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId })
      .select("doctorPinEncrypted patientPinEncrypted doctorPinRegeneratedAt patientPinRegeneratedAt")
      .lean();
    if (!room) return res.status(404).json({ msg: "Room not found." });
    if (!room.doctorPinEncrypted) {
      return res.status(404).json({ msg: "This link was created before PINs existed — it has no PIN." });
    }

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_viewed_pins", {
      roomId: req.params.roomId,
      detail: { adminId: req.user?.id || null, adminName: admin?.name || req.user?.name || req.user?.email || "Admin" },
    });

    res.status(200).json({
      doctorPin: decryptPin(room.doctorPinEncrypted),
      patientPin: decryptPin(room.patientPinEncrypted),
      doctorPinRegeneratedAt: room.doctorPinRegeneratedAt,
      patientPinRegeneratedAt: room.patientPinRegeneratedAt,
    });
  } catch (error) {
    console.error("getDirectRoomPins error:", error);
    res.status(500).json({ msg: "Failed to fetch PINs." });
  }
};

// POST /api/direct-video-room/:roomId/regenerate-pin — admin action.
// body: { role: "doctor"|"patient", endCurrentSession?: boolean }
// Default (endCurrentSession falsy): the CURRENT device's session token
// stays valid (a refresh doesn't kick the legitimate user off) — only the
// OLD PIN value stops working for a NEW join, since it no longer matches
// what's encrypted here. endCurrentSession: true additionally clears that
// role's session in the DB and asks the live socket holding it (if any) to
// disconnect with a clear message — see server.js's endDirectRoomSession,
// wired in the socket-layer step of this feature.
const regeneratePin = async (req, res) => {
  try {
    const role = String(req.body?.role || "").toLowerCase();
    if (role !== "doctor" && role !== "patient") {
      return res.status(400).json({ msg: "role must be \"doctor\" or \"patient\"." });
    }
    const endCurrentSession = Boolean(req.body?.endCurrentSession);

    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ msg: "Room not found." });
    if (!room.doctorPinEncrypted) {
      return res.status(404).json({ msg: "This link was created before PINs existed — it has no PIN to regenerate." });
    }

    const newPin = generatePin();
    const encryptedField = role === "doctor" ? "doctorPinEncrypted" : "patientPinEncrypted";
    const regeneratedAtField = role === "doctor" ? "doctorPinRegeneratedAt" : "patientPinRegeneratedAt";
    room[encryptedField] = encryptPin(newPin);
    room[regeneratedAtField] = new Date();

    if (endCurrentSession) {
      const sessionField = role === "doctor" ? "doctorSession" : "patientSession";
      room[sessionField] = { sessionId: "", guestId: "", startedAt: null };
    }
    await room.save();

    if (endCurrentSession) {
      const endSession = req.app.get("endDirectRoomSession");
      endSession?.(req.params.roomId, role, "Your session has ended. Please enter the new PIN.");
    }

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_regenerate_pin", {
      roomId: req.params.roomId,
      detail: {
        adminId: req.user?.id || null,
        adminName: admin?.name || req.user?.name || req.user?.email || "Admin",
        role,
        endedSession: endCurrentSession,
      },
    });

    res.status(200).json({ msg: `${role === "doctor" ? "Doctor" : "Patient"} PIN regenerated.`, pin: newPin });
  } catch (error) {
    console.error("regeneratePin error:", error);
    res.status(500).json({ msg: "Failed to regenerate the PIN." });
  }
};

// GET /api/direct-video-room/:roomId/status — public, no login required.
// Anyone with the link checks validity before attempting to join as a guest.
const getDirectVideoRoomStatus = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId })
      .select("status expiresAt maxParticipants doctorPinEncrypted")
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
      hasPin: Boolean(room.doctorPinEncrypted),
    });
  } catch (error) {
    console.error("getDirectVideoRoomStatus error:", error);
    res.status(500).json({ valid: false, reason: "server_error" });
  }
};

// POST /api/direct-video-room/:roomId/leaving?guestId=... — public, no login
// required, called via navigator.sendBeacon on pagehide (see
// DirectVideoCall.jsx). Best-effort: a beacon is specifically designed to
// have a chance of completing during page unload where an ordinary request
// often wouldn't, but there's still no guarantee it arrives — this is why
// disconnect_reason falls back to "unknown" server-side when it doesn't.
// guestId travels in the query string rather than a JSON body since
// sendBeacon's default body content-type isn't guaranteed to be parsed by
// an ordinary JSON body-parser.
const reportDirectRoomLeaving = (req, res) => {
  const guestId = String(req.query?.guestId || "");
  if (guestId && /^[a-zA-Z0-9-]{8,64}$/.test(guestId)) {
    req.app.get("recordExpectedDisconnectReason")?.(guestId, "tab_closed");
  }
  // 204: sendBeacon doesn't read the response either way, but a real status
  // keeps this indistinguishable from any other endpoint in server logs.
  res.status(204).end();
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

// The fixed set of disconnect/rejection reasons (see server.js's
// direct-call-problem handler, the /leaving beacon, and the explicit
// eviction sites for admin_ended/pin_regenerated/session_taken_over).
// `detectable` documents how reliable each one actually is, shown to the
// admin alongside the Problems list so "we don't know why" reads as
// intentional rather than a bug:
//  - "server": the server itself caused or directly observed it — always
//    accurate.
//  - "best-effort": self-reported by the client right before things went
//    wrong — usually arrives, but the browser can vanish before it sends.
//  - "unknown": no signal at all arrived before the socket dropped — could
//    be a closed tab, a locked phone, or a lost network; these look
//    identical from the server's side and are not distinguishable.
const DISCONNECT_REASON_INFO = {
  left_call: { label: "Left the call", suggestion: "Nothing to do — a normal, deliberate exit.", detectable: "server" },
  admin_ended: { label: "Ended by admin", suggestion: "Nothing to do — an admin force-ended this call.", detectable: "server" },
  pin_regenerated: { label: "PIN regenerated", suggestion: "Expected — an admin regenerated this role's PIN and ended the old session.", detectable: "server" },
  session_taken_over: { label: "Taken over by another device", suggestion: "Expected — someone confirmed the PIN on another device and took over this role.", detectable: "server" },
  link_expired: { label: "Link expired", suggestion: "Extend the link if the consultation still needs to happen.", detectable: "server" },
  ping_timeout: { label: "Ping timeout", suggestion: "The device stopped responding — likely a weak or dropped connection.", detectable: "server" },
  network_lost: { label: "Network lost", suggestion: "Ask them to check their Wi-Fi/mobile data and rejoin.", detectable: "best-effort" },
  ice_failed: { label: "Connection failed (ICE)", suggestion: "Often a restrictive network/firewall — ask them to try a different network.", detectable: "best-effort" },
  permission_denied: { label: "Camera/mic permission denied", suggestion: "Ask them to allow camera/microphone access in their browser and rejoin.", detectable: "best-effort" },
  device_busy: { label: "Camera/mic busy", suggestion: "Ask them to close other apps using the camera/microphone and rejoin.", detectable: "best-effort" },
  in_app_browser: { label: "In-app browser", suggestion: "Ask them to open the link in Chrome/Safari instead of the app's built-in browser.", detectable: "best-effort" },
  unsupported_browser: { label: "Unsupported browser", suggestion: "Ask them to use a recent Chrome, Safari, or Edge.", detectable: "best-effort" },
  server_error: { label: "Server error", suggestion: "Check server logs — this shouldn't normally happen.", detectable: "best-effort" },
  tab_closed: { label: "Tab/app closed", suggestion: "Nothing to do — they closed the tab or app.", detectable: "best-effort" },
  unknown: { label: "Disconnected (reason unknown)", suggestion: "Could be a closed tab, a locked phone, or lost network — these can't be told apart.", detectable: "unknown" },
};

// Reasons that represent something going wrong worth an admin's attention —
// everything else (a deliberate leave, an intentional admin/PIN action) is
// still in the timeline but never clutters the Problems summary.
const PROBLEM_DISCONNECT_REASONS = new Set([
  "link_expired",
  "network_lost",
  "ice_failed",
  "permission_denied",
  "device_busy",
  "in_app_browser",
  "unsupported_browser",
  "server_error",
  "ping_timeout",
  "unknown",
]);

// Plain-language summary for one timeline event, e.g. "Guest joined from
// iPhone, WhatsApp browser". Falls back to the raw type for anything not
// explicitly worded below rather than hiding it.
function describeEvent(event) {
  // "initiator"/"guest" only ever appear on rooms created before PINs
  // existed (see DirectVideoRoom.doctorPinEncrypted) — a PIN room's events
  // always carry the real "doctor"/"patient" role instead.
  const who =
    event.role === "doctor" ? "Doctor"
    : event.role === "patient" ? "Patient"
    : event.role === "initiator" ? "Host"
    : event.role === "guest" ? "Guest"
    : "Someone";
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
    case "disconnected": {
      const info = DISCONNECT_REASON_INFO[event.detail?.disconnect_reason];
      return `${who} disconnected${fromSuffix} — ${info?.label || event.detail?.reason || "connection lost"}`;
    }
    case "rejected": {
      const info = DISCONNECT_REASON_INFO[event.detail?.disconnect_reason];
      return `A join attempt was rejected (${info?.label || event.detail?.reason || "unknown reason"})`;
    }
    case "stale_socket_evicted":
      return `${who}'s older tab/window was disconnected (opened a new one)`;
    case "seat_taken_over":
      return `${who}'s seat was given to a new device/browser (${event.detail?.reason === "dead_socket" ? "the old one had disconnected" : "the old one stopped responding"})`;
    case "session_taken_over":
      return `${who}'s session was taken over by another device (confirmed with the PIN)`;
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
    case "admin_viewed_pins":
      return `An admin (${event.detail?.adminName || "unknown"}) viewed the PINs`;
    case "admin_regenerate_pin":
      return `An admin (${event.detail?.adminName || "unknown"}) regenerated the ${event.detail?.role || ""} PIN${event.detail?.endedSession ? " and ended the current session" : ""}`;
    case "admin_deleted_timeline":
      return `A superadmin (${event.detail?.adminName || "unknown"}) deleted ${event.detail?.deletedCount ?? 0} timeline event(s)`;
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

    // "Problems" summary — only reasons that represent something going
    // wrong (see PROBLEM_DISCONNECT_REASONS); a deliberate leave or an
    // intentional admin/PIN action never shows up here, only in the plain
    // timeline below.
    const problems = events
      .filter((event) => PROBLEM_DISCONNECT_REASONS.has(event.detail?.disconnect_reason))
      .map((event) => {
        const info = DISCONNECT_REASON_INFO[event.detail.disconnect_reason];
        const who =
          event.role === "doctor" ? "Doctor"
          : event.role === "patient" ? "Patient"
          : event.role === "initiator" ? "Host"
          : event.role === "guest" ? "Guest"
          : "Someone";
        return {
          at: event.createdAt,
          who,
          reason: event.detail.disconnect_reason,
          label: info.label,
          suggestion: info.suggestion,
          detectable: info.detectable,
        };
      });

    res.status(200).json({
      room: serializeRoom(req, room),
      participants: Array.from(byGuest.values()),
      problems,
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

// DELETE /api/direct-video-room/:roomId/events — superadmin-only. Wipes this
// room's timeline (technical data only — never audio/video, this was never
// stored in the first place). Writes one small audit event right after the
// deletion so the deletion itself is never silently invisible; that audit
// entry is deliberately the only thing left in an otherwise-empty timeline.
const deleteDirectVideoRoomEvents = async (req, res) => {
  try {
    const room = await DirectVideoRoom.findOne({ roomId: req.params.roomId }).select("roomId").lean();
    if (!room) return res.status(404).json({ msg: "Room not found." });

    const { deletedCount } = await DirectRoomEvent.deleteMany({ roomId: req.params.roomId });

    const admin = req.user?.id ? await User.findById(req.user.id).select("name email").lean() : null;
    const logDirectRoom = req.app.get("logDirectRoom");
    logDirectRoom?.("admin_deleted_timeline", {
      roomId: req.params.roomId,
      detail: {
        adminId: req.user?.id || null,
        adminName: admin?.name || req.user?.name || req.user?.email || "Superadmin",
        deletedCount,
      },
    });

    res.status(200).json({ msg: `Deleted ${deletedCount} timeline event(s).`, deletedCount });
  } catch (error) {
    console.error("deleteDirectVideoRoomEvents error:", error);
    res.status(500).json({ msg: "Failed to delete this room's timeline data." });
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
  reportDirectRoomLeaving,
  getDirectVideoRoomIceServers,
  getDirectVideoCalls,
  getDirectVideoRoomEvents,
  deleteDirectVideoRoomEvents,
  extendDirectVideoRoomLink,
  clearStuckSeats,
  forceEndDirectVideoCall,
  getDirectCallAlerts,
  getDirectCallAlertsUnreadCount,
  markDirectCallAlertRead,
  getDirectRoomPins,
  regeneratePin,
};
