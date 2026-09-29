const mongoose = require("mongoose");

// Fully independent of Appointment/CategoryConsultation — an ad-hoc, link-based
// video room that anyone with the link can join as a guest (no registration,
// login, or doctor/patient binding), same trust model as a Google Meet link.
// Deliberately kept separate from the appointment-based consultation flow.
const directVideoRoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, default: "" },
    // Which doctor this call is for — separate from createdBy (the admin who
    // generated the link). Optional/additive: rooms created before this
    // field existed simply have neither set, and the admin Calls list shows
    // that as a blank doctor column rather than guessing from the free-text
    // `note` field below.
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    doctorName: { type: String, default: "" },
    note: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "closed", "expired"],
      default: "active",
      index: true,
    },
    maxParticipants: { type: Number, default: 2 },
    // PIN-based roles (added after this model's initial version — rooms
    // created before this existed simply have these empty, and every PIN
    // code path is gated on `doctorPinEncrypted` being non-empty so those
    // old links keep working the original guestId/host-guest way until
    // they expire). Encrypted (AES-256-GCM, utils/directPinCrypto.js), not
    // hashed — an admin must be able to view/resend a forgotten PIN, see
    // the implementation plan for why that outweighs one-way hashing here.
    doctorPinEncrypted: { type: String, default: "" },
    patientPinEncrypted: { type: String, default: "" },
    doctorPinRegeneratedAt: { type: Date, default: null },
    patientPinRegeneratedAt: { type: Date, default: null },
    // Which session currently holds each role's single seat — the source
    // of truth a session token is checked against (see
    // utils/directSessionToken.js): a token is only honored while its
    // sessionId still matches here. Persisted (survives a server restart,
    // unlike the in-memory directRoomRoles map in server.js) but socketId
    // is NOT stored here — that's purely a live, in-memory concern,
    // meaningless across a restart anyway.
    doctorSession: {
      sessionId: { type: String, default: "" },
      guestId: { type: String, default: "" },
      startedAt: { type: Date, default: null },
    },
    patientSession: {
      sessionId: { type: String, default: "" },
      guestId: { type: String, default: "" },
      startedAt: { type: Date, default: null },
    },
    // No `index: true` here — see the TTL index below, which replaces it.
    // Two indexes on the exact same single key ({expiresAt: 1}) are not
    // allowed (MongoDB rejects the second with IndexOptionsConflict), so
    // this field gets exactly one index, now carrying the TTL option too.
    expiresAt: { type: Date, required: true },
    firstJoinedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

directVideoRoomSchema.index({ createdBy: 1, createdAt: -1 });

// Keeps an expired/closed room's document around long enough for
// getDirectVideoRoomStatus / join-direct-room to keep answering "expired" /
// "closed" with a clear message (both read status off this same document —
// see effectiveStatus() in directVideoRoomController.js) instead of
// "not_found" the instant it lapses, while still bounding collection growth
// — previously nothing ever deleted these documents at all (plain index,
// no TTL), so every room ever created (including e2e/test rooms) accumulated
// forever. expireAfterSeconds counts from expiresAt itself, so a document is
// removed 30 days after ITS OWN expiry, not 30 days after creation — a room
// created with a 72h expiry is deleted at 72h + 30d, not 30d flat. Mongo's
// TTL monitor runs on its own ~60s cycle, so deletion is best-effort/eventual,
// never exact-to-the-second.
//
// DEPLOYMENT NOTE: this replaces the old plain `{expiresAt: 1}` index
// (`index: true` above, now removed from the schema) with a TTL version of
// the SAME key. On an existing production collection, the old index is still
// physically present until dropped — Mongoose's default autoIndex will try
// to create this new index on next connect, but MongoDB will reject it
// (IndexOptionsConflict) while the old `expiresAt_1` index still exists,
// since two indexes can't share an identical key pattern. This fails softly
// (logged via the 'index' event / connection error handler, not a crash),
// but the TTL cleanup silently never activates until someone drops the old
// index. Before/during that deploy, run once against the target database:
//   db.directvideorooms.dropIndex("expiresAt_1")
// After that, the next app startup (or `syncIndexes()`) creates this TTL
// index in its place.
const DIRECT_ROOM_TTL_AFTER_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
directVideoRoomSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: DIRECT_ROOM_TTL_AFTER_EXPIRY_SECONDS }
);

module.exports = mongoose.model("DirectVideoRoom", directVideoRoomSchema);
