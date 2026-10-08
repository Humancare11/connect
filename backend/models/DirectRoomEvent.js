const mongoose = require("mongoose");

// One document per direct-room signaling event — the durable trail behind
// the admin Calls/report pages (Phase 3). Written fire-and-forget alongside
// server.js's existing logDirectRoom() console logging (see that function),
// never awaited or allowed to affect a socket handler's own behavior.
//
// `type` intentionally has no enum: it's always exactly whatever event name
// logDirectRoom() was called with (join, seat_reserved, seat_released,
// seat_reservation_expired, rejected, stale_socket_evicted, seat_taken_over,
// presence_ping_sent/acked/timed_out, disconnected, media_state_changed,
// network_quality, admin_extend_link, admin_clear_stuck_seats,
// admin_force_end_call, ...) — enforcing a schema-level enum here would mean
// a future new log call site silently fails to persist unless this model is
// remembered and updated in lockstep, which defeats the point of hooking a
// single shared function instead of every call site individually.
const directRoomEventSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  guestId: { type: String, default: "" },
  role: { type: String, default: "" }, // "initiator" | "guest" | ""
  type: { type: String, required: true },
  device: { type: String, default: "" },
  browser: { type: String, default: "" },
  os: { type: String, default: "" },
  // Whatever extra fields that specific logDirectRoom() call passed (seat
  // counts, quality bucket, admin id/name, etc.) — deliberately unstructured
  // per-event, same reasoning as `type` above.
  detail: { type: mongoose.Schema.Types.Mixed, default: undefined },
  // No IP address anywhere in this schema — see the Phase 3 plan's privacy
  // note. 90-day retention via TTL, counted from creation (not from the
  // call's own end) — simplest correct behavior, and this is a fresh
  // collection so there's no pre-existing-index migration concern like
  // DirectVideoRoom's expiresAt had.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

// Powers the report timeline query (all events for one room, in order) and
// the calls-list "recent activity" lookups.
directRoomEventSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model("DirectRoomEvent", directRoomEventSchema);
